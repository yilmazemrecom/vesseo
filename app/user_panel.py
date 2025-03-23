from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from datetime import datetime
import json

from app.config import get_db
from app.auth import get_current_user

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


def get_user_analysis_summary(username: str):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    now = datetime.now()

    # 📌 Toplam ve aylık analiz sayısı
    cursor.execute("SELECT COUNT(*) as total FROM user_analyses WHERE username = %s", (username,))
    total = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT COUNT(*) as monthly_total
        FROM user_analyses 
        WHERE username = %s 
        AND MONTH(created_at) = %s AND YEAR(created_at) = %s
    """, (username, now.month, now.year))
    monthly = cursor.fetchone()["monthly_total"]

    # 📌 Detaylı analiz sonuçlarını çek
    cursor.execute("SELECT word_count, image_count, analysis_result FROM user_analyses WHERE username = %s", (username,))
    rows = cursor.fetchall()

    word_counts = []
    image_counts = []
    recommendation_counts = []

    for row in rows:
        try:
            result = json.loads(row["analysis_result"])
            word_counts.append(row.get("word_count", 0))
            image_counts.append(row.get("image_count", 0))
            recommendation_counts.append(len(result.get("recommendations", [])))
        except Exception as e:
            print(f"JSON Parse Hatası: {e}")
            continue

    avg_words = round(sum(word_counts) / len(word_counts), 2) if word_counts else 0
    avg_images = round(sum(image_counts) / len(image_counts), 2) if image_counts else 0
    avg_recommendations = round(sum(recommendation_counts) / len(recommendation_counts), 2) if recommendation_counts else 0

    # 📌 Son analiz
    cursor.execute("""
        SELECT id, title, analysis_result
        FROM user_analyses 
        WHERE username = %s 
        ORDER BY created_at DESC LIMIT 1
    """, (username,))
    last_row = cursor.fetchone()

    last_analysis = None
    if last_row:
        try:
            result = json.loads(last_row["analysis_result"])
        except:
            result = {}

        last_analysis = {
            "id": last_row["id"],
            "title": last_row["title"],
            "word_count": result.get("word_count", 0),
            "image_count": result.get("image_count", 0),
            "recommendation_count": len(result.get("recommendations", []))
        }

    conn.close()

    return {
        "total": total,
        "monthly": monthly,
        "avg_words": avg_words,
        "avg_images": avg_images,
        "avg_recommendations": avg_recommendations,
        "last_analysis": last_analysis
    }


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    username = get_current_user(request)
    if isinstance(username, RedirectResponse):
        return username

    summary = get_user_analysis_summary(username)
    now = datetime.now()
    return templates.TemplateResponse("user/dashboard.html", {
        "request": request,
        "user": {"username": username},
        "total_analyses": summary["total"],
        "monthly_analyses": summary["monthly"],
        "avg_words": summary["avg_words"],
        "avg_images": summary["avg_images"],
        "avg_recommendations": summary["avg_recommendations"],
        "last_analysis": summary["last_analysis"],
        "now": now
    })
