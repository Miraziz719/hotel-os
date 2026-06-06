from app.app_factory import create_service_app
from app.routers import auth, dashboard, housekeeping, maintenance, reception, room_service, upload
from app.service_runtime import (
    housekeeping_lifespan,
    maintenance_lifespan,
    reception_lifespan,
    room_service_lifespan,
)


reception_app = create_service_app(
    service_name="reception",
    title="HotelOS Reception Service",
    lifespan=reception_lifespan,
    mount_uploads=True,
)
reception_app.include_router(auth.router)
reception_app.include_router(upload.router)
reception_app.include_router(reception.router)
reception_app.include_router(dashboard.router)


housekeeping_app = create_service_app(
    service_name="housekeeping",
    title="HotelOS Housekeeping Service",
    lifespan=housekeeping_lifespan,
    mount_uploads=True,
)
housekeeping_app.include_router(housekeeping.router)


room_service_app = create_service_app(
    service_name="room_service",
    title="HotelOS Room Service API",
    lifespan=room_service_lifespan,
    mount_uploads=True,
)
room_service_app.include_router(room_service.router)


maintenance_app = create_service_app(
    service_name="maintenance",
    title="HotelOS Maintenance Service",
    lifespan=maintenance_lifespan,
    mount_uploads=True,
)
maintenance_app.include_router(maintenance.router)
