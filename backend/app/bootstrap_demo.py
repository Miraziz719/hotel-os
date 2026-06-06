"""Initialize schema and seed demo data in one command.

Usage:
    python -m backend.app.bootstrap_demo
"""
import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import select

from app.auth import hashPassword
from app.database import AsyncSessionLocal
from app.models import (
    Booking,
    BookingStatus,
    IssueStatus,
    MaintenanceIssue,
    OrderStatus,
    Room,
    RoomServiceOrder,
    RoomType,
    User,
    UserRole,
)
from app.schemas import CheckInRequest, GuestCreate, MaintenanceIssueCreate, OrderItem, RoomServiceOrderCreate
from app.services import maintenance as maintenance_service
from app.services import reception as reception_service
from app.services import room_service as room_service_service

STAFF_USERS = [
    {"username": "admin", "password": "admin", "role": UserRole.admin},
    {"username": "reception", "password": "reception", "role": UserRole.reception},
    {"username": "cleaner1", "password": "cleaner1", "role": UserRole.housekeeping},
    {"username": "cleaner2", "password": "cleaner2", "role": UserRole.housekeeping},
    {"username": "kitchen", "password": "kitchen", "role": UserRole.room_service},
    {"username": "technician1", "password": "technician1", "role": UserRole.maintenance},
    {"username": "technician2", "password": "technician2", "role": UserRole.maintenance},
]

DEMO_GUEST_PHONE = "+998901112233"
DEMO_GUEST_NAME = "Alisher Karimov"
DEMO_GUEST_EMAIL = "alisher@test.com"
DEMO_ORDER_LABEL = "Demo Club Sandwich"
DEMO_ISSUE_DESCRIPTION = "Demo issue: Air conditioner needs inspection"


def run_migrations() -> None:
    root = Path(__file__).resolve().parents[1]
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(cfg, "head")


async def ensure_staff_users() -> None:
    async with AsyncSessionLocal() as db:
        async with db.begin():
            for item in STAFF_USERS:
                result = await db.execute(select(User).where(User.username == item["username"]))
                user = result.scalar_one_or_none()
                if user:
                    user.hashed_password = hashPassword(item["password"])
                    user.role = item["role"]
                    user.is_active = True
                else:
                    db.add(User(
                        username=item["username"],
                        hashed_password=hashPassword(item["password"]),
                        role=item["role"],
                        is_active=True,
                    ))


async def ensure_demo_guest_room() -> str:
    async with AsyncSessionLocal() as db:
        booking_result = await db.execute(
            select(Booking, Room)
            .join(Room, Booking.room_id == Room.id)
            .where(
                Booking.status == BookingStatus.active,
                Booking.guest.has(phone=DEMO_GUEST_PHONE),
            )
        )
        existing = booking_result.first()
        if existing:
            _, room = existing
            return room.number

    async with AsyncSessionLocal() as db:
        request = CheckInRequest(
            guest=GuestCreate(full_name=DEMO_GUEST_NAME, phone=DEMO_GUEST_PHONE, email=DEMO_GUEST_EMAIL),
            room_type=RoomType.double,
        )
        result = await reception_service.check_in(db, request)
        return result["room"].number


async def ensure_demo_order(room_number: str) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(RoomServiceOrder).where(RoomServiceOrder.status != OrderStatus.delivered))
        for order in result.scalars().all():
            if DEMO_ORDER_LABEL in (order.items or ""):
                return

        await room_service_service.create_order(
            db,
            RoomServiceOrderCreate(
                room_number=room_number,
                items=[
                    OrderItem(name=DEMO_ORDER_LABEL, quantity=1, unit_price="8.00"),
                    OrderItem(name="Demo Coffee", quantity=2, unit_price="3.00"),
                ],
            ),
            orderedBy="demo-seed",
        )


async def ensure_demo_issue() -> None:
    async with AsyncSessionLocal() as db:
        existing = await db.execute(
            select(MaintenanceIssue).where(
                MaintenanceIssue.description == DEMO_ISSUE_DESCRIPTION,
                MaintenanceIssue.status != IssueStatus.resolved,
            )
        )
        if existing.scalar_one_or_none():
            return

        room_result = await db.execute(
            select(Room)
            .where(Room.number != "204")
            .order_by(Room.number)
            .limit(1)
        )
        room = room_result.scalar_one()

        await maintenance_service.report_issue(
            db,
            MaintenanceIssueCreate(
                room_number=room.number,
                description=DEMO_ISSUE_DESCRIPTION,
                urgency="normal",
            ),
            reportedBy="demo-seed",
        )


async def seed_demo_data() -> None:
    await ensure_staff_users()
    room_number = await ensure_demo_guest_room()
    await ensure_demo_order(room_number)
    await ensure_demo_issue()

    print("Demo data ready.")
    print("Login users:")
    for item in STAFF_USERS:
        print(f"  {item['role'].value:15} {item['username']:15} / {item['password']}")
    print(f"Guest login: {DEMO_GUEST_PHONE} / 2233")


def main() -> None:
    run_migrations()
    asyncio.run(seed_demo_data())


if __name__ == "__main__":
    main()
