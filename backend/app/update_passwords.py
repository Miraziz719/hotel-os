"""Update existing staff user credentials. Run: python -m app.update_passwords"""
import asyncio
from sqlalchemy import select, update
from app.database import AsyncSessionLocal
from app.models import User, UserRole
from app.auth import hashPassword

UPDATES = [
    {"old_username": "admin",        "new_username": "admin",       "password": "admin",       "role": UserRole.admin},
    {"old_username": "reception1",   "new_username": "reception",   "password": "reception",   "role": UserRole.reception},
    {"old_username": "reception",    "new_username": "reception",   "password": "reception",   "role": UserRole.reception},
    # Housekeeping → cleaner1 / cleaner2
    {"old_username": "housekeeping1","new_username": "cleaner1",    "password": "cleaner1",    "role": UserRole.housekeeping},
    {"old_username": "housekeeping", "new_username": "cleaner1",    "password": "cleaner1",    "role": UserRole.housekeeping},
    {"old_username": "roomservice",  "new_username": "cleaner1",    "password": "cleaner1",    "role": UserRole.housekeeping},
    # Kitchen stays
    {"old_username": "roomservice1", "new_username": "kitchen",     "password": "kitchen",     "role": UserRole.room_service},
    {"old_username": "kitchen",      "new_username": "kitchen",     "password": "kitchen",     "role": UserRole.room_service},
    # Maintenance → technician1
    {"old_username": "maintenance1", "new_username": "technician1", "password": "technician1", "role": UserRole.maintenance},
    {"old_username": "maintenance",  "new_username": "technician1", "password": "technician1", "role": UserRole.maintenance},
]

# New users to create
NEW_USERS = [
    {"username": "cleaner2",    "password": "cleaner2",    "role": UserRole.housekeeping},
    {"username": "technician2", "password": "technician2", "role": UserRole.maintenance},
]


async def run():
    async with AsyncSessionLocal() as db:
        async with db.begin():
            for u in UPDATES:
                result = await db.execute(
                    select(User).where(User.username == u["old_username"], User.role == u["role"])
                )
                user = result.scalar_one_or_none()
                if user:
                    user.username = u["new_username"]
                    user.hashed_password = hashPassword(u["password"])
                    print(f"  ✓ {u['old_username']:20} → {u['new_username']} / {u['password']}")
                else:
                    print(f"  ✗ '{u['old_username']}' topilmadi — yangi yaratilmoqda")
                    db.add(User(
                        username=u["new_username"],
                        hashed_password=hashPassword(u["password"]),
                        role=u["role"],
                    ))
        # Create new users if they don't exist
        for u in NEW_USERS:
            exists = await db.execute(select(User).where(User.username == u["username"]))
            if not exists.scalar_one_or_none():
                db.add(User(
                    username=u["username"],
                    hashed_password=hashPassword(u["password"]),
                    role=u["role"],
                ))
                print(f"  + Yangi: {u['username']} / {u['password']}")

    print("\nBarcha foydalanuvchilar yangilandi.")


if __name__ == "__main__":
    asyncio.run(run())
