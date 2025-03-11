import os
import shutil
import re
from PIL import Image
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, BackgroundTasks
from fastapi.responses import JSONResponse
import unicodedata
import time


router = APIRouter()


UPLOAD_DIR = "app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)  # 📌 Eğer yoksa klasörü oluştur

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


# 📌 Görsel Yükleme ve Analiz
@router.post("/upload-image/")
async def upload_image(file: UploadFile = File(...), background_tasks: BackgroundTasks = BackgroundTasks()):
    """CKEditor'den gelen dosyayı alıp sunucuya kaydeder ve analiz eder."""
    try:
        if not file:
            raise HTTPException(status_code=400, detail="Dosya yüklenemedi!")

        file_ext = os.path.splitext(file.filename)[1].lower()
        safe_filename = file.filename.replace(" ", "_")
        file_path = os.path.join(UPLOAD_DIR, safe_filename)

        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Bu dosya formatı desteklenmiyor!")

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 📌 Dosyanın yüklenme zamanını kaydet
        timestamp_path = file_path + ".timestamp"
        with open(timestamp_path, "w") as ts_file:
            ts_file.write(str(time.time()))

        # 📌 Arka planda eski dosyaları silme işlemini çalıştır
        background_tasks.add_task(delete_old_files, UPLOAD_DIR, 24 * 60 * 60)  # 24 saat sonra sil

        # 📌 Görsel Analizi Yap
        image_info = analyze_image(file_path)

        return JSONResponse(status_code=200, content={
            "uploaded": 1,
            "fileName": safe_filename,
            "url": f"/uploads/{safe_filename}",
            **image_info  # 📌 Görsel analiz bilgilerini ekliyoruz
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dosya yüklenirken hata oluştu: {str(e)}")

def delete_old_files(upload_dir, max_age_seconds):
    """Belirli bir süreden eski olan görselleri otomatik sil."""
    current_time = time.time()

    for filename in os.listdir(upload_dir):
        file_path = os.path.join(upload_dir, filename)
        timestamp_path = file_path + ".timestamp"

        if filename.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
            # 📌 Timestamp dosyası var mı?
            if os.path.exists(timestamp_path):
                with open(timestamp_path, "r") as ts_file:
                    created_time = float(ts_file.read().strip())

                # 📌 Eğer dosya belirtilen süreden eskiyse sil
                if current_time - created_time > max_age_seconds:
                    try:
                        os.remove(file_path)  # Görseli sil
                        os.remove(timestamp_path)  # Timestamp dosyasını sil
                        print(f"🗑️ Silindi: {file_path}")
                    except Exception as e:
                        print(f"⚠️ {file_path} silinemedi: {str(e)}")


def check_alt_tags(content):
    """İçeriğin içinde görsellerin ALT metinlerini kontrol eder."""
    img_tags = re.findall(r'<img [^>]*>', content)
    
    if not img_tags:
        return {
            "status": "no_images",
            "message": "İçerikte hiç görsel bulunamadı! En az bir görsel eklemelisiniz.",
            "missing_alt_images": []
        }

    missing_alt = []

    for img in img_tags:
        if 'alt="' not in img:
            missing_alt.append(img)

    if missing_alt:
        return {
            "status": "Eksik ALT",
            "message": f"{len(missing_alt)} görselde ALT etiketi eksik!",
            "missing_alt_images": missing_alt
        }
    return {
        "status": "Tamam",
        "message": "Tüm görseller ALT etiketine sahip.",
        "missing_alt_images": []
    }

def analyze_image(image_path):
    """Görselin formatını ve boyutunu analiz eder."""
    try:
        with Image.open(image_path) as img:
            image_format = img.format.upper()

        file_size_bytes = os.path.getsize(image_path)
        file_size_kb = file_size_bytes / 1024
        file_size_mb = file_size_kb / 1024

        size_status = "Uygun"
        if file_size_kb > 300:
            size_status = f"Çok büyük ({file_size_kb:.2f} KB), sıkıştırılması önerilir"

        format_status = "Uygun"
        if image_format not in ["WEBP"]:
            format_status = "WebP formatına dönüştürülmesi önerilir"

        return {
            "format": image_format,
            "file_size_kb": round(file_size_kb, 2),
            "file_size_mb": round(file_size_mb, 2),
            "size_status": size_status,
            "format_status": format_status
        }

    except Exception as e:
        return {"error": f"Görsel analizi yapılırken hata oluştu: {str(e)}"}


def extract_images_from_content(content):
    """CKEditor içindeki tüm görsellerin URL'lerini çıkarır."""
    img_urls = re.findall(r'<img[^>]+src="([^">]+)"', content)
    return img_urls


@router.post("/content-analysis/")
def analyze_content(title: str = Form(...), meta_desc: str = Form(...), content: str = Form(...)):
    """İçeriği analiz eder ve eksik ALT metinleri kontrol eder."""

    print(f"✅ Gelen Başlık: {title}")
    print(f"✅ Gelen Meta Açıklaması: {meta_desc}")
    print(f"✅ Gelen İçerik: {content}")

    word_count = len(re.findall(r'\w+', content))
    h1_count = content.count("<h1>")
    h2_count = content.count("<h2>")
    h3_count = content.count("<h3>")

    alt_analysis = check_alt_tags(content)

    # 📌 İçerikteki tüm görselleri al
    img_urls = extract_images_from_content(content)
    image_analysis_results = []

    for img_url in img_urls:
        img_filename = os.path.basename(img_url)  # URL'den dosya adını al
        img_path = os.path.join(UPLOAD_DIR, img_filename)

        if os.path.exists(img_path):
            analysis_result = analyze_image(img_path)  # Görsel analizi yap
            image_analysis_results.append({
                "file_name": img_filename,
                "analysis": analysis_result
            })
        else:
            image_analysis_results.append({
                "file_name": img_filename,
                "error": "Görsel sunucuda bulunamadı!"
            })

    recommendations = []
    successes = []

    # 🎯 Başlık Kontrolü (Ne çok kısa ne çok uzun olmalı!)
    if len(title) < 50:
        recommendations.append("Başlık çok kısa. En az 50 karakter olmalıdır.")
    elif len(title) > 60:
        recommendations.append("Başlık çok uzun. 60 karakteri aşmamalıdır.")
    else:
        successes.append("Başlık uzunluğu ideal! ✅")

    # 🎯 Meta Açıklaması Kontrolü (Ne çok kısa ne çok uzun olmalı!)
    if len(meta_desc) < 120:
        recommendations.append("Meta açıklaması çok kısa. En az 120 karakter olmalıdır.")
    elif len(meta_desc) > 160:
        recommendations.append("Meta açıklaması çok uzun. 160 karakteri aşmamalıdır.")
    else:
        successes.append("Meta açıklaması ideal uzunlukta! ✅")

    # 🎯 İçerik Kelime Sayısı Kontrolü
    if word_count < 300:
        recommendations.append("İçerik çok kısa. En az 300 kelime olmalıdır.")
    elif word_count > 2000:
        recommendations.append("İçerik çok uzun. Daha net ve öz yazmalısınız.")
    else:
        successes.append("İçerik uzunluğu mükemmel! ✅")

    # 🎯 H2 Başlık Sayısı Kontrolü
    if h2_count < 2:
        recommendations.append("En az 2 tane H2 başlığı eklenmelidir.")
    else:
        successes.append("H2 başlık sayısı ideal! ✅")

    return {
        "title_length": len(title),
        "meta_desc_length": len(meta_desc),
        "word_count": word_count,
        "h1_count": h1_count,
        "h2_count": h2_count,
        "h3_count": h3_count,
        "alt_analysis": alt_analysis,
        "recommendations": recommendations,
        "successes": successes,
        "image_analysis": image_analysis_results
        
    }
