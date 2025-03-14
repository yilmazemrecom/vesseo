
import mysql.connector
from app.config import get_db
from app.auth import get_current_user
from fastapi import Depends

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

    

def user_history(user, page: int = 1, limit: int = 10):
    """Kullanıcının yaptığı analizleri getirir (sayfalandırmalı)."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    offset = (page - 1) * limit  # Sayfanın başlangıç noktasını hesapla

    cursor.execute(
        "SELECT * FROM user_analyses WHERE username = %s ORDER BY created_at DESC LIMIT %s OFFSET %s",
        (user, limit, offset)
    )
    analyses = cursor.fetchall()

    # Toplam kayıt sayısını al
    cursor.execute("SELECT COUNT(*) as total FROM user_analyses WHERE username = %s", (user,))
    total_records = cursor.fetchone()["total"]

    cursor.close()
    conn.close()

    total_pages = (total_records // limit) + (1 if total_records % limit > 0 else 0)

    return analyses, total_pages  # ✅ Verileri ve toplam sayfa sayısını döndür
