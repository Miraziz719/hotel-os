from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.config import settings

UPLOADS_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


def create_service_app(
    *,
    service_name: str,
    title: str,
    version: str = "2.0.0",
    lifespan=None,
    mount_uploads: bool = False,
) -> FastAPI:
    app = FastAPI(title=title, version=version, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        return JSONResponse(status_code=500, content={"detail": str(exc) or "Ichki server xatosi"})

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": service_name}

    if mount_uploads:
        app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

    return app
