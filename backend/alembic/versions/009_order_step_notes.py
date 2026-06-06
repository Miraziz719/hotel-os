"""Add note and image_url fields to room_service_orders per step

Revision ID: 009
Revises: 008
Create Date: 2026-06-04
"""
from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("room_service_orders", sa.Column("preparing_note", sa.Text(), nullable=True))
    op.add_column("room_service_orders", sa.Column("preparing_image_url", sa.String(500), nullable=True))
    op.add_column("room_service_orders", sa.Column("delivering_note", sa.Text(), nullable=True))
    op.add_column("room_service_orders", sa.Column("delivering_image_url", sa.String(500), nullable=True))
    op.add_column("room_service_orders", sa.Column("delivered_note", sa.Text(), nullable=True))
    op.add_column("room_service_orders", sa.Column("delivered_image_url", sa.String(500), nullable=True))


def downgrade():
    op.drop_column("room_service_orders", "preparing_note")
    op.drop_column("room_service_orders", "preparing_image_url")
    op.drop_column("room_service_orders", "delivering_note")
    op.drop_column("room_service_orders", "delivering_image_url")
    op.drop_column("room_service_orders", "delivered_note")
    op.drop_column("room_service_orders", "delivered_image_url")
