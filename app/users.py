from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from app.auth import get_current_user
from app.config import get_db
from app.basic import user_history
from fastapi.responses import RedirectResponse
from fastapi import Query

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")

@router.get("/user-analyses", response_class=HTMLResponse)
def user_analyses(
    request: Request, 
    page: int = Query(1, alias="sayfa", ge=1), 
    limit: int = 10  # ✅ Varsayılan olarak 10 sonuç göster
):
    """Kullanıcının geçmiş analizlerini listeler ve sayfalandırma ekler."""
    user = get_current_user(request)
    if not isinstance(user, str):
        return RedirectResponse(url="/login")

    analyses, total_pages = user_history(user, page, limit)

    return templates.TemplateResponse("user_analyses.html", {
        "request": request,
        "analyses": analyses,
        "user": user,
        "current_page": page,
        "total_pages": total_pages,
        "limit": limit  # ✅ `limit` şablona eklendi
    })



@router.get("/user-analyses/{analysis_id}", response_class=HTMLResponse)
def user_analysis_detail(request: Request, analysis_id: int):
    """Belirli bir analizin detaylarını gösterir."""
    user = get_current_user(request)
    if not isinstance(user, str):
        return RedirectResponse(url="/login")

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute(
        "SELECT * FROM user_analyses WHERE id = %s AND username = %s", 
        (analysis_id, user)
    )
    analysis = cursor.fetchone()
    
    cursor.close()
    conn.close()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analiz bulunamadı!")

    return templates.TemplateResponse("user_analysis_detail.html", {
        "request": request,
        "analysis": analysis
    })
