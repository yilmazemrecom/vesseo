import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

db_config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "2020"),
    "database": os.getenv("DB_NAME", "veseo_db")
}

try:
    conn = mysql.connector.connect(**db_config)
    print("✅ MySQL Bağlantısı Başarılı!")
    conn.close()
except mysql.connector.Error as err:
    print(f"❌ Bağlantı hatası: {err}")
