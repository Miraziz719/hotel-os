"""Guest: phone required, email optional

Revision ID: 006
Revises: 005
Create Date: 2026-06-04
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    # Set placeholder phone for any existing rows with NULL phone
    op.execute("UPDATE guests SET phone = CONCAT('+000000', id::text) WHERE phone IS NULL")

    # Drop old unique constraint on email
    op.drop_constraint("guests_email_key", "guests", type_="unique")

    # Make email nullable
    op.alter_column("guests", "email", nullable=True)

    # Make phone NOT NULL and unique
    op.alter_column("guests", "phone", nullable=False)
    op.create_unique_constraint("guests_phone_key", "guests", ["phone"])


def downgrade():
    op.drop_constraint("guests_phone_key", "guests", type_="unique")
    op.alter_column("guests", "phone", nullable=True)
    op.alter_column("guests", "email", nullable=False)
    op.create_unique_constraint("guests_email_key", "guests", ["email"])
