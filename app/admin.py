from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from app.auth import get_admin_user
from app.config import get_db
from fastapi.templating import Jinja2Templates
from fastapi import Form
from passlib.context import CryptContext

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.get("/admin")
async def admin_dashboard(request: Request):
    admin_user = get_admin_user(request)
    if not admin_user:
        return RedirectResponse(url="/login")

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    # Genel Bilgileri Al
    cursor.execute("SELECT COUNT(*) as total_users FROM users")
    total_users = cursor.fetchone()["total_users"]

    cursor.execute("SELECT SUM(analysis_count) as total_analysis FROM users")
    total_analysis = cursor.fetchone()["total_analysis"]
    total_analysis = total_analysis if total_analysis else 0  # None gelirse sıfır yap

    # Son 5 Analiz
    cursor.execute("SELECT * FROM user_analyses ORDER BY created_at DESC LIMIT 5")
    recent_analyses = cursor.fetchall()

    # Son 7 Günlük Analiz Sayısı
    cursor.execute("""
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM user_analyses 
        WHERE created_at >= NOW() - INTERVAL 7 DAY 
        GROUP BY DATE(created_at) ORDER BY date
    """)
    weekly_data = cursor.fetchall()

    # Verileri JSON'a uygun hale getir
    weekly_labels = [row["date"].strftime("%Y-%m-%d") for row in weekly_data] if weekly_data else []
    weekly_values = [row["count"] for row in weekly_data] if weekly_data else []

    # Kullanıcı Bazlı Analiz Dağılımı
    cursor.execute("SELECT username, COUNT(*) as count FROM user_analyses GROUP BY username")
    user_data = cursor.fetchall()

    user_labels = [row["username"] for row in user_data] if user_data else []
    user_values = [row["count"] for row in user_data] if user_data else []

    cursor.close()
    conn.close()

    return templates.TemplateResponse("admin/panel.html", {
        "request": request,
        "total_users": total_users,
        "total_analysis": total_analysis,
        "recent_analyses": recent_analyses,
        "weekly_labels": weekly_labels,  # 🚀 Boşsa []
        "weekly_values": weekly_values,  # 🚀 Boşsa []
        "user_labels": user_labels,      # 🚀 Boşsa []
        "user_values": user_values       # 🚀 Boşsa []
    })



@router.get("/admin/users")
async def admin_users(request: Request, page: int = 1, limit: int = 10):
    admin_user = get_admin_user(request)
    if not admin_user:
        return RedirectResponse(url="/login")

    offset = (page - 1) * limit

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    # 📌 Toplam kullanıcı sayısını al
    cursor.execute("SELECT COUNT(*) as total_users FROM users")
    total_users = cursor.fetchone()["total_users"]
    total_pages = (total_users // limit) + (1 if total_users % limit > 0 else 0)

    # 📌 Kullanıcıları getirirken email alanını da ekleyelim
    cursor.execute("SELECT id, username, email, is_admin, analysis_count FROM users LIMIT %s OFFSET %s", (limit, offset))
    users = cursor.fetchall()

    conn.close()

    return templates.TemplateResponse("admin/users.html", {
        "request": request,
        "users": users,
        "current_page": page,
        "total_pages": total_pages,
        "limit": limit
    })



# Kullanıcı Silme
@router.get("/admin/delete/{user_id}")
async def delete_user(user_id: int, request: Request):
    admin_user = get_admin_user(request)
    if not admin_user:
        return RedirectResponse(url="/login")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()
    conn.close()

    return RedirectResponse(url="/admin/users", status_code=303)


@router.get("/admin/users/add")
async def add_user_page(request: Request):
    admin_user = get_admin_user(request)
    if not admin_user:
        return RedirectResponse(url="/login")

    return templates.TemplateResponse("admin/add_user.html", {"request": request})

@router.post("/admin/users/add")
async def add_user(
    request: Request,
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    is_admin: int = Form(0)  # Varsayılan olarak normal kullanıcı
):
    admin_user = get_admin_user(request)
    if not admin_user:
        return RedirectResponse(url="/login")

    conn = get_db()
    cursor = conn.cursor()

    # 📌 Aynı e-posta var mı kontrol et
    cursor.execute("SELECT COUNT(*) FROM users WHERE email = %s", (email,))
    if cursor.fetchone()[0] > 0:
        conn.close()
        return RedirectResponse(url="/admin/users?error=Email%20zaten%20kullanılıyor!", status_code=303)

    hashed_password = pwd_context.hash(password)  # Şifreyi güvenli hale getir

    try:
        cursor.execute("INSERT INTO users (username, email, password_hash, is_admin) VALUES (%s, %s, %s, %s)",
                       (username, email, hashed_password, is_admin))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"❌ Hata: {e}")
    finally:
        conn.close()

    return RedirectResponse(url="/admin/users", status_code=303)


