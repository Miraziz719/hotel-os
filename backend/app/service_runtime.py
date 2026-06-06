import asyncio
from contextlib import asynccontextmanager

from app.redis_client import CHANNELS, consume_events
from app.services.housekeeping import add_to_cleaning_queue, init_cleaning_queue
from app.services.maintenance import init_issue_heap
from app.websocket_manager import manager


async def _housekeeping_event_handler(event_key: str, data: dict) -> None:
    if event_key == "room_released":
        room_number = data.get("room_number")
        if room_number:
            await add_to_cleaning_queue(room_number)


async def _realtime_event_handler(event_key: str, data: dict) -> None:
    channel = CHANNELS.get(event_key, event_key)
    if channel == CHANNELS["dashboard_update"]:
        await manager.broadcast({"event": "dashboard_update", "data": data})
    elif channel == CHANNELS["room_status_changed"]:
        await manager.broadcast({"event": "room_status_changed", "data": data})
    elif channel == CHANNELS["guest_checked_in"]:
        await manager.broadcast({"event": "guest_checked_in", "data": data})
    elif channel == CHANNELS["guest_checked_out"]:
        await manager.broadcast({"event": "guest_checked_out", "data": data})
    elif channel == CHANNELS["order_created"]:
        await manager.broadcast({"event": "order_created", "data": data})
    elif channel == CHANNELS["order_status_changed"]:
        await manager.broadcast({"event": "order_status_changed", "data": data})
    elif channel == CHANNELS["issue_created"]:
        await manager.broadcast({"event": "issue_created", "data": data})
    elif channel == CHANNELS["issue_resolved"]:
        await manager.broadcast({"event": "issue_resolved", "data": data})
    elif channel == CHANNELS["housekeeping_requested"]:
        await manager.broadcast({"event": "housekeeping_requested", "data": data})


@asynccontextmanager
async def reception_lifespan(app):
    task = asyncio.create_task(
        consume_events(
            service_name="reception-realtime",
            event_keys=[
                "dashboard_update",
                "room_status_changed",
                "guest_checked_in",
                "guest_checked_out",
                "order_created",
                "order_status_changed",
                "issue_created",
                "issue_resolved",
                "housekeeping_requested",
            ],
            callback=_realtime_event_handler,
            start_id="$",
        )
    )
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


@asynccontextmanager
async def housekeeping_lifespan(app):
    await init_cleaning_queue()
    task = asyncio.create_task(
        consume_events(
            service_name="housekeeping",
            event_keys=["room_released"],
            callback=_housekeeping_event_handler,
            start_id="0",
        )
    )
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


@asynccontextmanager
async def maintenance_lifespan(app):
    await init_issue_heap()
    yield


@asynccontextmanager
async def room_service_lifespan(app):
    yield
