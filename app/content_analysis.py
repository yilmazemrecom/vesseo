import os
import shutil
import re
from PIL import Image
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, BackgroundTasks
from fastapi.responses import JSONResponse
import unicodedata
import time
from fastapi import Depends
from app.auth import get_current_user
from app.basic import counter
from fastapi import Request
import json
import uuid
from app.config import UPLOAD_DIR
from app.config import get_db
from datetime import datetime


router = APIRouter()


UPLOAD_DIR = "app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)  # 📌 Eğer yoksa klasörü oluştur

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


router = APIRouter()

# 📌 Görsel Yükleme ve Analiz
@router.post("/upload-image/")
async def upload_image(file: UploadFile = File(...)):
    """CKEditor'den gelen dosyayı alıp sunucuya kaydeder ve analiz eder."""
    try:
        if not file:
            raise HTTPException(status_code=400, detail="Dosya yüklenemedi!")

        file_ext = os.path.splitext(file.filename)[1].lower()

        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Bu dosya formatı desteklenmiyor!")

        # 📌 Bugünün tarihini al ve klasör ismini oluştur
        today = datetime.now()
        year = today.strftime("%Y")  # Yıl (2025)
        month = today.strftime("%m")  # Ay (03)
        day = today.strftime("%d")  # Gün (13)

        # 📌 Yıl, Ay ve Gün klasörlerini oluştur
        upload_path = os.path.join(UPLOAD_DIR, year, month, day)
        os.makedirs(upload_path, exist_ok=True)  # Eğer klasör yoksa oluştur

        # 📌 Benzersiz dosya adı oluştur (UUID)
        unique_filename = f"{uuid.uuid4().hex}{file_ext}"
        file_path = os.path.join(upload_path, unique_filename)

        # 📌 Dosyayı kaydet
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return JSONResponse(status_code=200, content={
            "uploaded": 1,
            "fileName": unique_filename,
            "url": f"/uploads/{year}/{month}/{day}/{unique_filename}"  # 🔗 Doğru URL'yi döndür
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
def analyze_content(request: Request, title: str = Form(...), meta_desc: str = Form(...), content: str = Form(...)):
    """İçeriği analiz eder"""
    user = get_current_user(request)  # ✅ Kullanıcıyı burada çekiyoruz
    if not isinstance(user, str):  # Eğer kullanıcı bilgisi çekilemezse hata dön
        raise HTTPException(status_code=401, detail="Kimlik doğrulama başarısız")

    print(f"✅ Kullanıcı: {user}")
    print(f"✅ Gelen Başlık: {title}")
    print(f"✅ Gelen Meta Açıklaması: {meta_desc}")
    print(f"✅ Gelen İçerik: {content}")

    word_count = len(re.findall(r'\w+', content))
    h1_count = content.count("<h1>")
    h2_count = content.count("<h2>")
    h3_count = content.count("<h3>")
    img_urls = extract_images_from_content(content)
    alt_analysis = check_alt_tags(content)
    recommendations = []
    successes = []

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


    # 🎯 Başlık Kontrolü
    if len(title) < 50:
        recommendations.append("Başlık çok kısa. En az 50 karakter olmalıdır.")
    elif len(title) > 60:
        recommendations.append("Başlık çok uzun. 60 karakteri aşmamalıdır.")
    else:
        successes.append("Başlık uzunluğu ideal! ✅")

    # 🎯 Meta Açıklaması Kontrolü
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

    # 📌 Analiz sonucunu JSON formatına çevir
    analysis_result = {
        "word_count": word_count,
        "h1_count": h1_count,
        "h2_count": h2_count,
        "h3_count": h3_count,
        "image_count": len(img_urls),
        "recommendations": recommendations,
        "successes": successes
    }

    # 📌 Analizi veritabanına kaydet
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO user_analyses (username, title, meta_desc, content, word_count, h1_count, h2_count, h3_count, image_count, analysis_result)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (user, title, meta_desc, content, word_count, h1_count, h2_count, h3_count, len(img_urls), json.dumps(analysis_result))
    )
    conn.commit()
    conn.close()

    counter(user)  # Kullanıcının analiz sayısını artır

    try:
        response_data = {
            "title_length": len(title),
            "meta_desc_length": len(meta_desc),
            "word_count": word_count,
            "h1_count": h1_count,
            "h2_count": h2_count,
            "h3_count": h3_count,
            "alt_analysis": alt_analysis,
            "recommendations": recommendations,
            "successes": successes,
            "image_analysis": image_analysis_results,
            "image_count" : len(img_urls)
            }

        return JSONResponse(content=response_data, status_code=200)

    except Exception as e:
        print(f"❌ SEO Analizi sırasında hata oluştu: {str(e)}")
        return JSONResponse(
            content={
                "status": "error",
                "message": f"SEO Analizi sırasında hata oluştu: {str(e)}"
            },
            status_code=500
        )
