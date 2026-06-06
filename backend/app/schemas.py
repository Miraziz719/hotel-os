"""
Pydantic schemas for request/response validation.
All user input passes through these before hitting the database.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, EmailStr, field_validator
from app.models import RoomType, RoomStatus, OrderStatus, IssueUrgency, IssueStatus, BookingStatus


# ---------- Room ----------

class RoomOut(BaseModel):
    id: int
    number: str
    floor: int
    room_type: RoomType
    status: RoomStatus
    nightly_rate: Decimal
    near_lift: bool
    last_cleaned_at: Optional[datetime]

    class Config:
        from_attributes = True


# ---------- Guest ----------

class GuestCreate(BaseModel):
    full_name: str
    phone: str
    email: Optional[EmailStr] = None

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("full_name cannot be empty")
        return v.strip()


class GuestOut(BaseModel):
    id: int
    full_name: str
    phone: str
    email: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Check-in ----------

class CheckInRequest(BaseModel):
    guest: GuestCreate
    room_type: RoomType
    room_number: Optional[str] = None
    floor_preference: Optional[int] = None    # preferred floor
    lift_preference: Optional[bool] = False   # prefer near lift/stairs

    @field_validator("floor_preference")
    @classmethod
    def floor_range(cls, v):
        if v is not None and (v < 1 or v > 20):
            raise ValueError("floor_preference must be between 1 and 20")
        return v

    @field_validator("room_number")
    @classmethod
    def room_number_optional_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not v.strip():
            raise ValueError("room_number cannot be empty")
        return v.strip()


class CheckInResponse(BaseModel):
    booking_id: int
    guest: GuestOut
    room: RoomOut
    message: str


# ---------- Check-out ----------

class CheckOutRequest(BaseModel):
    room_number: str
    discount: Optional[Decimal] = Decimal("0.00")
    extra_charges: Optional[Decimal] = Decimal("0.00")
    extra_charge_reason: Optional[str] = None

    @field_validator("room_number")
    @classmethod
    def room_number_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("room_number cannot be empty")
        return v.strip()


class InvoiceOut(BaseModel):
    id: int
    booking_id: int
    room_charges: Decimal
    service_charges: Decimal
    extra_charges: Decimal
    discount: Decimal
    total: Decimal

    class Config:
        from_attributes = True


class CheckOutResponse(BaseModel):
    message: str
    invoice: InvoiceOut


# ---------- Room Service ----------

class OrderItem(BaseModel):
    name: str
    quantity: int
    unit_price: Decimal

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v):
        if v < 1:
            raise ValueError("quantity must be at least 1")
        return v


class RoomServiceOrderCreate(BaseModel):
    room_number: str
    items: List[OrderItem]

    @field_validator("room_number")
    @classmethod
    def room_number_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("room_number cannot be empty")
        return v.strip()


class OrderStatusUpdate(BaseModel):
    order_id: int
    new_status: OrderStatus


class OrderOut(BaseModel):
    id: int
    room_id: int
    items: str
    total_price: Decimal
    status: OrderStatus
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Maintenance ----------

class MaintenanceIssueCreate(BaseModel):
    room_number: str
    description: str
    urgency: IssueUrgency = IssueUrgency.normal
    image_url: Optional[str] = None

    @field_validator("description")
    @classmethod
    def desc_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("description cannot be empty")
        return v.strip()


class IssueResolveRequest(BaseModel):
    issue_id: int
    technician: str


class OrderAdvanceRequest(BaseModel):
    note: Optional[str] = None
    image_url: Optional[str] = None


class IssueAdvanceRequest(BaseModel):
    resolution_note: Optional[str] = None
    resolution_image_url: Optional[str] = None


class IssueOut(BaseModel):
    id: int
    room_id: int
    description: str
    urgency: IssueUrgency
    status: IssueStatus
    technician: Optional[str]
    reported_by: Optional[str] = None
    image_url: Optional[str] = None
    resolution_note: Optional[str] = None
    resolution_image_url: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------- Housekeeping ----------

class CleanRoomRequest(BaseModel):
    room_number: str
    image_url: Optional[str] = None
    note: Optional[str] = None


# ---------- Dashboard auth ----------

class DashboardLogin(BaseModel):
    password: str


class TokenResponse(BaseModel):
    token: str


# ---------- Auth ----------

class LoginRequest(BaseModel):
    username: str
    password: str


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: Optional[str] = None
    room_number: Optional[str] = None


# ---------- Dashboard snapshot ----------

class DashboardSnapshot(BaseModel):
    rooms: List[RoomOut]
    active_orders: List[OrderOut]
    open_issues: List[IssueOut]
    active_bookings: List[dict]

