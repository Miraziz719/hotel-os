"""Add image_url to maintenance_issues and rooms

Revision ID: 007
Revises: 006
Create Date: 2026-06-04
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("maintenance_issues", sa.Column("image_url", sa.String(500), nullable=True))
    op.add_column("rooms", sa.Column("last_clean_image_url", sa.String(500), nullable=True))


def downgrade():
    op.drop_column("maintenance_issues", "image_url")
    op.drop_column("rooms", "last_clean_image_url")
