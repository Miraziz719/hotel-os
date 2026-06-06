"""Add resolution_note and resolution_image_url to maintenance_issues

Revision ID: 008
Revises: 007
Create Date: 2026-06-04
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("maintenance_issues", sa.Column("resolution_note", sa.Text(), nullable=True))
    op.add_column("maintenance_issues", sa.Column("resolution_image_url", sa.String(500), nullable=True))


def downgrade():
    op.drop_column("maintenance_issues", "resolution_note")
    op.drop_column("maintenance_issues", "resolution_image_url")
