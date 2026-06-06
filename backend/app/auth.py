"""JWT authentication utilities and role-based access dependencies."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from app.config import settings

ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 8

oauth2Scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hashPassword(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verifyPassword(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def createToken(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


async def getCurrentUser(token: str = Depends(oauth2Scheme)) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token muddati tugagan")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Noto'g'ri token")


def requireRoles(*roles: str):
    async def dep(currentUser: dict = Depends(getCurrentUser)) -> dict:
        if currentUser.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Ruxsat yo'q")
        return currentUser
    return dep

