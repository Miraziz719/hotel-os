"""Add planned_check_out to bookings

Revision ID: 011
Revises: 010
Create Date: 2026-06-06
"""
from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("bookings", sa.Column("planned_check_out", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("bookings", "planned_check_out")
