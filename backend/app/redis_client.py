"""
Redis Streams client.
All inter-service communication goes through this module.
Streams keep messages while a service is offline and deliver them on restart.
"""
import asyncio
import json
from datetime import datetime, timezone
from time import monotonic

import redis.asyncio as aioredis
from redis.exceptions import RedisError, ResponseError

from app.config import settings

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
    "housekeeping_requested": "housekeeping.requested",
}
STREAMS = {key: f"stream:{channel}" for key, channel in CHANNELS.items()}

_redis_client: aioredis.Redis | None = None
_redis_retry_after = 0.0
REDIS_RETRY_COOLDOWN_SECONDS = 15


async def get_redis() -> aioredis.Redis:
    global _redis_client, _redis_retry_after
    if _redis_retry_after > monotonic():
        raise ConnectionError("Redis temporarily disabled after recent connection failure")

    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.25,
            socket_timeout=5,
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
    try:
        redis = await get_redis()
        stream = STREAMS.get(channel_key, f"stream:{channel_key}")
        await redis.xadd(
            stream,
            {
                "event": channel_key,
                "payload": json.dumps(data),
                "published_at": datetime.now(timezone.utc).isoformat(),
            },
            maxlen=10_000,
            approximate=True,
        )
    except (RedisError, OSError, ConnectionError) as exc:
        print(f"[Redis] Publish skipped for '{channel_key}': {exc}")


async def ensure_consumer_group(stream: str, group_name: str, start_id: str = "0") -> None:
    redis = await get_redis()
    try:
        await redis.xgroup_create(stream, group_name, id=start_id, mkstream=True)
    except ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise


async def consume_events(
    *,
    service_name: str,
    event_keys: list[str],
    callback,
    start_id: str = "0",
    block_ms: int = 5000,
) -> None:
    group_name = f"{service_name}-group"
    consumer_name = service_name
    streams = {STREAMS[key]: ">" for key in event_keys}

    for event_key in event_keys:
        await ensure_consumer_group(STREAMS[event_key], group_name, start_id=start_id)

    async def process_entries(entries, redis):
        for stream_name, messages in entries:
            for message_id, fields in messages:
                event_key = fields.get("event")
                payload_raw = fields.get("payload", "{}")
                try:
                    payload = json.loads(payload_raw)
                except json.JSONDecodeError:
                    payload = {"raw": payload_raw}
                try:
                    await callback(event_key, payload)
                    await redis.xack(stream_name, group_name, message_id)
                except Exception:
                    raise

    while True:
        try:
            redis = await get_redis()
            pending_entries = await redis.xreadgroup(
                groupname=group_name,
                consumername=consumer_name,
                streams={STREAMS[key]: "0" for key in event_keys},
                count=20,
            )
            if pending_entries:
                await process_entries(pending_entries, redis)

            entries = await redis.xreadgroup(
                groupname=group_name,
                consumername=consumer_name,
                streams=streams,
                count=20,
                block=block_ms,
            )
            if not entries:
                continue
            await process_entries(entries, redis)
        except asyncio.CancelledError:
            raise
        except (RedisError, OSError, ConnectionError) as exc:
            print(f"[Redis] Consumer '{service_name}' disconnected: {exc}. Retrying in 5s.")
            global _redis_client
            _redis_client = None
            await asyncio.sleep(5)


async def get_recent_events(limit: int = 30) -> list[dict]:
    redis = await get_redis()
    collected: list[dict] = []

    per_stream = max(1, min(limit, 10))
    for event_key, stream_name in STREAMS.items():
        entries = await redis.xrevrange(stream_name, count=per_stream)
        for message_id, fields in entries:
            payload_raw = fields.get("payload", "{}")
            published_at = fields.get("published_at")
            try:
                payload = json.loads(payload_raw)
            except json.JSONDecodeError:
                payload = {"raw": payload_raw}
            collected.append({
                "id": message_id,
                "event": fields.get("event", event_key),
                "data": payload,
                "published_at": published_at,
            })

    collected.sort(key=lambda item: item.get("published_at") or "", reverse=True)
    return collected[:limit]