@router.get("/admin/analyses")
def list_analyses(request: Request, page: int = 1, limit: int = 10, username: str = None):
    """Admin panelinde analizleri listeler (Pagination + Kullanıcı Filtresi)"""
    admin_user = get_admin_user(request)
    if not admin_user:
        return RedirectResponse(url="/login")
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    # 📌 **Eğer bir kullanıcı adı girilmişse, sadece o kullanıcının analizlerini getir**
    if username:
        cursor.execute("SELECT COUNT(*) as total FROM user_analyses WHERE username = %s", (username,))
    else:
        cursor.execute("SELECT COUNT(*) as total FROM user_analyses")
    
    total_records = cursor.fetchone()["total"]
    total_pages = (total_records // limit) + (1 if total_records % limit > 0 else 0)

    # **📌 Sayfalama için OFFSET hesapla**
    offset = (page - 1) * limit

    if username:
        cursor.execute(
            "SELECT * FROM user_analyses WHERE username = %s ORDER BY created_at DESC LIMIT %s OFFSET %s",
            (username, limit, offset)
        )
    else:
        cursor.execute(
            "SELECT * FROM user_analyses ORDER BY created_at DESC LIMIT %s OFFSET %s",
            (limit, offset)
        )

    analyses = cursor.fetchall()
    cursor.close()
    conn.close()

    return templates.TemplateResponse("admin/admin_analysis.html", {
        "request": request,
        "analyses": analyses,
        "current_page": page,  
        "total_pages": total_pages,  
        "limit": limit,  
        "filter_username": username  # Filtrelenmiş kullanıcıyı template'e gönderiyoruz
    })


@router.get("/admin/analysis/{analysis_id}")
def admin_analysis_detail(request: Request, analysis_id: int):
    """Admin panelinde belirli bir analizin detaylarını gösterir"""
    admin_user = get_admin_user(request)
    if not admin_user:
        return RedirectResponse(url="/login")

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    # Analiz verisini çek
    cursor.execute("SELECT * FROM user_analyses WHERE id = %s", (analysis_id,))
    analysis = cursor.fetchone()
    
    cursor.close()
    conn.close()

    # Eğer analiz bulunamazsa 404 hata döndür
    if not analysis:
        return templates.TemplateResponse("404.html", {"request": request})

    return templates.TemplateResponse("admin/admin_analysis_detail.html", {
        "request": request,
        "analysis": analysis
    })


@router.delete("/admin/delete-analysis/{analysis_id}")
def delete_analysis(analysis_id: int, request: Request):
    """Seçilen analizi veritabanından siler"""
    admin_user = get_admin_user(request)
    if not admin_user:
        return RedirectResponse(url="/login")


    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM user_analyses WHERE id = %s", (analysis_id,))
    conn.commit()

    cursor.close()
    conn.close()
    
    return {"message": "Analiz başarıyla silindi!"}

@router.get("/admin/analyses")
def list_analyses(request: Request, page: int = 1, limit: int = 6):
    """Admin panelinde analizleri listeler (pagination ile)"""
    admin_user = get_admin_user(request)
    if not admin_user:
        return RedirectResponse(url="/login")
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    # Toplam analiz sayısını al
    cursor.execute("SELECT COUNT(*) AS total FROM user_analyses")
    total_count = cursor.fetchone()["total"]
    total_pages = (total_count + limit - 1) // limit  # Sayfa sayısını hesapla

    # Eğer hiç analiz yoksa total_pages'i en az 1 yap
    total_pages = max(total_pages, 1)

    # Sayfa sınırlarını kontrol et (1'den küçük sayfa olmamalı)
    page = max(1, min(page, total_pages))

    offset = (page - 1) * limit
    cursor.execute("SELECT * FROM user_analyses ORDER BY created_at DESC LIMIT %s OFFSET %s", (limit, offset))
    analyses = cursor.fetchall()
    
    cursor.close()
    conn.close()

    return templates.TemplateResponse("admin/admin_analysis.html", {
        "request": request,
        "analyses": analyses,
        "current_page": page,  # ✅ current_page değişkeni template'e gönderildi
        "total_pages": total_pages,  # ✅ total_pages değişkeni template'e gönderildi
        "limit": limit  # ✅ limit değişkeni de pagination için eklenebilir
    })

@router.delete("/admin/delete-old-analyses")
def delete_old_analyses(days: int, request: Request):
    """Belirtilen günden eski analizleri siler"""
    
    admin_user = get_admin_user(request)
    if not admin_user:
        return RedirectResponse(url="/login")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM user_analyses WHERE created_at < NOW() - INTERVAL %s DAY", (days,))
    conn.commit()

    cursor.close()
    conn.close()
    
    return {"message": f"Son {days} günden eski analizler temizlendi!"}
