"""Initial schema вЂ“ all HotelOS tables

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # --- rooms ---
    op.create_table(
        "rooms",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("number", sa.String(10), nullable=False, unique=True),
        sa.Column("floor", sa.Integer(), nullable=False),
        sa.Column("room_type", sa.Enum("single", "double", "suite", "accessible", name="roomtype"), nullable=False),
        sa.Column("status", sa.Enum("clean", "dirty", "cleaning", "maintenance", "occupied", name="roomstatus"),
                  nullable=False, server_default="clean"),
        sa.Column("nightly_rate", sa.Numeric(10, 2), nullable=False),
        sa.Column("near_lift", sa.Boolean(), server_default="false"),
        sa.Column("last_cleaned_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- guests ---
    op.create_table(
        "guests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(200), nullable=False, unique=True),
        sa.Column("phone", sa.String(30)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- bookings ---
    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guest_id", sa.Integer(), sa.ForeignKey("guests.id"), nullable=False),
        sa.Column("room_id", sa.Integer(), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("check_in", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("check_out", sa.DateTime(timezone=True)),
        sa.Column("status", sa.Enum("active", "checked_out", "cancelled", name="bookingstatus"),
                  server_default="active"),
        sa.Column("floor_preference", sa.Integer()),
        sa.Column("lift_preference", sa.Boolean(), server_default="false"),
    )

    # --- room_service_orders ---
    op.create_table(
        "room_service_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("room_id", sa.Integer(), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("items", sa.Text(), nullable=False),
        sa.Column("total_price", sa.Numeric(10, 2), server_default="0"),
        sa.Column("status", sa.Enum("received", "preparing", "delivering", "delivered", name="orderstatus"),
                  server_default="received"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- maintenance_issues ---
    op.create_table(
        "maintenance_issues",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("room_id", sa.Integer(), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("urgency", sa.Enum("critical", "high", "normal", "low", name="issueurgency"),
                  server_default="normal"),
        sa.Column("status", sa.Enum("open", "in_progress", "resolved", name="issuestatus"),
                  server_default="open"),
        sa.Column("technician", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
    )

    # --- invoices ---
    op.create_table(
        "invoices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id"), unique=True, nullable=False),
        sa.Column("room_charges", sa.Numeric(10, 2), server_default="0"),
        sa.Column("service_charges", sa.Numeric(10, 2), server_default="0"),
        sa.Column("extra_charges", sa.Numeric(10, 2), server_default="0"),
        sa.Column("discount", sa.Numeric(10, 2), server_default="0"),
        sa.Column("total", sa.Numeric(10, 2), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Seed 10 demo rooms
    op.execute("""
    INSERT INTO rooms (number, floor, room_type, status, nightly_rate, near_lift, last_cleaned_at) VALUES
    ('101', 1, 'single',     'clean', 80.00,  false, NOW() - INTERVAL '5 hours'),
    ('102', 1, 'double',     'clean', 120.00, true,  NOW() - INTERVAL '3 hours'),
    ('103', 1, 'accessible', 'clean', 100.00, true,  NOW() - INTERVAL '1 hour'),
    ('201', 2, 'single',     'clean', 85.00,  false, NOW() - INTERVAL '6 hours'),
    ('202', 2, 'double',     'clean', 130.00, false, NOW() - INTERVAL '4 hours'),
    ('203', 2, 'suite',      'clean', 250.00, true,  NOW() - INTERVAL '2 hours'),
    ('204', 2, 'double',     'clean', 130.00, false, NOW() - INTERVAL '7 hours'),
    ('301', 3, 'double',     'clean', 140.00, true,  NOW() - INTERVAL '8 hours'),
    ('302', 3, 'suite',      'clean', 270.00, false, NOW() - INTERVAL '2 hours'),
    ('115', 1, 'single',     'clean', 80.00,  false, NOW() - INTERVAL '9 hours')
    """)


def downgrade():
    op.drop_table("invoices")
    op.drop_table("maintenance_issues")
    op.drop_table("room_service_orders")
    op.drop_table("bookings")
    op.drop_table("guests")
    op.drop_table("rooms")
    op.execute("DROP TYPE IF EXISTS roomtype")
    op.execute("DROP TYPE IF EXISTS roomstatus")
    op.execute("DROP TYPE IF EXISTS bookingstatus")
    op.execute("DROP TYPE IF EXISTS orderstatus")
    op.execute("DROP TYPE IF EXISTS issueurgency")
    op.execute("DROP TYPE IF EXISTS issuestatus")

