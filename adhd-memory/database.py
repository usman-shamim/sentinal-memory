"""
Database layer — asyncpg connection pool + schema init + CRUD operations.
"""

import os
import uuid
import asyncpg
from typing import List, Dict, Optional

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://sentinel:VI8sHTvPW3GrkHoSCERc9Zdg7QcggVg+@cognee-postgres:5432/cognee")

_pool: Optional[asyncpg.Pool] = None

SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS episodic_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    salience FLOAT NOT NULL,
    snarc JSONB NOT NULL,
    cues TEXT[] NOT NULL,
    valid_at TIMESTAMPTZ NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT now(),
    decay_score FLOAT DEFAULT 1.0,
    stability FLOAT DEFAULT 1.0,
    hit_count INT DEFAULT 0,
    last_hit_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_episodic_cues ON episodic_memory USING GIN (cues);
CREATE INDEX IF NOT EXISTS idx_episodic_project_status ON episodic_memory (project, status);

CREATE TABLE IF NOT EXISTS semantic_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project TEXT NOT NULL,
    label TEXT NOT NULL,
    kind TEXT NOT NULL,
    weight FLOAT DEFAULT 1.0,
    okf_bundle_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS semantic_edges (
    src UUID REFERENCES semantic_nodes(id),
    dst UUID REFERENCES semantic_nodes(id),
    rel TEXT NOT NULL,
    weight FLOAT DEFAULT 1.0,
    valid_at TIMESTAMPTZ,
    PRIMARY KEY (src, dst, rel)
);
"""


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    return _pool


async def init_db():
    """Create tables if they don't exist."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(SCHEMA_SQL)


async def remember_in_db(
    project: str,
    content: str,
    embedding: List[float],
    salience: float,
    snarc: dict,
    cues: List[str],
) -> str:
    """Insert a new episodic memory. Returns the memory ID."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO episodic_memory (project, content, embedding, salience, snarc, cues, valid_at)
            VALUES ($1, $2, $3::vector, $4, $5::jsonb, $6, now())
            RETURNING id
        """, project, content, str(embedding), salience, __import__('json').dumps(snarc), cues)
        return str(row["id"])


async def recall_from_db(memory_ids: List[str]) -> List[Dict]:
    """Fetch memories by IDs, ordered by decay_score DESC."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        uuids = [uuid.UUID(mid) for mid in memory_ids]
        rows = await conn.fetch("""
            SELECT id, project, content, salience, snarc, cues, 
                   decay_score, stability, hit_count, status,
                   valid_at, recorded_at, last_hit_at
            FROM episodic_memory
            WHERE id = ANY($1) AND status = 'active'
            ORDER BY decay_score DESC
            LIMIT 5
        """, uuids)
        
        return [
            {
                "id": str(row["id"]),
                "project": row["project"],
                "content": row["content"],
                "salience": row["salience"],
                "snarc": row["snarc"],
                "cues": row["cues"],
                "decay_score": row["decay_score"],
                "stability": row["stability"],
                "hit_count": row["hit_count"],
                "status": row["status"],
                "valid_at": row["valid_at"].isoformat() if row["valid_at"] else None,
                "recorded_at": row["recorded_at"].isoformat() if row["recorded_at"] else None,
                "last_hit_at": row["last_hit_at"].isoformat() if row["last_hit_at"] else None,
            }
            for row in rows
        ]


async def forget_in_db(memory_id: str) -> bool:
    """Set memory status to 'archived'."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute("""
            UPDATE episodic_memory SET status = 'archived' WHERE id = $1
        """, uuid.UUID(memory_id))
        return result == "UPDATE 1"


async def get_graph_data(project: str, limit: int = 100) -> List[Dict]:
    """Get memories for graph visualization."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, content, cues, decay_score, hit_count, salience, snarc, status
            FROM episodic_memory
            WHERE project = $1 AND status = 'active'
            ORDER BY decay_score DESC
            LIMIT $2
        """, project, limit)
        
        return [
            {
                "id": str(row["id"]),
                "content": row["content"],
                "cues": row["cues"],
                "decay_score": row["decay_score"],
                "hit_count": row["hit_count"],
                "salience": row["salience"],
                "snarc": row["snarc"],
                "status": row["status"],
            }
            for row in rows
        ]
