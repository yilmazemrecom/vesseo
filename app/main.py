from fastapi import FastAPI, Request, Form
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import uvicorn
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from app.analysis import analyze_url
from app.content_analysis import router as content_analysis_router
from fastapi.middleware.cors import CORSMiddleware
import logging



app = FastAPI()
logging.basicConfig(level=logging.DEBUG)

# Şablonları ve statik dosyaları bağla
templates = Jinja2Templates(directory="app/templates")
app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.mount("/uploads", StaticFiles(directory="app/uploads"), name="uploads")


app.include_router(content_analysis_router, prefix="/api")

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

@app.api_route("/analyze", methods=["GET", "POST"])
async def analyze(request: Request, url: str = Form(None)):
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
    return templates.TemplateResponse("content_analysis.html", {"request": request})


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)