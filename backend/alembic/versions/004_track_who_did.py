"""Track who performed housekeeping and maintenance actions

Revision ID: 004
Revises: 003
Create Date: 2024-01-04 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("rooms", sa.Column("cleaned_by", sa.String(100), nullable=True))
    op.add_column("maintenance_issues", sa.Column("reported_by", sa.String(100), nullable=True))


def downgrade():
    op.drop_column("rooms", "cleaned_by")
    op.drop_column("maintenance_issues", "reported_by")

