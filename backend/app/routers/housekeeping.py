from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import CleanRoomRequest
from app.services import housekeeping as svc
from app.auth import requireRoles

router = APIRouter(prefix="/housekeeping", tags=["Housekeeping"])

_access = requireRoles("housekeeping", "reception", "admin")
_guest_access = requireRoles("guest")


@router.post("/start-cleaning")
async def start_cleaning(
    data: CleanRoomRequest,
    db: AsyncSession = Depends(get_db),
    currentUser: dict = Depends(_access),
):
    cleanedBy = currentUser.get("username", currentUser.get("role", "staff"))
    try:
        room = await svc.start_cleaning(db, data.room_number, cleanedBy)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": f"Cleaning started for room {room.number}", "status": room.status, "by": cleanedBy}


@router.post("/complete-cleaning")
async def complete_cleaning(
    data: CleanRoomRequest,
    db: AsyncSession = Depends(get_db),
    currentUser: dict = Depends(_access),
):
    cleanedBy = currentUser.get("username", currentUser.get("role", "staff"))
    try:
        room = await svc.complete_cleaning(db, data.room_number, cleanedBy, data.image_url, data.note)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": f"Room {room.number} is now clean", "status": room.status, "by": cleanedBy}


@router.get("/queue")
async def get_queue(currentUser: dict = Depends(_access)):
    return {"cleaning_queue": svc.get_cleaning_queue()}


@router.get("/active-tasks")
async def active_tasks(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_access),
):
    return await svc.get_active_tasks(db)


@router.get("/completed-tasks")
async def completed_tasks(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_access),
):
    return await svc.get_completed_tasks(db)


@router.post("/request-cleaning")
async def request_cleaning(
    data: CleanRoomRequest,
    db: AsyncSession = Depends(get_db),
    currentUser: dict = Depends(_guest_access),
):
    room_number = currentUser.get("room_number")
    if data.room_number != room_number:
        raise HTTPException(status_code=403, detail=f"Siz faqat {room_number}-xona uchun so'rov yubora olasiz")
    from app.services.reception import has_active_booking
    if not await has_active_booking(db, room_number):
        raise HTTPException(status_code=403, detail="Siz check-out qilgansiz. So'rov yuborish uchun check-in holatida bo'lishingiz kerak.")

    requested_by = f"guest ({currentUser.get('username', room_number)})"
    result = await svc.request_cleaning(room_number, requested_by)
    if result["already_queued"]:
      return {"message": f"{room_number}-xona allaqachon tozalash navbatida", **result}
    return {"message": f"{room_number}-xona uchun tozalash so'rovi yuborildi", **result}


@router.get("/my-status")
async def my_status(
    db: AsyncSession = Depends(get_db),
    currentUser: dict = Depends(_guest_access),
):
    from sqlalchemy import select
    from app.models import Room

    room_number = currentUser.get("room_number")
    result = await db.execute(select(Room).where(Room.number == room_number))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Xona topilmadi")

    queue = svc.get_cleaning_queue()
    return {
        "room_number": room.number,
        "room_status": room.status.value,
        "in_queue": room.number in queue,
        "queue_position": (queue.index(room.number) + 1) if room.number in queue else None,
        "queue_size": len(queue),
        "cleaned_by": room.cleaned_by,
        "last_cleaned_at": room.last_cleaned_at,
    }

