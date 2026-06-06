"""Create one test user per role. Run once: python -m app.seed_users"""
import asyncio
from app.database import AsyncSessionLocal
from app.models import User, UserRole
from app.auth import hashPassword

TEST_USERS = [
    {"username": "admin",        "password": "admin",        "role": UserRole.admin},
    {"username": "reception",    "password": "reception",    "role": UserRole.reception},
    # Housekeeping (Room Service)
    {"username": "cleaner1",     "password": "cleaner1",     "role": UserRole.housekeeping},
    {"username": "cleaner2",     "password": "cleaner2",     "role": UserRole.housekeeping},
    # Kitchen (Room Service food)
    {"username": "kitchen",      "password": "kitchen",      "role": UserRole.room_service},
    # Maintenance (Problems)
    {"username": "technician1",  "password": "technician1",  "role": UserRole.maintenance},
    {"username": "technician2",  "password": "technician2",  "role": UserRole.maintenance},
]


async def seedUsers():
    async with AsyncSessionLocal() as db:
        for userData in TEST_USERS:
            user = User(
                username=userData["username"],
                hashed_password=hashPassword(userData["password"]),
                role=userData["role"],
            )
            db.add(user)
        await db.commit()
    print("Test users created:")
    for u in TEST_USERS:
        print(f"  {u['role'].value:15} → {u['username']:15} / {u['password']}")


if __name__ == "__main__":
    asyncio.run(seedUsers())
