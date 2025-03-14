import os
from dotenv import load_dotenv
import mysql.connector


# 📌 Yükleme dizini tanımla
BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # Proje ana dizini
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")  # uploads klasörü

# 📌 Eğer UPLOAD_DIR yoksa oluştur
os.makedirs(UPLOAD_DIR, exist_ok=True)


# `.env` dosyasını `app/` klasöründen yükle
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path)

# .env'den SECRET_KEY ve ALGORITHM değerlerini oku
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY bulunamadı! Lütfen .env dosyanı kontrol et.")

# Özel yapılandırmalar (her siteye özel class'lar)
SITE_CONFIGS = {
    "tbilisim": {  # T-Bilişim Altyapısı
        "title_class": "h2 fw-bold text-lg-start headline my-2",
        "meta_desc_class": "lead text-lg-start text-dark my-2 description",
        "content_class": "article-text container-padding",
        "image_class": "img-fluid",
        "featured_image": "position-relative d-block",
        "sites": [
            "sokgazetesi.com.tr",
            "istiklal.com.tr",
            "61saat.com",
            "tele1.com.tr",
            "bakirkoymerkez.com",
            "ortadogugazetesi.com"

        ]
    },

}








# MySQL bağlantı bilgileri
db_config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "2020"),
    "database": os.getenv("DB_NAME", "veseo_db")
}

def get_db():
    try:
        conn = mysql.connector.connect(**db_config)
        return conn
    except mysql.connector.Error as err:
        print(f"❌ MySQL Bağlantı Hatası: {err}")
        return None
    
    

def counter(user: str):
    """ Kullanıcının analiz sayısını 1 artırır. """
    conn = get_db()
    if not conn:
        print("❌ MySQL bağlantısı başarısız.")
        return

    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET analysis_count = analysis_count + 1 WHERE username = %s", (user,))
        conn.commit()
        print(f"✅ {user} kullanıcısının analiz sayısı artırıldı.")
    except mysql.connector.Error as err:
        print(f"❌ MySQL Hatası: {err}")
    finally:
        cursor.close()
        conn.close()
