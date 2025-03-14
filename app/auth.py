from fastapi import APIRouter, Request, Depends, HTTPException, status
from pydantic import BaseModel
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from dotenv import load_dotenv
from app.config import SECRET_KEY, ALGORITHM
from app.config import get_db
import os
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt




router = APIRouter()


templates = Jinja2Templates(directory="templates")

# Şifreleme için bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Ayarları
load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

class User(BaseModel):
    username: str
    password: str

# Kullanıcıyı veritabanından al
def get_user_from_db(username: str):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
    user = cursor.fetchone()
    conn.close()
    return user

# Şifre kontrolü
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# JWT Token oluştur
def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/login")
def login(response: RedirectResponse, form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user_from_db(form_data.username)
    
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz kullanıcı adı veya şifre")

    access_token = create_access_token(data={"sub": user["username"]})
    
    # JWT token'ı çerez olarak kaydediyoruz
    response = RedirectResponse(url="/analyze", status_code=302)
    response.set_cookie(key="access_token", value=access_token, httponly=True)
    response.set_cookie(key="is_admin", value="1" if user["is_admin"] else "0")

    
    return response

@router.get("/protected")
def protected_route(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Geçersiz kimlik doğrulama")
        return {"message": f"Merhaba {username}, giriş yaptınız!"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token süresi doldu")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")

@router.get("/logout")
def logout():
    response = RedirectResponse(url="/")
    response.delete_cookie(key="access_token")
    return response


# Kullanıcı giriş yapmış mı kontrol eden fonksiyon
def get_current_user(request: Request):
    """ JWT Token'dan kullanıcıyı alır """
    token = request.cookies.get("access_token")  # 📌 Cookie'den token alıyoruz
    
    if not token:
        return RedirectResponse(url="/login")
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])  # 📌 Token'ı doğrula
        username: str = payload.get("sub")  # 📌 Kullanıcı adını al
        if username is None:
            return RedirectResponse(url="/login")
        
        print(f"✅ get_current_user: Kullanıcı {username}")  # TEST İÇİN EKLENDİ
        return username  # ✅ Kullanıcı adını döndür
    except jwt.ExpiredSignatureError:
        return RedirectResponse(url="/login")

    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Geçersiz kimlik doğrulama!")
    
# Kullanıcının admin olup olmadığını kontrol eden fonksiyon
def get_admin_user(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        return None  # Kullanıcı giriş yapmamışsa

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            return None  # Kullanıcı adı yoksa geçersiz token
        
        # Kullanıcının admin olup olmadığını kontrol et
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT is_admin FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        conn.close()

        if user and user["is_admin"]:
            return username  # Admin kullanıcıysa username döndür
        else:
            return None  # Admin değilse None döndür

    except jwt.ExpiredSignatureError:
        return None  # Token süresi dolmuş
    except jwt.InvalidTokenError:
        return None  # Geçersiz token