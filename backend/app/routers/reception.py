from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import requireRoles
from app.database import get_db
from app.models import Room, RoomType
from app.schemas import CheckInRequest, CheckInResponse, CheckOutRequest, CheckOutResponse
from app.services import reception as svc

router = APIRouter(prefix="/reception", tags=["Reception"])

_receptionAccess = requireRoles("reception", "admin")


@router.post("/check-in", response_model=CheckInResponse)
async def check_in(
    data: CheckInRequest,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_receptionAccess),
):
    try:
        result = await svc.check_in(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return CheckInResponse(
        booking_id=result["booking"].id,
        guest=result["guest"],
        room=result["room"],
        message=f"Check-in successful. Room {result['room'].number} assigned.",
    )


@router.post("/check-out", response_model=CheckOutResponse)
async def check_out(
    data: CheckOutRequest,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_receptionAccess),
):
    try:
        invoice = await svc.check_out(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return CheckOutResponse(message=f"Check-out complete. Total: ${invoice.total}", invoice=invoice)


@router.get("/rooms")
async def list_rooms(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_receptionAccess),
):
    from sqlalchemy import select

    result = await db.execute(select(Room).order_by(Room.number))
    return result.scalars().all()


@router.get("/available-rooms")
async def available_rooms(
    room_type: RoomType | None = None,
    floor: int | None = None,
    near_lift: bool | None = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_receptionAccess),
):
    return await svc.get_available_rooms(db, room_type, floor, near_lift)


@router.get("/occupied-rooms")
async def occupied_rooms(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_receptionAccess),
):
    return await svc.get_occupied_rooms(db)


@router.get("/guest-history")
async def guest_history(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_receptionAccess),
):
    return await svc.get_guest_history(db)


@router.get("/checkout-preview/{room_number}")
async def checkout_preview(
    room_number: str,
    discount: float = 0,
    extra_charges: float = 0,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(_receptionAccess),
):
    try:
        return await svc.get_checkout_preview(
            db,
            room_number,
            Decimal(str(discount)),
            Decimal(str(extra_charges)),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
