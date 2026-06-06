"""
Reception Service
-----------------
Handles guest check-in, room assignment, check-out, and billing.
"""
import json
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hashPassword
from app.models import Booking, BookingStatus, Guest, Invoice, Room, RoomServiceOrder, RoomStatus, RoomType, User, UserRole
from app.redis_client import publish_event
from app.schemas import CheckInRequest, CheckOutRequest


def _defaultGuestPin(phone: str | None) -> str:
    digits = ''.join(char for char in (phone or '') if char.isdigit())
    return digits[-4:] if len(digits) >= 4 else "1234"


def _decimal(value: Decimal | None) -> Decimal:
    return value or Decimal("0.00")


async def has_active_booking(db: AsyncSession, room_number: str) -> bool:
    """True if the given room currently has an active (checked-in) booking."""
    result = await db.execute(
        select(Booking)
        .join(Room, Booking.room_id == Room.id)
        .where(Room.number == room_number, Booking.status == BookingStatus.active)
    )
    return result.scalar_one_or_none() is not None


def _serialize_order_items(items: str) -> list[dict]:
    try:
        parsed = json.loads(items)
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


async def find_best_room(
    db: AsyncSession,
    room_type: RoomType,
    floor_preference: int | None,
    lift_preference: bool,
) -> Room | None:
    stmt = (
        select(Room)
        .where(Room.room_type == room_type, Room.status == RoomStatus.clean)
        .order_by(Room.last_cleaned_at.asc())
        .with_for_update(skip_locked=True)
    )
    result = await db.execute(stmt)
    candidates: list[Room] = list(result.scalars().all())

    if not candidates:
        return None

    if floor_preference is not None:
        preferred = [room for room in candidates if room.floor == floor_preference]
        other_floors = [room for room in candidates if room.floor != floor_preference]
        ordered = preferred + other_floors
    else:
        ordered = candidates

    if lift_preference:
        ordered.sort(key=lambda room: (0 if room.near_lift else 1))

    return ordered[0] if ordered else None


async def get_available_rooms(
    db: AsyncSession,
    room_type: RoomType | None = None,
    floor: int | None = None,
    near_lift: bool | None = None,
) -> list[Room]:
    stmt = select(Room).where(Room.status == RoomStatus.clean)
    if room_type is not None:
        stmt = stmt.where(Room.room_type == room_type)
    if floor is not None:
        stmt = stmt.where(Room.floor == floor)
    if near_lift is not None:
        stmt = stmt.where(Room.near_lift == near_lift)

    result = await db.execute(stmt.order_by(Room.floor, Room.number))
    return list(result.scalars().all())


async def _find_selected_room(db: AsyncSession, room_number: str, room_type: RoomType) -> Room:
    stmt = (
        select(Room)
        .where(Room.number == room_number)
        .with_for_update(skip_locked=True)
    )
    result = await db.execute(stmt)
    room = result.scalar_one_or_none()

    if not room:
        raise ValueError(f"Room '{room_number}' not found")
    if room.status != RoomStatus.clean:
        raise ValueError(f"Room '{room_number}' is not available")
    if room.room_type != room_type:
        raise ValueError(f"Room '{room_number}' does not match room type '{room_type.value}'")

    return room


async def check_in(db: AsyncSession, data: CheckInRequest):
    async with db.begin():
        if data.room_number:
            room = await _find_selected_room(db, data.room_number, data.room_type)
        else:
            room = await find_best_room(
                db,
                data.room_type,
                data.floor_preference,
                data.lift_preference or False,
            )
            if not room:
                raise ValueError(f"No rooms available for type '{data.room_type}'")

        guest_result = await db.execute(select(Guest).where(Guest.phone == data.guest.phone))
        guest = guest_result.scalar_one_or_none()

        if not guest:
            guest = Guest(
                full_name=data.guest.full_name,
                phone=data.guest.phone,
                email=data.guest.email,
            )
            db.add(guest)
            await db.flush()

        existing_user = await db.execute(select(User).where(User.username == data.guest.phone))
        if not existing_user.scalar_one_or_none():
            guest_user = User(
                username=data.guest.phone,
                hashed_password=hashPassword(_defaultGuestPin(data.guest.phone)),
                role=UserRole.guest,
            )
            db.add(guest_user)

        room.status = RoomStatus.occupied

        booking = Booking(
            guest_id=guest.id,
            room_id=room.id,
            floor_preference=data.floor_preference,
            lift_preference=data.lift_preference or False,
        )
        db.add(booking)
        await db.flush()

    await db.refresh(room)
    await db.refresh(guest)
    await db.refresh(booking)

    await publish_event("guest_checked_in", {
        "booking_id": booking.id,
        "guest_name": guest.full_name,
        "room_number": room.number,
        "room_type": room.room_type.value,
    })
    await publish_event("room_status_changed", {
        "room_number": room.number,
        "old_status": "clean",
        "new_status": "occupied",
    })
    await publish_event("dashboard_update", {"type": "check_in", "room": room.number})

    return {"booking": booking, "guest": guest, "room": room}


