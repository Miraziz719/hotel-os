from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import getCurrentUser, requireRoles
from app.database import get_db
from app.schemas import OrderOut, RoomServiceOrderCreate, OrderAdvanceRequest
from app.services import room_service as svc

router = APIRouter(prefix="/room-service", tags=["Room Service"])

_staffAccess = requireRoles("room_service", "admin")
_orderAccess = requireRoles("room_service", "reception", "admin", "guest")


@router.post("/order", response_model=OrderOut)
async def place_order(
    data: RoomServiceOrderCreate,
    db: AsyncSession = Depends(get_db),
    currentUser: dict = Depends(_orderAccess),
):
    role = currentUser.get("role")

    if role == "guest":
        guestRoom = currentUser.get("room_number")
        if data.room_number != guestRoom:
            raise HTTPException(status_code=403, detail=f"Siz faqat {guestRoom}-xona uchun buyurtma bera olasiz")
        from app.services.reception import has_active_booking
        if not await has_active_booking(db, guestRoom):
            raise HTTPException(status_code=403, detail="Siz check-out qilgansiz. Buyurtma berish uchun check-in holatida bo'lishingiz kerak.")

    orderedBy = currentUser.get("username", role)
    if role == "reception":
        orderedBy = f"reception ({orderedBy})"
    elif role == "guest":
        orderedBy = f"guest ({orderedBy})"
    elif role == "room_service":
        orderedBy = f"room_service ({orderedBy})"
    elif role == "admin":
        orderedBy = f"admin ({orderedBy})"

    try:
        order = await svc.create_order(db, data, orderedBy)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return order


@router.post("/order/{order_id}/advance")
async def advance_order(
    order_id: int,
    data: OrderAdvanceRequest = OrderAdvanceRequest(),
    db: AsyncSession = Depends(get_db),
    currentUser: dict = Depends(_staffAccess),
):
    actor = f"{currentUser.get('role')} ({currentUser.get('username', 'unknown')})"
    try:
        order = await svc.update_order_status(db, order_id, actor, data.note, data.image_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": f"Order #{order_id} is now '{order.status.value}'", "order": order}


@router.get("/active")
async def active_orders(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(requireRoles("room_service", "reception", "admin")),
):
    return await svc.get_active_orders(db)


@router.get("/completed")
async def completed_orders(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(requireRoles("room_service", "reception", "admin")),
):
    return await svc.get_completed_orders(db)


@router.get("/rooms")
async def list_rooms(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(requireRoles("room_service", "reception", "admin")),
):
    from sqlalchemy import select
    from app.models import Room

    result = await db.execute(select(Room).order_by(Room.number))
    return result.scalars().all()


@router.get("/my-orders")
async def myOrders(
    db: AsyncSession = Depends(get_db),
    currentUser: dict = Depends(requireRoles("guest")),
):
    from sqlalchemy import select
    from app.models import Room, RoomServiceOrder

    roomNumber = currentUser.get("room_number")
    roomResult = await db.execute(select(Room).where(Room.number == roomNumber))
    room = roomResult.scalar_one_or_none()
    if not room:
        return []

    result = await db.execute(
        select(RoomServiceOrder)
        .where(RoomServiceOrder.room_id == room.id)
        .order_by(RoomServiceOrder.created_at.desc())
    )
    from app.services.room_service import _order_to_dict
    return [_order_to_dict(o, room) for o in result.scalars().all()]
