"""
Legacy compatibility wrapper for the old subscriber module.

Reception now handles realtime fan-out and Housekeeping consumes brokered
events in its own process, so this module is only kept to avoid broken imports.
"""

from app.redis_client import consume_events
from app.service_runtime import _realtime_event_handler


async def handle_event(event_key: str, data: dict) -> None:
    await _realtime_event_handler(event_key, data)


async def start_subscriber() -> None:
    await consume_events(
        service_name="legacy-realtime",
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
        callback=handle_event,
        start_id="$",
    )
