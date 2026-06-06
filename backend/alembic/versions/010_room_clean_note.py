"""Add last_clean_note to rooms

Revision ID: 010
Revises: 009
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("rooms", sa.Column("last_clean_note", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("rooms", "last_clean_note")