async def get_occupied_rooms(db: AsyncSession) -> list[dict]:
    stmt = (
        select(Booking, Room, Guest)
        .join(Room, Booking.room_id == Room.id)
        .join(Guest, Booking.guest_id == Guest.id)
        .where(Booking.status == BookingStatus.active)
        .order_by(Room.floor, Room.number)
    )
    result = await db.execute(stmt)
    now = datetime.now(timezone.utc)
    summaries: list[dict] = []

    for booking, room, guest in result.all():
        orders_result = await db.execute(
            select(RoomServiceOrder).where(
                RoomServiceOrder.room_id == room.id,
                RoomServiceOrder.created_at >= booking.check_in,
            )
        )
        orders = list(orders_result.scalars().all())
        service_charges = sum(_decimal(order.total_price) for order in orders)
        nights = max(1, (now - booking.check_in).days)
        room_charges = _decimal(room.nightly_rate) * nights

        summaries.append({
            "booking_id": booking.id,
            "room_id": room.id,
            "room_number": room.number,
            "room_type": room.room_type.value,
            "floor": room.floor,
            "guest_name": guest.full_name,
            "guest_email": guest.email,
            "guest_phone": guest.phone,
            "check_in": booking.check_in,
            "nights": nights,
            "nightly_rate": room.nightly_rate,
            "room_charges": room_charges,
            "service_orders_count": len(orders),
            "service_charges": service_charges,
            "total_due": room_charges + service_charges,
        })

    return summaries


async def get_guest_history(db: AsyncSession, limit: int = 100) -> list[dict]:
    stmt = (
        select(Booking, Room, Guest)
        .join(Room, Booking.room_id == Room.id)
        .join(Guest, Booking.guest_id == Guest.id)
        .where(Booking.status == BookingStatus.checked_out)
        .order_by(Booking.check_out.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = []
    for booking, room, guest in result.all():
        rows.append({
            "booking_id": booking.id,
            "room_number": room.number,
            "room_type": room.room_type.value,
            "floor": room.floor,
            "guest_name": guest.full_name,
            "guest_phone": guest.phone,
            "check_in": booking.check_in,
            "check_out": booking.check_out,
        })
    return rows


async def get_checkout_preview(
    db: AsyncSession,
    room_number: str,
    discount: Decimal | None = None,
    extra_charges: Decimal | None = None,
) -> dict:
    stmt = (
        select(Booking, Room, Guest)
        .join(Room, Booking.room_id == Room.id)
        .join(Guest, Booking.guest_id == Guest.id)
        .where(Room.number == room_number, Booking.status == BookingStatus.active)
    )
    result = await db.execute(stmt)
    row = result.one_or_none()
    if not row:
        raise ValueError(f"No active booking found for room '{room_number}'")

    booking, room, guest = row
    now = datetime.now(timezone.utc)
    nights = max(1, (now - booking.check_in).days)
    room_charges = _decimal(room.nightly_rate) * nights

    orders_result = await db.execute(
        select(RoomServiceOrder).where(
            RoomServiceOrder.room_id == room.id,
            RoomServiceOrder.created_at >= booking.check_in,
        )
    )
    orders = list(orders_result.scalars().all())
    service_charges = sum(_decimal(order.total_price) for order in orders)
    discount_value = _decimal(discount)
    extra_value = _decimal(extra_charges)
    total = max(Decimal("0.00"), room_charges + service_charges + extra_value - discount_value)

    return {
        "booking_id": booking.id,
        "room_number": room.number,
        "room_type": room.room_type.value,
        "guest_name": guest.full_name,
        "guest_email": guest.email,
        "guest_phone": guest.phone,
        "check_in": booking.check_in,
        "preview_at": now,
        "nights": nights,
        "nightly_rate": room.nightly_rate,
        "room_charges": room_charges,
        "service_charges": service_charges,
        "service_orders_count": len(orders),
        "discount": discount_value,
        "extra_charges": extra_value,
        "total": total,
        "orders": [
            {
                "id": order.id,
                "status": order.status.value,
                "created_at": order.created_at,
                "total_price": order.total_price,
                "items": _serialize_order_items(order.items),
            }
            for order in orders
        ],
    }


async def check_out(db: AsyncSession, data: CheckOutRequest):
    async with db.begin():
        booking_result = await db.execute(
            select(Booking)
            .join(Room, Booking.room_id == Room.id)
            .where(Room.number == data.room_number, Booking.status == BookingStatus.active)
        )
        booking = booking_result.scalar_one_or_none()

        if not booking:
            raise ValueError(f"No active booking found for room '{data.room_number}'")

        room_result = await db.execute(select(Room).where(Room.number == data.room_number))
        room = room_result.scalar_one_or_none()

        check_out_time = datetime.now(timezone.utc)
        nights = max(1, (check_out_time - booking.check_in).days)
        room_charges = _decimal(room.nightly_rate) * nights

        orders_result = await db.execute(
            select(RoomServiceOrder).where(
                RoomServiceOrder.room_id == room.id,
                RoomServiceOrder.created_at >= booking.check_in,
            )
        )
        orders = list(orders_result.scalars().all())
        service_charges = sum(_decimal(order.total_price) for order in orders)

        discount = _decimal(data.discount)
        extra = _decimal(data.extra_charges)
        total = max(Decimal("0.00"), room_charges + service_charges + extra - discount)

        invoice = Invoice(
            booking_id=booking.id,
            room_charges=room_charges,
            service_charges=service_charges,
            extra_charges=extra,
            discount=discount,
            total=total,
        )
        db.add(invoice)

        booking.status = BookingStatus.checked_out
        booking.check_out = check_out_time
        room.status = RoomStatus.dirty

        await db.flush()

    await db.refresh(invoice)

    await publish_event("guest_checked_out", {
        "booking_id": booking.id,
        "room_number": room.number,
        "total": str(total),
    })
    await publish_event("room_released", {"room_number": room.number})
    await publish_event("dashboard_update", {"type": "check_out", "room": room.number})

    return invoice
