"""
HotelOS - Main Application Entry Point
--------------------------------------
Registers all routers, starts the Redis subscriber background task,
and serves the built frontend from frontend/dist.
"""
import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.event_handlers.subscriber import start_subscriber
from app.routers import auth
from app.routers import dashboard, housekeeping, maintenance, reception, room_service, upload
from app.services.housekeeping import init_cleaning_queue
from app.services.maintenance import init_issue_heap

NO_CACHE = {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache"}
ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "frontend" / "dist"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def spa() -> FileResponse:
    return FileResponse(str(DIST / "index.html"), headers=NO_CACHE)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_cleaning_queue()
    await init_issue_heap()
    task = asyncio.create_task(start_subscriber())
    print("[HotelOS] Redis subscriber task started.")
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    print("[HotelOS] Shutdown complete.")


app = FastAPI(
    title="HotelOS",
    description="Real-time Hotel Management System - BTEC Unit 4",
    version="1.0.0",
    lifespan=lifespan,
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": str(exc) or "Ichki server xatosi"})


UPLOADS_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

if DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="assets")


@app.get("/favicon.svg", include_in_schema=False)
async def favicon():
    return FileResponse(str(DIST / "favicon.svg"), headers=NO_CACHE)


@app.get("/icons.svg", include_in_schema=False)
async def icons():
    return FileResponse(str(DIST / "icons.svg"), headers=NO_CACHE)


app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(reception.router)
app.include_router(housekeeping.router)
app.include_router(room_service.router)
app.include_router(maintenance.router)
app.include_router(dashboard.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "HotelOS"}


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    return spa()
