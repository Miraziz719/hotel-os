"""
Housekeeping Service
--------------------
Listens for room.released events and manages the cleaning queue.
Room status transitions:
- occupied/dirty -> cleaning
- cleaning -> occupied (if active booking exists) or clean
"""
from collections import deque
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import Booking, BookingStatus, Room, RoomStatus
from app.redis_client import publish_event

cleaning_queue: deque[str] = deque()


async def init_cleaning_queue() -> None:
    async with AsyncSessionLocal() as db:
        stmt = (
            select(Room)
            .where(Room.status.in_([RoomStatus.dirty, RoomStatus.cleaning]))
            .order_by(Room.last_cleaned_at.asc())
        )
        result = await db.execute(stmt)
        rooms = result.scalars().all()
        for room in rooms:
            if room.number not in cleaning_queue:
                cleaning_queue.append(room.number)
    print(f"[Housekeeping] Queue restored from DB: {list(cleaning_queue)}")


async def add_to_cleaning_queue(room_number: str) -> None:
    if room_number not in cleaning_queue:
        cleaning_queue.append(room_number)
        print(f"[Housekeeping] Room {room_number} added to cleaning queue. Queue size: {len(cleaning_queue)}")

    await publish_event("dashboard_update", {
        "type": "cleaning_queue",
        "queue": list(cleaning_queue),
    })


async def start_cleaning(db: AsyncSession, room_number: str, cleanedBy: str = "staff") -> Room:
    async with db.begin():
        stmt = select(Room).where(Room.number == room_number)
        result = await db.execute(stmt)
        room = result.scalar_one_or_none()

        if not room:
            raise ValueError(f"Room '{room_number}' not found")
        if room.status == RoomStatus.cleaning:
            raise ValueError(f"Room '{room_number}' allaqachon tozalanmoqda")
        if room.status == RoomStatus.clean:
            raise ValueError(f"Room '{room_number}' allaqachon toza")

        old_status = room.status.value
        room.status = RoomStatus.cleaning

    await db.refresh(room)
    await publish_event("room_status_changed", {
        "room_number": room_number,
        "old_status": old_status,
        "new_status": "cleaning",
    })
    await publish_event("dashboard_update", {"type": "room_status", "room": room_number, "status": "cleaning"})
    return room


async def complete_cleaning(db: AsyncSession, room_number: str, cleanedBy: str = "staff", imageUrl: str = None, note: str = None) -> Room:
    async with db.begin():
        stmt = select(Room).where(Room.number == room_number)
        result = await db.execute(stmt)
        room = result.scalar_one_or_none()

        if not room:
            raise ValueError(f"Room '{room_number}' not found")

        booking_result = await db.execute(
            select(Booking).where(
                Booking.room_id == room.id,
                Booking.status == BookingStatus.active,
            )
        )
        active_booking = booking_result.scalar_one_or_none()

        old_status = room.status.value
        room.status = RoomStatus.occupied if active_booking else RoomStatus.clean
        room.last_cleaned_at = datetime.now(timezone.utc)
        room.cleaned_by = cleanedBy
        if note:
            room.last_clean_note = note
        if imageUrl:
            room.last_clean_image_url = imageUrl

    if room_number in cleaning_queue:
        cleaning_queue.remove(room_number)

    await db.refresh(room)
    await publish_event("room_status_changed", {
        "room_number": room_number,
        "old_status": old_status,
        "new_status": room.status.value,
    })
    await publish_event("dashboard_update", {"type": "room_status", "room": room_number, "status": room.status.value})
    return room


def get_cleaning_queue() -> list[str]:
    return list(cleaning_queue)


async def request_cleaning(room_number: str, requested_by: str = "guest") -> dict:
    already_queued = room_number in cleaning_queue
    if not already_queued:
        cleaning_queue.append(room_number)

    await publish_event("housekeeping_requested", {
        "room_number": room_number,
        "requested_by": requested_by,
    })
    await publish_event("dashboard_update", {
        "type": "housekeeping_requested",
        "room": room_number,
        "requested_by": requested_by,
        "queue": list(cleaning_queue),
    })

    return {
        "room_number": room_number,
        "already_queued": already_queued,
        "queue_size": len(cleaning_queue),
    }


async def get_active_tasks(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(Room).order_by(Room.number))
    rooms = result.scalars().all()
    queue = list(cleaning_queue)

    tasks = []
    for room in rooms:
      if room.number in queue or room.status in (RoomStatus.cleaning, RoomStatus.dirty):
            tasks.append({
                "room_number": room.number,
                "room_status": room.status.value,
                "in_queue": room.number in queue,
                "queue_position": (queue.index(room.number) + 1) if room.number in queue else None,
                "cleaned_by": room.cleaned_by,
                "last_cleaned_at": room.last_cleaned_at,
                "last_clean_image_url": room.last_clean_image_url,
            })
    return tasks


async def get_completed_tasks(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Room)
        .where(Room.cleaned_by.is_not(None))
        .order_by(Room.last_cleaned_at.desc())
    )
    rooms = result.scalars().all()
    return [
        {
            "room_number": room.number,
            "room_status": room.status.value,
            "cleaned_by": room.cleaned_by,
            "last_cleaned_at": room.last_cleaned_at,
            "last_clean_image_url": room.last_clean_image_url,
        }
        for room in rooms
    ]
