"""Create one test guest with an active booking. Run: python -m app.seed_guest"""
import asyncio
from datetime import datetime, timezone
from app.database import AsyncSessionLocal
from app.models import Guest, Booking, Room, RoomStatus, BookingStatus


async def seedGuest():
    async with AsyncSessionLocal() as db:
        guest = Guest(
            full_name="Alisher Karimov",
            email="alisher@test.com",
            phone="+998901112233",
        )
        db.add(guest)
        await db.flush()

        roomResult = await db.execute(
            __import__('sqlalchemy', fromlist=['select']).select(Room)
            .where(Room.status == RoomStatus.clean)
            .limit(1)
        )
        room = roomResult.scalar_one()
        room.status = RoomStatus.occupied

        booking = Booking(
            guest_id=guest.id,
            room_id=room.id,
            status=BookingStatus.active,
            check_in=datetime.now(timezone.utc),
        )
        db.add(booking)
        await db.commit()

    print("Test guest created:")
    print(f"  Name  : {guest.full_name}")
    print(f"  Phone : {guest.phone}  (guest login uchun)")
    print(f"  Room  : {room.number}")


if __name__ == "__main__":
    asyncio.run(seedGuest())

