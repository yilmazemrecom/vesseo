from fastapi import APIRouter, UploadFile, File, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import pandas as pd
import os
import uuid
from app.config import get_db
from fastapi.responses import RedirectResponse
from app.auth import get_current_user
from app.auth import get_current_user
from app.basic import usage_counter
from fastapi import Request


router = APIRouter()

templates = Jinja2Templates(directory="app/templates")

UPLOAD_DIR = "app/uploads/"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/search_analysis", response_class=HTMLResponse)
async def analysis_page(request: Request,):
    user = get_current_user(request)
    if isinstance(user, RedirectResponse):
        return user
    return templates.TemplateResponse("search_analysis.html", {"request": request})

@router.post("/search_analysis", response_class=HTMLResponse)
async def analyze_search_console(request: Request, file: UploadFile = File(...)):
    """Search Console analizini işler ve gösterir."""
    
    user = get_current_user(request)  # ✅ Kullanıcıyı buradan çekiyoruz
    if not isinstance(user, str):  # Kullanıcı doğrulanmazsa 401 döndür
        raise HTTPException(status_code=401, detail="Kimlik doğrulama başarısız")
    
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Yalnızca .xlsx uzantılı Excel dosyaları kabul edilir.")
    
    file_id = str(uuid.uuid4())  # Her dosya için benzersiz ID oluştur
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())

        df = pd.read_excel(file_path, sheet_name="Sorgular")  # 📌 "Sorgular" sayfasını oku

        total_clicks = df["Tıklamalar"].sum()
        total_impressions = df["Gösterimler"].sum()
        average_ctr = round((df["TO"].mean() * 100), 2)
        average_position = round(df["Pozisyon"].mean(), 2)

        # 📌 En çok tıklama alan ilk 10 sorgu
        top_queries = df.sort_values(by="Tıklamalar", ascending=False).head(10).to_dict(orient="records")

        # 📌 CTR düşük olan ama gösterimi yüksek olan sorgular (TO < 5%, Gösterim > 500)
        low_ctr_queries = df[(df["TO"] < 0.05) & (df["Gösterimler"] > 500)].to_dict(orient="records")

        analysis_result = {
            "total_clicks": total_clicks,
            "total_impressions": total_impressions,
            "average_ctr": average_ctr,
            "average_position": average_position,
            "top_queries": top_queries,
            "low_ctr_queries": low_ctr_queries,
        }

        # ✅ Kullanıcının analiz sayısını artır
        usage_counter(user)

        return templates.TemplateResponse("search_analysis.html", {
            "request": request,
            "analysis": analysis_result
        })
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Excel dosyası okunamadı: {e}")
    
    finally:
        # 🔥 Dosyayı analiz tamamlandıktan sonra temizle
        if os.path.exists(file_path):
            os.remove(file_path)