"""
Redis client — working memory (ZSET), cue index (SET), hyperfocus (STRING).
Uses DB 1 to avoid conflicts with Postiz/n8n.
"""

import os
import redis.asyncio as aioredis
from typing import List, Optional

REDIS_URL = os.environ.get("REDIS_URL", "redis://postiz-redis:6379/1")

_redis: Optional[aioredis.Redis] = None

WM_TTL = 900        # 15 minutes working memory TTL
FOCUS_TTL = 1800    # 30 minutes hyperfocus TTL
WM_CAP = 7          # Hard cap on working memory slots


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    return _redis


async def init_redis():
    """Initialize Redis connection."""
    r = await get_redis()
    await r.ping()


# ── Working Memory (ZSET) ────────────────────────────────────────────

def _wm_key(project: str) -> str:
    return f"wm:{project}"


async def add_to_working_memory(project: str, memory_id: str, salience: float):
    """Add a memory to working memory ZSET. Enforce 7-slot cap."""
    r = await get_redis()
    key = _wm_key(project)
    
    # Add with salience as score
    await r.zadd(key, {memory_id: salience})
    
    # Set TTL on the ZSET
    await r.expire(key, WM_TTL)
    
    # Enforce cap: if > 7 items, remove lowest scored
    card = await r.zcard(key)
    if card > WM_CAP:
        # ZPOPMIN removes lowest scored item
        await r.zpopmin(key, card - WM_CAP)


async def get_working_memory_ids(project: str) -> List[str]:
    """Get all memory IDs in working memory (sorted by score DESC)."""
    r = await get_redis()
    key = _wm_key(project)
    # ZREVRANGE returns highest scored first
    return await r.zrevrange(key, 0, -1)


async def remove_from_working_memory(project: str, memory_id: str):
    """Remove a memory from working memory."""
    r = await get_redis()
    await r.zrem(_wm_key(project), memory_id)


# ── Cue Index (SET) ──────────────────────────────────────────────────

def _cue_key(project: str, cue: str) -> str:
    return f"cues:{project}:{cue}"


async def add_to_cue_index(project: str, cue: str, memory_id: str):
    """Add a memory ID to a cue's SET."""
    r = await get_redis()
    await r.sadd(_cue_key(project, cue), memory_id)


async def get_cue_ids(project: str, cue: str) -> List[str]:
    """Get all memory IDs for a cue."""
    r = await get_redis()
    return list(await r.smembers(_cue_key(project, cue)))


async def remove_from_cue_index(project: str, memory_id: str, cues: List[str]):
    """Remove a memory ID from all cue SETs."""
    r = await get_redis()
    for cue in cues:
        await r.srem(_cue_key(project, cue), memory_id)


# ── Hyperfocus (STRING) ──────────────────────────────────────────────

def _focus_key(project: str) -> str:
    return f"focus:{project}"


async def set_focus(project: str, topic: str):
    """Set hyperfocus topic with TTL."""
    r = await get_redis()
    await r.setex(_focus_key(project), FOCUS_TTL, topic)


async def get_focus(project: str) -> Optional[str]:
    """Get current hyperfocus topic (None if expired)."""
    r = await get_redis()
    return await r.get(_focus_key(project))
