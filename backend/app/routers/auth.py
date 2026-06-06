"""Auth router вЂ” unified login for all roles including guests."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, Guest, Booking, Room, BookingStatus, UserRole
from app.schemas import LoginRequest, AuthTokenResponse
from app.auth import verifyPassword, createToken, getCurrentUser

router = APIRouter(prefix="/auth", tags=["Auth"])


async def _build_guest_payload(db: AsyncSession, user: User) -> tuple[dict, str | None]:
    """Build JWT payload for a guest, attaching room info if they are checked in."""
    payload = {"sub": str(user.id), "role": user.role.value, "username": user.username}
    roomNumber = None
    guestResult = await db.execute(select(Guest).where(Guest.phone == user.username))
    guest = guestResult.scalar_one_or_none()
    if guest:
        payload["username"] = guest.full_name
        bookingResult = await db.execute(
            select(Booking).where(
                Booking.guest_id == guest.id,
                Booking.status == BookingStatus.active,
            )
        )
        booking = bookingResult.scalar_one_or_none()
        if booking:
            roomResult = await db.execute(select(Room).where(Room.id == booking.room_id))
            room = roomResult.scalar_one()
            roomNumber = room.number
            payload["room_number"] = roomNumber
            payload["booking_id"] = booking.id
    return payload, roomNumber


@router.post("/login", response_model=AuthTokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Unified login for all roles.
    Staff : username + password
    Guest : phone number + PIN (set by reception at check-in)
    """
    result = await db.execute(
        select(User).where(User.username == data.username, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user or not verifyPassword(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Username/telefon yoki parol noto'g'ri")

    # Guests can always log in. Room services are only available while they
    # have an active booking — otherwise they must check in first.
    if user.role == UserRole.guest:
        payload, roomNumber = await _build_guest_payload(db, user)
    else:
        payload = {"sub": str(user.id), "role": user.role.value, "username": user.username}
        roomNumber = None

    token = createToken(payload)
    return AuthTokenResponse(
        access_token=token,
        role=user.role.value,
        username=payload.get("username", user.username),
        room_number=roomNumber,
    )


@router.post("/refresh", response_model=AuthTokenResponse)
async def refresh(currentUser: dict = Depends(getCurrentUser), db: AsyncSession = Depends(get_db)):
    """Re-issue a token with up-to-date booking info (e.g. after the guest is checked in)."""
    result = await db.execute(
        select(User).where(User.id == int(currentUser["sub"]), User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Foydalanuvchi topilmadi")

    if user.role == UserRole.guest:
        payload, roomNumber = await _build_guest_payload(db, user)
    else:
        payload = {"sub": str(user.id), "role": user.role.value, "username": user.username}
        roomNumber = None

    token = createToken(payload)
    return AuthTokenResponse(
        access_token=token,
        role=user.role.value,
        username=payload.get("username", user.username),
        room_number=roomNumber,
    )

