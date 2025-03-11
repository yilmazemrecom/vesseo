import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
import re
from app.config import SITE_CONFIGS

# Özel yapılandırmalar (her siteye özel class'lar)
SITE_CONFIGS = {
    "sokgazetesi.com.tr": {
        "title_class": "h2 fw-bold text-lg-start headline my-2",
        "meta_desc_class": "lead text-lg-start text-dark my-2 description",
        "content_class": "article-text container-padding"
    }
}

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

def analyze_url(url):
    # Eğer URL şeması yoksa, HTTPS ekle
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.text, "html.parser")

        title = soup.title.string if soup.title else "Başlık Bulunamadı"
        meta_desc = soup.find("meta", attrs={"name": "description"})
        meta_desc = meta_desc["content"] if meta_desc else "Meta açıklaması bulunamadı."

        # Alan adını çek ve özel yapılandırmayı kontrol et
        domain = urlparse(url).netloc.replace("www.", "")
        content_text = "İçerik bulunamadı."
        images = []
        headings = []
        featured_image = ""
        internal_links = []
        external_links = []

        if domain in SITE_CONFIGS:
            config = SITE_CONFIGS[domain]

            # Başlığı belirli bir class ile çek
            title_tag = soup.find(class_=config.get("title_class"))
            if title_tag:
                title = title_tag.get_text(strip=True)

            # Meta açıklamasını belirli bir class ile çek
            meta_desc_tag = soup.find(class_=config.get("meta_desc_class"))
            if meta_desc_tag:
                meta_desc = meta_desc_tag.get_text(strip=True)

            # İçeriği belirli bir class ile çek
            content_div = soup.find(class_=config.get("content_class"))
            if content_div:
                content_text = content_div.get_text(strip=True)

                # İçerikteki görselleri çek
                img_tags = content_div.find_all("img")
                for img in img_tags:
                    if "src" in img.attrs:
                        images.append(img["src"])

                # İçerikteki alt başlıkları çek (h2 ve h3)
                heading_tags = content_div.find_all(["h2", "h3"])
                for heading in heading_tags:
                    headings.append(heading.get_text(strip=True))

                # İç ve dış bağlantıları çek
                links = content_div.find_all("a", href=True)
                for link in links:
                    href = link["href"]
                    if href.startswith("/") or domain in href:
                        internal_links.append(href)
                    else:
                        external_links.append(href)

            # Öne çıkan görseli <meta property="og:image"> ile al
            og_image = soup.find("meta", property="og:image")
            if og_image and "content" in og_image.attrs:
                featured_image = og_image["content"]
            # Başlık sayıları
        h1_count = len(soup.find_all('h1'))
        # Sadece 'article-text container-padding' içindeki <h2> başlıklarını bul
        article_section = soup.find(class_="article-text container-padding")
        h2_count = len(article_section.find_all('h2')) if article_section else 0
        # SEO Analizi
        seo_analysis = {
            "title_length": len(title),
            "meta_desc_length": len(meta_desc),
            "word_count": len(re.findall(r"\w+", content_text)),
            "heading_count": len(headings),
            "image_count": len(images),
            "internal_link_count": len(internal_links),
            "external_link_count": len(external_links),
            "h1_count": h1_count,
            "h2_count": h2_count
        }

        recommendations = generate_recommendations(seo_analysis)

        return {
            "url": url,
            "title": title,
            "meta_desc": meta_desc,
            "content": content_text,
            "headings": headings,
            "images": images,
            "featured_image": featured_image,
            "internal_links": internal_links,
            "external_links": external_links,
            "seo_analysis": seo_analysis,
            "recommendations": recommendations
        }

    except Exception as e:
        return {"error": f"Hata: {str(e)}"}