"""
Event Subscriber
----------------
Runs as a background task on startup.
Listens to ALL Redis channels and routes events to the correct service handler.
This is the glue that makes the services communicate without calling each other directly.
"""
import asyncio
import json

from app.redis_client import subscribe_to_channels, CHANNELS
from app.websocket_manager import manager


async def handle_event(channel: str, data: dict) -> None:
    """Route an incoming event to the appropriate handler."""

    if channel == CHANNELS["room_released"]:
        # Housekeeping: room was released в†’ add to cleaning queue
        from app.services.housekeeping import add_to_cleaning_queue
        room_number = data.get("room_number")
        if room_number:
            await add_to_cleaning_queue(room_number)

    elif channel == CHANNELS["dashboard_update"]:
        # Broadcast every dashboard.update event to all WebSocket clients
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


async def start_subscriber() -> None:
    """
    Subscribe to all channels.
    Called once at application startup as an asyncio background task.
    """
    all_channels = list(CHANNELS.values())
    print(f"[Subscriber] Listening on channels: {all_channels}")
    await subscribe_to_channels(all_channels, handle_event)

