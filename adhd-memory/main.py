"""
ADHD Memory Layer v2.0 — Production-ready biologically-inspired memory management.

Port 8400, FastAPI + sentence-transformers + Redis + PostgreSQL+pgvector + Temporal.
"""

import os
import json
import uuid
import asyncio
import uvicorn
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, remember_in_db, recall_from_db, forget_in_db, get_graph_data
from redis_client import (
    init_redis, add_to_working_memory, get_working_memory_ids,
    add_to_cue_index, get_cue_ids, remove_from_cue_index,
    set_focus, get_focus, remove_from_working_memory
)
from heuristics import calculate_salience, apply_decay, calculate_snarc
from embeddings import generate_embedding
from models import RememberRequest, RecallRequest, FocusRequest, ForgetRequest
from auth import auth_middleware

# ── Config ────────────────────────────────────────────────────────────

PORT = int(os.environ.get("PORT", 8400))
ARCHIVE_PATH = os.environ.get("ARCHIVE_PATH", "/data/brain-archive")

app = FastAPI(title="ADHD Memory Layer", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add auth middleware
app.middleware("http")(auth_middleware)

# ── Startup / Shutdown ───────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    await init_db()
    await init_redis()

# ── Health ───────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Deep health — checks Postgres, Redis."""
    from database import get_pool
    from redis_client import get_redis
    
    checks = {}
    all_ok = True
    
    # Postgres
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        checks["postgres"] = "ok"
    except Exception as e:
        checks["postgres"] = f"error: {e}"
        all_ok = False
    
    # Redis
    try:
        r = await get_redis()
        await r.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"
        all_ok = False
    
    return {"status": "ok" if all_ok else "degraded", "checks": checks, "version": "2.0.0"}

# ── POST /remember ───────────────────────────────────────────────────

@app.post("/remember")
async def remember(req: RememberRequest):
    """Write-Time Attention Gate. Scores event, stores if salient enough."""
    # 1. Calculate SNARC salience
    salience = calculate_salience(req.event_data)
    
    # 2. Drop if below threshold
    if salience < 0.2:
        return {"status": "dropped", "salience": salience}
    
    # 3. Generate real 384-dim embedding
    embedding = generate_embedding(req.content)
    
    # 4. Calculate SNARC breakdown
    snarc = calculate_snarc(req.event_data)
    
    # 5. Insert into Postgres
    memory_id = await remember_in_db(
        project=req.project,
        content=req.content,
        embedding=embedding,
        salience=salience,
        snarc=snarc,
        cues=req.cues,
    )
    
    # 6. Add to cue index in Redis
    for cue in req.cues:
        await add_to_cue_index(req.project, cue, memory_id)
    
    # 7. If salient enough, add to working memory
    in_wm = False
    if salience >= 0.6:
        await add_to_working_memory(req.project, memory_id, salience)
        in_wm = True
    
    return {
        "status": "stored",
        "id": memory_id,
        "salience": salience,
        "snarc": snarc,
        "in_working_memory": in_wm,
    }

# ── POST /recall ─────────────────────────────────────────────────────

@app.post("/recall")
async def recall(req: RecallRequest):
    """Cue-Dependent Retrieval. Requires a cue. Updates hit_count on return."""
    project = req.project
    cue = req.cue
    
    # 1. Check working memory first (fast path)
    wm_ids = await get_working_memory_ids(project)
    
    # 2. Get cue-indexed IDs from Redis
    cue_ids = await get_cue_ids(project, cue)
    
    # 3. Combine and deduplicate
    all_ids = list(set(wm_ids + cue_ids))
    
    if not all_ids:
        return {"memories": [], "source": "none"}
    
    # 4. Generate query embedding for similarity search
    query_embedding = None
    if req.query_text:
        query_embedding = generate_embedding(req.query_text)
    
    # 5. Fetch from Postgres with decay-weighted scoring
    memories = await recall_from_db(all_ids, query_embedding)
    
    # 6. Spaced Repetition: update hit_count and stability
    for mem in memories:
        await _update_hit(mem["id"])
    
    return {"memories": memories, "source": "cue", "cue": cue}

async def _update_hit(memory_id: str):
    """Increment hit_count, boost stability (spaced repetition)."""
    from database import get_pool
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            UPDATE episodic_memory 
            SET hit_count = hit_count + 1, 
                last_hit_at = now(),
                stability = stability * 1.2
            WHERE id = $1
        """, uuid.UUID(memory_id))

# ── POST /focus ──────────────────────────────────────────────────────

@app.post("/focus")
async def focus(req: FocusRequest):
    """Set hyperfocus topic. Boosts matching memories for 30 minutes."""
    await set_focus(req.project, req.topic)
    return {"status": "focused", "topic": req.topic, "ttl_seconds": 1800}

# ── POST /forget ─────────────────────────────────────────────────────

@app.post("/forget")
async def forget(req: ForgetRequest):
    """Archive a memory to OKF. Sets status='archived', removes from Redis."""
    # 1. Get memory from Postgres
    from database import get_pool
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM episodic_memory WHERE id = $1", 
            uuid.UUID(req.memory_id)
        )
        if not row:
            raise HTTPException(status_code=404, detail="Memory not found")
        
        # 2. Export to OKF bundle
        await _export_to_okf(dict(row))
        
        # 3. Set status = archived
        await conn.execute(
            "UPDATE episodic_memory SET status = 'archived' WHERE id = $1",
            uuid.UUID(req.memory_id)
        )
    
    # 4. Remove from Redis indices
    await remove_from_cue_index(row["project"], req.memory_id, row["cues"])
    await remove_from_working_memory(row["project"], req.memory_id)
    
    return {"status": "archived", "id": req.memory_id}

async def _export_to_okf(memory: dict):
    """Write memory to OKF v0.1 bundle on disk."""
    import yaml
    
    project = memory["project"]
    cues = memory["cues"]
    memory_id = str(memory["id"])
    
    # Build OKF frontmatter
    frontmatter = {
        "okf_version": "0.1",
        "id": memory_id,
        "project": project,
        "cues": cues,
        "status": "archived",
        "valid_at": memory["valid_at"].isoformat() if memory["valid_at"] else "",
        "recorded_at": memory["recorded_at"].isoformat() if memory["recorded_at"] else "",
        "salience": memory["salience"],
        "snarc": memory["snarc"],
        "provenance": "adhd-memory-layer-v2.0",
    }
    
    # Build Markdown content
    md_content = f"---\n{yaml.dump(frontmatter, default_flow_style=False)}---\n\n{memory['content']}"
    
    # Write to disk
    cue_dir = cues[0] if cues else "uncategorized"
    dir_path = os.path.join(ARCHIVE_PATH, project, cue_dir)
    os.makedirs(dir_path, exist_ok=True)
    
    file_path = os.path.join(dir_path, f"{memory_id}.md")
    with open(file_path, "w") as f:
        f.write(md_content)

# ── GET /graph ───────────────────────────────────────────────────────

@app.get("/graph")
async def graph(project: str = "agent-launch-pad", limit: int = 100):
    """Return nodes/links JSON for react-force-graph-3d."""
    memories = await get_graph_data(project, limit)
    
    nodes = []
    links = []
    
    for mem in memories:
        nodes.append({
            "id": str(mem["id"]),
            "content": mem["content"][:100],
            "val": mem["hit_count"] + 1,
            "opacity": max(0.1, mem["decay_score"]),
            "cues": mem["cues"],
            "snarc": mem["snarc"],
            "salience": mem["salience"],
            "status": mem["status"],
        })
    
    # Build links from shared cues
    cue_to_nodes: Dict[str, List[str]] = {}
    for node in nodes:
        for cue in node["cues"]:
            cue_to_nodes.setdefault(cue, []).append(node["id"])
    
    for cue, node_ids in cue_to_nodes.items():
        for i in range(len(node_ids)):
            for j in range(i + 1, len(node_ids)):
                links.append({
                    "source": node_ids[i],
                    "target": node_ids[j],
                    "cue": cue,
                })
    
    return {"nodes": nodes, "links": links, "count": len(nodes)}

# ── GET /vault ───────────────────────────────────────────────────────

@app.get("/vault")
async def vault(project: str = "agent-launch-pad"):
    """List archived OKF bundles as a file tree from /data/brain-archive/."""
    project_dir = os.path.join(ARCHIVE_PATH, project)
    if not os.path.exists(project_dir):
        return {"tree": []}
    
    tree = []
    for cue_dir in sorted(os.listdir(project_dir)):
        cue_path = os.path.join(project_dir, cue_dir)
        if os.path.isdir(cue_path):
            files = [f for f in os.listdir(cue_path) if f.endswith(".md")]
            tree.append({
                "title": cue_dir,
                "key": cue_dir,
                "children": [
                    {"title": f, "key": f"{cue_dir}/{f}", "isLeaf": True}
                    for f in sorted(files)
                ]
            })
    
    return {"tree": tree}

# ── POST /restore ────────────────────────────────────────────────────

@app.post("/restore")
async def restore(memory_id: str, project: str = "agent-launch-pad"):
    """Restore an archived memory to active status."""
    from database import get_pool
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM episodic_memory WHERE id = $1",
            uuid.UUID(memory_id)
        )
        if not row:
            raise HTTPException(status_code=404, detail="Memory not found")
        
        # Reset to active with full decay
        await conn.execute("""
            UPDATE episodic_memory 
            SET status = 'active', decay_score = 1.0, stability = 1.0
            WHERE id = $1
        """, uuid.UUID(memory_id))
        
        # Re-add to Redis cue index
        for cue in row["cues"]:
            await add_to_cue_index(project, cue, memory_id)
    
    return {"status": "restored", "id": memory_id}

# ── GET /dream-cycle/status ──────────────────────────────────────────

@app.get("/dream-cycle/status")
async def dream_cycle_status():
    """Get the status of the latest DreamCycleWorkflow from Temporal."""
    temporal_host = os.environ.get("TEMPORAL_HOST", "temporal:7233")
    
    try:
        from temporalio.client import Client
        client = await Client.connect(temporal_host)
        
        # List recent workflow executions
        workflows = []
        async for workflow in client.list_workflows():
            if workflow.name == "DreamCycleWorkflow":
                workflows.append({
                    "id": workflow.id,
                    "status": workflow.status.name,
                    "start_time": workflow.start_time.isoformat() if workflow.start_time else None,
                })
        
        if not workflows:
            return {"status": "not_started", "runs": []}
        
        # Get the most recent run
        latest = workflows[0]
        return {"status": latest["status"], "runs": workflows[:5]}
    
    except Exception as e:
        return {"status": "error", "error": str(e), "runs": []}

# ── Main ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
