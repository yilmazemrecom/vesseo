from fastapi import Request
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
import re
from app.config import SITE_CONFIGS
from app.config import get_db
from app.auth import get_current_user

def generate_recommendations(seo_analysis):
    recommendations = []
    
    # Başlık Uzunluğu
    if seo_analysis["title_length"] < 50:
        recommendations.append("Başlık çok kısa. En az 50 karakter olmalıdır.")
    elif seo_analysis["title_length"] > 60:
        recommendations.append("Başlık çok uzun. 50-60 karakter arasında olmalıdır.")
    
    # Meta Açıklaması Uzunluğu
    if seo_analysis["meta_desc_length"] < 150:
        recommendations.append("Meta açıklaması çok kısa. En az 150 karakter olmalıdır.")
    elif seo_analysis["meta_desc_length"] > 160:
        recommendations.append("Meta açıklaması çok uzun. 150-160 karakter arasında olmalıdır.")
    
    # Kelime Sayısı
    if seo_analysis["word_count"] < 300:
        recommendations.append("İçerik çok kısa. SEO için en az 300 kelime önerilir.")
    
    # Görsellerin Alt Metni
    if seo_analysis["image_count"] > 0 and seo_analysis["image_count"] < 3:
        recommendations.append("Daha fazla görsel ekleyin ve alt metinlerini kontrol edin.")
    
    # İç ve Dış Bağlantılar
    if seo_analysis["internal_link_count"] < 2:
        recommendations.append("Daha fazla iç bağlantı (internal link) ekleyin.")
    if seo_analysis["external_link_count"] < 1:
        recommendations.append("Daha fazla dış bağlantı (external link) ekleyin.")
    
    return recommendations

def detect_cms(domain):
    """URL'ye göre altyapıyı belirler"""
    for cms, config in SITE_CONFIGS.items():
        if domain in config["sites"]:
            return cms  # Altyapı ismini döndür (örn. "tbilisim")
    return "bilinmiyor"  # Eğer eşleşme yoksa bilinmiyor olarak döndür

def analyze_url(url):
    """Belirtilen URL'den içerik ve SEO analizi yapar."""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.text, "html.parser")

        title = soup.title.string if soup.title else "Başlık Bulunamadı"
        meta_desc = soup.find("meta", attrs={"name": "description"})
        meta_desc = meta_desc["content"] if meta_desc else "Meta açıklaması bulunamadı."

        domain = urlparse(url).netloc.replace("www.", "")
        cms_type = detect_cms(domain)  # CMS'yi belirle

        content_text = "İçerik bulunamadı."
        images = set()  # ✅ Tekrarı önlemek için set() kullanalım
        headings = []
        featured_image = ""
        internal_links = []
        external_links = []

        EXCLUDED_CLASSES = {"post-flash", "spot-image", "thumbnail", "content-paragraph-image"}  # Hariç tutulacak görsellerin class'ları

        if cms_type in SITE_CONFIGS:
            config = SITE_CONFIGS[cms_type]
            content_div = soup.find(class_=config.get("content_class"))
            title_tag = soup.find(class_=config.get("title_class"))
            meta_desc_tag = soup.find(class_=config.get("meta_desc_class"))
            featured_image_div = soup.find(class_=config.get("featured_image"))

            if title_tag:
                title = title_tag.get_text(strip=True)
            if meta_desc_tag:
                meta_desc = meta_desc_tag.get_text(strip=True)

        else:
            content_div = soup.find("article")

        if content_div:
            content_text = content_div.get_text(strip=True)

            img_tags = content_div.find_all("img")
            for img in img_tags:
                img_classes = img.get("class", [])  # 🔹 Görselin class'larını kontrol et
                if any(cls in EXCLUDED_CLASSES for cls in img_classes):
                    continue  # ✅ Eğer hariç tutulacak class'lardan biri varsa, atla

                if "src" in img.attrs:
                    images.add(img["src"])  # ✅ Filtrelenmiş görselleri ekle

            heading_tags = content_div.find_all(["h2", "h3"])
            for heading in heading_tags:
                headings.append(heading.get_text(strip=True))

            links = content_div.find_all("a", href=True)
            for link in links:
                href = link["href"]
                if href.startswith("/") or domain in href:
                    internal_links.append(href)
                else:
                    external_links.append(href)

        # ✅ Öne Çıkan Görseli Al (Sırasıyla 3 yöntemle)
        if cms_type in SITE_CONFIGS:
            config = SITE_CONFIGS[cms_type]
            featured_image_div = soup.find(class_=config.get("featured_image"))

            if featured_image_div:
                a_tag = featured_image_div.find("a")
                if a_tag:
                    featured_img_tag = a_tag.find("img")
                else:
                    featured_img_tag = featured_image_div.find("img")

                if featured_img_tag and "src" in featured_img_tag.attrs:
                    featured_image = featured_img_tag["src"]

        # 🔹 Eğer `og:image` meta etiketi varsa ve featured_image boşsa, onu kullan
        if not featured_image:
            og_image = soup.find("meta", property="og:image")
            if og_image and "content" in og_image.attrs:
                featured_image = og_image["content"]

        # 🔹 Eğer hala bulunamadıysa, sayfadaki ilk <img> etiketini kullan
        if not featured_image:
            first_img = soup.find("img")
            if first_img and "src" in first_img.attrs:
                featured_image = first_img["src"]

        # ✅ Öne çıkan görseli `images` listesine ekleyerek toplam görsel sayısını artırıyoruz
        if featured_image and featured_image not in images:
            images.add(featured_image)

        images = list(images)  # ✅ JSON formatında döndürmek için tekrar listeye çeviriyoruz

        print("✅ Final Öne Çıkan Görsel:", featured_image)
        print("🔢 Toplam Görsel Sayısı:", len(images))  # Test için ekledik

        h1_count = len(soup.find_all('h1'))
        h2_count = len(content_div.find_all('h2')) if content_div else 0

        seo_analysis = {
            "title_length": len(title),
            "meta_desc_length": len(meta_desc),
            "word_count": len(re.findall(r"\w+", content_text)),
            "heading_count": len(headings),
            "image_count": len(images),  # ✅ Güncellenmiş görsel sayısı
            "internal_link_count": len(internal_links),
            "external_link_count": len(external_links),
            "h1_count": h1_count,
            "h2_count": h2_count
        }

        recommendations = generate_recommendations(seo_analysis)

        return {
            "url": url,
            "cms_type": cms_type,
            "title": title,
            "meta_desc": meta_desc,
            "content": content_text,
            "headings": headings,
            "images": images,  # ✅ Toplam görseller burada listeleniyor
            "featured_image": featured_image,  # ✅ Öne çıkan görsel eklenmiş halde
            "internal_links": internal_links,
            "external_links": external_links,
            "seo_analysis": seo_analysis,
            "recommendations": recommendations
        }

    except Exception as e:
        return {"error": f"Hata: {str(e)}"}
