import json
import time
import os
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates
import asyncio

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")

TRENDS_JSON_PATH = "app/trends.json"  # JSON dosyasının yolu
TRENDS_URL = "https://trends.google.com/trending?geo=TR"  # Google Trends sayfası


def fetch_google_trends():
    print("🔍 fetch_google_trends başladı")

    chrome_options = Options()
    chrome_options.binary_location = "/usr/bin/google-chrome"
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")

    print("🚀 Chrome ayarlandı, chromedriver başlatılıyor...")
    service = Service("/usr/bin/chromedriver")
    driver = webdriver.Chrome(service=service, options=chrome_options)

    try:
        driver.get(TRENDS_URL)
        time.sleep(3)

        trends = []
        trend_elements = driver.find_elements(By.CSS_SELECTOR, "div.mZ3RIc")
        search_volume_elements = driver.find_elements(By.CSS_SELECTOR, "div.lqv0Cb")

        for i in range(min(len(trend_elements), len(search_volume_elements))):
            title = trend_elements[i].text.strip()
            search_volume = search_volume_elements[i].text.strip()
            trends.append({"title": title, "search_volume": search_volume})

    except Exception as e:
        print(f"❌ Hata: {e}")
        trends = []
    finally:
        driver.quit()

    return trends



def save_trends_to_json():
    """Çekilen trendleri JSON dosyasına kaydeder."""
    trends = fetch_google_trends()
    data = {
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "trends": trends
    }

    with open(TRENDS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


def load_trends_from_json():
    """JSON dosyasından trend verilerini okur."""
    if not os.path.exists(TRENDS_JSON_PATH):
        return {"last_updated": "Henüz güncellenmedi", "trends": []}

    with open(TRENDS_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/trends")
async def show_trends(request: Request):
    """Trendleri JSON'dan okuyarak kullanıcıya gösterir."""
    trends_data = load_trends_from_json()
    return templates.TemplateResponse("trends.html", {"request": request, "trends": trends_data["trends"], "last_updated": trends_data["last_updated"]})


async def update_trends():
    """Her saat trendleri yeniler (thread içinde)"""
    while True:
        print("🔄 Trend verileri güncelleniyor...")
        await asyncio.to_thread(save_trends_to_json)  # Thread içinde çalıştır
        print("✅ Trendler başarıyla güncellendi!")
        await asyncio.sleep(3600)  # 1 saat bekle

        
@router.on_event("startup")
async def start_trend_updater():
    asyncio.create_task(update_trends())  # Sunucu başlarken trendleri otomatik yenile