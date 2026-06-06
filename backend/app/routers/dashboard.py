"""Dashboard router вЂ” real-time hotel state via REST + WebSocket. JWT admin only."""
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import jwt

from app.config import settings
from app.database import get_db
from app.models import Room, RoomServiceOrder, MaintenanceIssue, Booking, Guest
from app.models import OrderStatus, IssueStatus, BookingStatus
from app.websocket_manager import manager
from app.auth import requireRoles, ALGORITHM

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

_adminOnly = requireRoles("admin")


@router.get("/snapshot")
async def snapshot(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_adminOnly),
):
    rooms_result = await db.execute(select(Room).order_by(Room.number))
    rooms = rooms_result.scalars().all()

    orders_result = await db.execute(
        select(RoomServiceOrder).where(RoomServiceOrder.status != OrderStatus.delivered)
    )
    orders = orders_result.scalars().all()

    issues_result = await db.execute(
        select(MaintenanceIssue).where(MaintenanceIssue.status != IssueStatus.resolved)
    )
    issues = issues_result.scalars().all()

    bookings_result = await db.execute(
        select(Booking, Guest)
        .join(Guest, Booking.guest_id == Guest.id)
        .where(Booking.status == BookingStatus.active)
    )
    active_bookings = [
        {"booking_id": b.id, "guest": g.full_name, "room_id": b.room_id}
        for b, g in bookings_result.all()
    ]

    return {
        "rooms": [{"number": r.number, "floor": r.floor, "type": r.room_type.value, "status": r.status.value} for r in rooms],
        "active_orders": [{"id": o.id, "room_id": o.room_id, "status": o.status.value, "total": str(o.total_price)} for o in orders],
        "open_issues": [{"id": i.id, "room_id": i.room_id, "urgency": i.urgency.value, "description": i.description[:60]} for i in issues],
        "active_bookings": active_bookings,
    }


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(default="")):
    """WebSocket for real-time updates. Pass JWT as ?token= query param."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        if not payload.get("role"):
            await websocket.close(code=4003)
            return
    except Exception:
        await websocket.close(code=4001)
        return

    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)

