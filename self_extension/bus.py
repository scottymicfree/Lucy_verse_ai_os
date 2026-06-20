import os
import json
import logging
import asyncio
from typing import Optional

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

_redis = None

async def _get_redis() -> Optional[object]:
    """Lazily obtain a Redis asyncio client. Returns None if unavailable."""
    global _redis
    if _redis is not None:
        return _redis
    try:
        from redis.asyncio import from_url as _from_url
        client = await _from_url(REDIS_URL, decode_responses=True)
        await client.ping()
        _redis = client
        return _redis
    except Exception as e:
        logging.getLogger("self_extension.bus").warning("Redis not available at %s: %s", REDIS_URL, e)
        return None

async def publish(stream: str, data: dict) -> None:
    try:
        redis = await _get_redis()
        if not redis:
            logging.getLogger("self_extension.bus").debug("Skipping publish to %s because Redis is unavailable", stream)
            return
        await redis.xadd(stream, {"payload": json.dumps(data)})
    except Exception as e:
        logging.getLogger("self_extension.bus").warning("Failed to publish to %s: %s", stream, e)

async def heartbeat(state: dict) -> None:
    await publish("heartbeat", state)
