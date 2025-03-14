from fastapi import FastAPI, Request, Form, Depends
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import uvicorn
import logging
from app.analysis import analyze_url
from app.content_analysis import router as content_analysis_router
from fastapi.middleware.cors import CORSMiddleware
from app import search_analysis
from fastapi.responses import HTMLResponse, RedirectResponse
from app.auth import router as auth_router
from app.auth import get_current_user
from app.admin import router as admin_router
from app.config import db_config
import mysql.connector
from app.users import router as users_router
from app.trends import router as trends_router
from starlette.exceptions import HTTPException as StarletteHTTPException

app = FastAPI()
logging.basicConfig(level=logging.DEBUG)

# Şablonları ve statik dosyaları bağla
templates = Jinja2Templates(directory="app/templates")
app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.mount("/uploads", StaticFiles(directory="app/uploads"), name="uploads")

app.include_router(content_analysis_router)
app.include_router(search_analysis.router)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(users_router)
app.include_router(trends_router)

def get_db():
    return mysql.connector.connect(**db_config)
# 📌 CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 📌 Tüm kaynaklara izin ver
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/login")
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


# 🔒 **GİRİŞ GEREKTİREN SAYFALAR**
@app.api_route("/analyze", methods=["GET", "POST"])
async def analyze(request: Request, url: str = Form(None)):
    user = get_current_user(request)
    if isinstance(user, RedirectResponse):
        return user
    if request.method == "GET":
        return templates.TemplateResponse("analyze.html", {
            "request": request,
            "seo_analysis": {},
            "recommendations": [],
            "headings": [],
            "images": [],
            "internal_links": [],
            "external_links": []
        })

    if not url:
        return templates.TemplateResponse("analyze.html", {
            "request": request,
            "error": "Lütfen bir URL girin.",
            "seo_analysis": {},
            "recommendations": [],
            "headings": [],
            "images": [],
            "internal_links": [],
            "external_links": []
        })

    analysis_result = analyze_url(url)
    # Kullanıcının analiz sayısını artır
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET analysis_count = analysis_count + 1 WHERE username = %s", (user,))
    conn.commit()
    conn.close()

    return templates.TemplateResponse("analyze.html", {
        "request": request,
        "seo_analysis": analysis_result.get("seo_analysis", {}),
        "recommendations": analysis_result.get("recommendations", []),
        "headings": analysis_result.get("headings", []),
        "images": analysis_result.get("images", []),
        "internal_links": analysis_result.get("internal_links", []),
        "external_links": analysis_result.get("external_links", []),
        "url": analysis_result.get("url", ""),
        "title": analysis_result.get("title", ""),
        "meta_desc": analysis_result.get("meta_desc", ""),
        "featured_image": analysis_result.get("featured_image", "")
    })

@app.get("/content-analysis")
async def content_analysis_page(request: Request):
    user = get_current_user(request)
    if isinstance(user, RedirectResponse):
        return user
    return templates.TemplateResponse("content_analysis.html", {"request": request})

@app.get("/search-analysis")
async def search_analysis_page(request: Request):
    user = get_current_user(request)
    if isinstance(user, RedirectResponse):
        return user
    return templates.TemplateResponse("search_analysis.html", {"request": request})

@app.get("/about")
async def about_page(request: Request):
    return templates.TemplateResponse("about.html", {"request": request})

@app.exception_handler(StarletteHTTPException)
async def custom_404_handler(request: Request, exc):
    if exc.status_code == 404:
        return templates.TemplateResponse("404.html", {"request": request}, status_code=404)
    return await request.app.default_exception_handler(request, exc)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
