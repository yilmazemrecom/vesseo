from fastapi import APIRouter, UploadFile, File, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import pandas as pd
import os
import uuid

router = APIRouter()

templates = Jinja2Templates(directory="app/templates")

UPLOAD_DIR = "app/uploads/"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/search_analysis", response_class=HTMLResponse)
async def analysis_page(request: Request):
    return templates.TemplateResponse("search_analysis.html", {"request": request})

@router.post("/search_analysis", response_class=HTMLResponse)
async def analyze_search_console(request: Request, file: UploadFile = File(...)):
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Yalnızca .xlsx uzantılı Excel dosyaları kabul edilir.")

    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    try:
        df = pd.read_excel(file_path, sheet_name="Sorgular")
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Excel dosyası okunamadı: {e}")

    os.remove(file_path)

    total_clicks = df["Tıklamalar"].sum()
    total_impressions = df["Gösterimler"].sum()
    average_ctr = round((df["TO"].mean() * 100), 2)
    average_position = round(df["Pozisyon"].mean(), 2)

    top_queries = df.sort_values(by="Tıklamalar", ascending=False).head(10).to_dict(orient="records")
    low_ctr_queries = df[(df["TO"] < 0.05) & (df["Gösterimler"] > 500)].to_dict(orient="records")

    analysis_result = {
        "total_clicks": total_clicks,
        "total_impressions": total_impressions,
        "average_ctr": average_ctr,
        "average_position": average_position,
        "top_queries": top_queries,
        "low_ctr_queries": low_ctr_queries,
    }

    return templates.TemplateResponse("search_analysis.html", {
        "request": request,
        "analysis": analysis_result
    })
