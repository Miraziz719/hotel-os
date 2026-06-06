"""
SQLAlchemy ORM models for HotelOS.
Each class maps directly to a PostgreSQL table.
"""
import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Column, Integer, String, Numeric, DateTime, ForeignKey,
    Enum as SAEnum, Boolean, Text, func
)
from sqlalchemy.orm import relationship
from app.database import Base


# ---------- Enums ----------

class RoomType(str, enum.Enum):
    single = "single"
    double = "double"
    suite = "suite"
    accessible = "accessible"


class RoomStatus(str, enum.Enum):
    clean = "clean"
    dirty = "dirty"
    cleaning = "cleaning"
    maintenance = "maintenance"
    occupied = "occupied"


class BookingStatus(str, enum.Enum):
    active = "active"
    checked_out = "checked_out"
    cancelled = "cancelled"


class OrderStatus(str, enum.Enum):
    received = "received"
    preparing = "preparing"
    delivering = "delivering"
    delivered = "delivered"


class IssueUrgency(str, enum.Enum):
    critical = "critical"
    high = "high"
    normal = "normal"
    low = "low"


class IssueStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"


class UserRole(str, enum.Enum):
    admin = "admin"
    reception = "reception"
    housekeeping = "housekeeping"
    room_service = "room_service"
    maintenance = "maintenance"
    guest = "guest"



class User:
    def get_dashboard(self):
        return "Common dashboard"

class Admin(User):
    def get_dashboard(self):
        return "Admin dashboard"

class Reception(User):
    def get_dashboard(self):
        return "Reception dashboard"

class Housekeeping(User):
    def get_dashboard(self):
        return "Housekeeping dashboard"
# ---------- Tables ----------

class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True)
    number = Column(String(10), unique=True, nullable=False)   # e.g. "204"
    floor = Column(Integer, nullable=False)
    room_type = Column(SAEnum(RoomType), nullable=False)
    status = Column(SAEnum(RoomStatus), default=RoomStatus.clean, nullable=False)
    nightly_rate = Column(Numeric(10, 2), nullable=False)
    near_lift = Column(Boolean, default=False)
    last_cleaned_at = Column(DateTime(timezone=True), default=func.now())
    cleaned_by = Column(String(100), nullable=True)
    last_clean_note = Column(Text, nullable=True)
    last_clean_image_url = Column(String(500), nullable=True)

    bookings = relationship("Booking", back_populates="room")
    orders = relationship("RoomServiceOrder", back_populates="room")
    issues = relationship("MaintenanceIssue", back_populates="room")


class Guest(Base):
    __tablename__ = "guests"

    id = Column(Integer, primary_key=True)
    full_name = Column(String(120), nullable=False)
    phone = Column(String(30), nullable=False, unique=True)
    email = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())

    bookings = relationship("Booking", back_populates="guest")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    check_in = Column(DateTime(timezone=True), default=func.now())
    check_out = Column(DateTime(timezone=True), nullable=True)
    status = Column(SAEnum(BookingStatus), default=BookingStatus.active)
    # Preferences stored at booking time
    floor_preference = Column(Integer, nullable=True)
    lift_preference = Column(Boolean, default=False)

    guest = relationship("Guest", back_populates="bookings")
    room = relationship("Room", back_populates="bookings")
    invoice = relationship("Invoice", back_populates="booking", uselist=False)


class RoomServiceOrder(Base):
    __tablename__ = "room_service_orders"

    id = Column(Integer, primary_key=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    items = Column(Text, nullable=False)          # JSON string of items
    total_price = Column(Numeric(10, 2), default=0)
    status = Column(SAEnum(OrderStatus), default=OrderStatus.received)
    ordered_by = Column(String(100), nullable=True)   # who placed the order
    preparing_by = Column(String(100), nullable=True)
    preparing_at = Column(DateTime(timezone=True), nullable=True)
    preparing_note = Column(Text, nullable=True)
    preparing_image_url = Column(String(500), nullable=True)
    delivering_by = Column(String(100), nullable=True)
    delivering_at = Column(DateTime(timezone=True), nullable=True)
    delivering_note = Column(Text, nullable=True)
    delivering_image_url = Column(String(500), nullable=True)
    delivered_by = Column(String(100), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    delivered_note = Column(Text, nullable=True)
    delivered_image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    room = relationship("Room", back_populates="orders")


class MaintenanceIssue(Base):
    __tablename__ = "maintenance_issues"

    id = Column(Integer, primary_key=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    description = Column(Text, nullable=False)
    urgency = Column(SAEnum(IssueUrgency), default=IssueUrgency.normal)
    status = Column(SAEnum(IssueStatus), default=IssueStatus.open)
    technician = Column(String(100), nullable=True)
    reported_by = Column(String(100), nullable=True)
    image_url = Column(String(500), nullable=True)
    resolution_note = Column(Text, nullable=True)
    resolution_image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    room = relationship("Room", back_populates="issues")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), unique=True, nullable=False)
    room_charges = Column(Numeric(10, 2), default=0)     # nightly rate Г— nights
    service_charges = Column(Numeric(10, 2), default=0)  # room service total
    extra_charges = Column(Numeric(10, 2), default=0)    # minibar, late checkout, etc.
    discount = Column(Numeric(10, 2), default=0)
    total = Column(Numeric(10, 2), default=0)
    created_at = Column(DateTime(timezone=True), default=func.now())

    booking = relationship("Booking", back_populates="invoice")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(SAEnum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=func.now())

