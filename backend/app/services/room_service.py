"""
Room Service
------------
Accepts food/drink orders from rooms.
Status flow: Received -> Preparing -> Delivering -> Delivered
Adds order cost to the room's running bill.
"""
import json
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Booking, BookingStatus, OrderStatus, Room, RoomServiceOrder
from app.redis_client import publish_event
from app.schemas import RoomServiceOrderCreate

STATUS_PROGRESSION = {
    OrderStatus.received: OrderStatus.preparing,
    OrderStatus.preparing: OrderStatus.delivering,
    OrderStatus.delivering: OrderStatus.delivered,
}


async def create_order(db: AsyncSession, data: RoomServiceOrderCreate, orderedBy: str = "unknown") -> RoomServiceOrder:
    async with db.begin():
        stmt = select(Room).where(Room.number == data.room_number)
        result = await db.execute(stmt)
        room = result.scalar_one_or_none()

        if not room:
            raise ValueError(f"Room '{data.room_number}' not found")

        total = sum(Decimal(str(item.unit_price)) * item.quantity for item in data.items)
        items_json = json.dumps([item.model_dump(mode="json") for item in data.items])

        order = RoomServiceOrder(
            room_id=room.id,
            items=items_json,
            total_price=total,
            status=OrderStatus.received,
            ordered_by=orderedBy,
        )
        db.add(order)
        await db.flush()
        order_id = order.id

    await db.refresh(order)

    await publish_event("order_created", {
        "order_id": order_id,
        "room_number": data.room_number,
        "total": str(total),
        "items": data.items[0].name if data.items else "",
    })
    await publish_event("dashboard_update", {
        "type": "new_order",
        "order_id": order_id,
        "room": data.room_number,
    })
    return order


async def update_order_status(
    db: AsyncSession,
    order_id: int,
    acted_by: str = "unknown",
    note: str = None,
    image_url: str = None,
) -> RoomServiceOrder:
    async with db.begin():
        stmt = select(RoomServiceOrder).where(RoomServiceOrder.id == order_id)
        result = await db.execute(stmt)
        order = result.scalar_one_or_none()

        if not order:
            raise ValueError(f"Order #{order_id} not found")

        next_status = STATUS_PROGRESSION.get(order.status)
        if not next_status:
            raise ValueError(f"Order #{order_id} is already in final status '{order.status.value}'")

        old_status = order.status.value
        changed_at = datetime.now(timezone.utc)
        order.status = next_status

        if next_status == OrderStatus.preparing:
            order.preparing_by = acted_by
            order.preparing_at = changed_at
            if note: order.preparing_note = note
            if image_url: order.preparing_image_url = image_url
        elif next_status == OrderStatus.delivering:
            order.delivering_by = acted_by
            order.delivering_at = changed_at
            if note: order.delivering_note = note
            if image_url: order.delivering_image_url = image_url
        elif next_status == OrderStatus.delivered:
            order.delivered_by = acted_by
            order.delivered_at = changed_at
            if note: order.delivered_note = note
            if image_url: order.delivered_image_url = image_url

    await db.refresh(order)

    room_result = await db.execute(select(Room).where(Room.id == order.room_id))
    room = room_result.scalar_one()

    await publish_event("order_status_changed", {
        "order_id": order_id,
        "room_number": room.number,
        "old_status": old_status,
        "new_status": next_status.value,
    })
    await publish_event("dashboard_update", {
        "type": "order_status",
        "order_id": order_id,
        "status": next_status.value,
    })
    return order


def _order_to_dict(order: RoomServiceOrder, room: Room) -> dict:
    return {
        "id": order.id,
        "room_id": room.number,
        "room_number": room.number,
        "items": order.items,
        "total_price": order.total_price,
        "status": order.status.value,
        "ordered_by": order.ordered_by,
        "preparing_by": order.preparing_by,
        "preparing_at": order.preparing_at,
        "preparing_note": order.preparing_note,
        "preparing_image_url": order.preparing_image_url,
        "delivering_by": order.delivering_by,
        "delivering_at": order.delivering_at,
        "delivering_note": order.delivering_note,
        "delivering_image_url": order.delivering_image_url,
        "delivered_by": order.delivered_by,
        "delivered_at": order.delivered_at,
        "delivered_note": order.delivered_note,
        "delivered_image_url": order.delivered_image_url,
        "created_at": order.created_at,
        "updated_at": order.updated_at,
    }


async def get_active_orders(db: AsyncSession) -> list[dict]:
    stmt = (
        select(RoomServiceOrder, Room)
        .join(Room, RoomServiceOrder.room_id == Room.id)
        .where(RoomServiceOrder.status != OrderStatus.delivered)
    )
    result = await db.execute(stmt)
    return [_order_to_dict(o, r) for o, r in result.all()]


async def get_completed_orders(db: AsyncSession) -> list[dict]:
    stmt = (
        select(RoomServiceOrder, Room)
        .join(Room, RoomServiceOrder.room_id == Room.id)
        .where(RoomServiceOrder.status == OrderStatus.delivered)
        .order_by(RoomServiceOrder.updated_at.desc(), RoomServiceOrder.created_at.desc())
    )
    result = await db.execute(stmt)
    return [_order_to_dict(o, r) for o, r in result.all()]
