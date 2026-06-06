"""Add room service audit fields

Revision ID: 005
Revises: 004
Create Date: 2026-06-04 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("room_service_orders", sa.Column("preparing_by", sa.String(100), nullable=True))
    op.add_column("room_service_orders", sa.Column("preparing_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("room_service_orders", sa.Column("delivering_by", sa.String(100), nullable=True))
    op.add_column("room_service_orders", sa.Column("delivering_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("room_service_orders", sa.Column("delivered_by", sa.String(100), nullable=True))
    op.add_column("room_service_orders", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("room_service_orders", "delivered_at")
    op.drop_column("room_service_orders", "delivered_by")
    op.drop_column("room_service_orders", "delivering_at")
    op.drop_column("room_service_orders", "delivering_by")
    op.drop_column("room_service_orders", "preparing_at")
    op.drop_column("room_service_orders", "preparing_by")
