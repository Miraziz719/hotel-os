"""File upload endpoint — saves to backend/uploads/ and returns a public URL."""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.auth import requireRoles

router = APIRouter(prefix="/upload", tags=["Upload"])

UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB

_any_staff = requireRoles("admin", "reception", "housekeeping", "room_service", "maintenance", "guest")


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    _: dict = Depends(_any_staff),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Faqat rasm fayllari qabul qilinadi (JPEG, PNG, WEBP, GIF)")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Fayl hajmi 10 MB dan oshmasligi kerak")

    ext = Path(file.filename or "image.jpg").suffix.lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    (UPLOADS_DIR / filename).write_bytes(data)

    return {"url": f"/uploads/{filename}"}
