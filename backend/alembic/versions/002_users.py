"""Add users table with role-based access

Revision ID: 002
Revises: 001
Create Date: 2024-01-02 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(50), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(200), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "admin", "reception", "housekeeping",
                "room_service", "maintenance", "guest",
                name="userrole",
            ),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS userrole")

