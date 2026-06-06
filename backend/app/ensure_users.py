"""Ensure all staff users exist with correct credentials. Safe to run multiple times."""
import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import User, UserRole
from app.auth import hashPassword

USERS = [
    {"username": "admin",       "password": "admin",       "role": UserRole.admin},
    {"username": "reception",   "password": "reception",   "role": UserRole.reception},
    {"username": "cleaner1",    "password": "cleaner1",    "role": UserRole.housekeeping},
    {"username": "cleaner2",    "password": "cleaner2",    "role": UserRole.housekeeping},
    {"username": "kitchen",     "password": "kitchen",     "role": UserRole.room_service},
    {"username": "technician1", "password": "technician1", "role": UserRole.maintenance},
    {"username": "technician2", "password": "technician2", "role": UserRole.maintenance},
]


async def run():
    async with AsyncSessionLocal() as db:
        async with db.begin():
            for u in USERS:
                result = await db.execute(
                    select(User).where(User.username == u["username"])
                )
                user = result.scalar_one_or_none()
                if user:
                    user.hashed_password = hashPassword(u["password"])
                    user.role = u["role"]
                    user.is_active = True
                    print(f"  ✓ yangilandi:  {u['username']:15} / {u['password']}")
                else:
                    db.add(User(
                        username=u["username"],
                        hashed_password=hashPassword(u["password"]),
                        role=u["role"],
                        is_active=True,
                    ))
                    print(f"  + yaratildi:   {u['username']:15} / {u['password']}")

    print("\nBarcha foydalanuvchilar tayyor.")
    print("\nLogin ma'lumotlari:")
    print(f"  {'Rol':20} {'Login':15} Parol")
    print(f"  {'-'*50}")
    for u in USERS:
        print(f"  {u['role'].value:20} {u['username']:15} {u['password']}")


if __name__ == "__main__":
    asyncio.run(run())
