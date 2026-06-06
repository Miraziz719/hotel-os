"""Add ordered_by column to room_service_orders

Revision ID: 003
Revises: 002
Create Date: 2024-01-03 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "room_service_orders",
        sa.Column("ordered_by", sa.String(100), nullable=True),
    )


def downgrade():
    op.drop_column("room_service_orders", "ordered_by")

