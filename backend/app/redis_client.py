"""
Redis Pub/Sub client.
All inter-service communication goes through this module.
"""
import json
import asyncio
from time import monotonic

import redis.asyncio as aioredis
from redis.exceptions import RedisError
from app.config import settings

# Event channel names
CHANNELS = {
    "room_released": "room.released",
    "room_status_changed": "room.statusChanged",
    "guest_checked_in": "guest.checkedIn",
    "guest_checked_out": "guest.checkedOut",
    "order_created": "roomService.orderCreated",
    "order_status_changed": "roomService.statusChanged",
    "issue_created": "maintenance.issueCreated",
    "issue_resolved": "maintenance.issueResolved",
    "dashboard_update": "dashboard.update",
}

_redis_client: aioredis.Redis | None = None
_redis_retry_after = 0.0
REDIS_RETRY_COOLDOWN_SECONDS = 15


async def get_redis() -> aioredis.Redis:
    """Return singleton Redis connection."""
    global _redis_client, _redis_retry_after
    if _redis_retry_after > monotonic():
        raise ConnectionError("Redis temporarily disabled after recent connection failure")

    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.25,
            socket_timeout=0.25,
            retry_on_timeout=False,
            health_check_interval=None,
        )
        try:
            await _redis_client.ping()
        except Exception:
            _redis_client = None
            _redis_retry_after = monotonic() + REDIS_RETRY_COOLDOWN_SECONDS
            raise
    return _redis_client


async def publish_event(channel_key: str, data: dict) -> None:
    """
    Publish a JSON event to a Redis Pub/Sub channel.
    channel_key must be one of the keys in CHANNELS dict.
    """
    try:
        redis = await get_redis()
        channel = CHANNELS.get(channel_key, channel_key)
        payload = json.dumps(data)
        await redis.publish(channel, payload)
    except (RedisError, OSError, ConnectionError) as exc:
        print(f"[Redis] Publish skipped for '{channel_key}': {exc}")


async def subscribe_to_channels(channels: list[str], callback):
    """
    Subscribe to multiple channels and call callback(channel, data) on each message.
    Runs in a background task.
    """
    while True:
        pubsub = None
        try:
            redis = await get_redis()
            pubsub = redis.pubsub()
            await pubsub.subscribe(*channels)

            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                    except json.JSONDecodeError:
                        data = {"raw": message["data"]}
                    await callback(message["channel"], data)
        except asyncio.CancelledError:
            raise
        except (RedisError, OSError, ConnectionError) as exc:
            print(f"[Redis] Subscriber disconnected: {exc}. Retrying in 5s.")
            global _redis_client
            _redis_client = None
            await asyncio.sleep(5)
        finally:
            if pubsub is not None:
                await pubsub.close()

