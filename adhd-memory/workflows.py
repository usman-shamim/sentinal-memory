"""
Temporal Dream Cycle Workflow — Nightly consolidation at 03:00 AM.

Steps:
1. Decay Sweep: Apply Ebbinghaus decay to memories not accessed in 24h
2. Archive to OKF: Move decayed memories (score < 0.05) to disk
3. Promote to Semantic Graph: High-hit memories become nodes/edges
"""

import os
import uuid
import json
import asyncio
from datetime import datetime, timezone, timedelta

from temporalio import workflow, activity


# ── Activities ────────────────────────────────────────────────────────

@activity.defn
async def decay_sweep(project: str) -> dict:
    """Apply decay to memories not accessed in 24h."""
    from database import get_pool
    from heuristics import apply_decay
    
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Find active memories not hit in 24h
        rows = await conn.fetch("""
            SELECT id, decay_score, stability, last_hit_at
            FROM episodic_memory
            WHERE project = $1 
              AND status = 'active'
              AND last_hit_at < now() - interval '1 day'
        """, project)
        
        updated = 0
        now = datetime.now(timezone.utc)
        for row in rows:
            hours_passed = (now - row["last_hit_at"]).total_seconds() / 3600
            new_decay = apply_decay(
                row["decay_score"], 
                row["stability"], 
                hours_passed
            )
            await conn.execute("""
                UPDATE episodic_memory 
                SET decay_score = $1 
                WHERE id = $2
            """, new_decay, row["id"])
            updated += 1
        
        return {"decayed": updated, "project": project}


@activity.defn
async def archive_to_okf(project: str) -> dict:
    """Archive memories with decay_score < 0.05 to OKF bundles."""
    from database import get_pool
    
    ARCHIVE_PATH = os.environ.get("ARCHIVE_PATH", "/data/brain-archive")
    pool = await get_pool()
    
    archived = 0
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, project, content, cues, salience, snarc, 
                   valid_at, recorded_at
            FROM episodic_memory
            WHERE project = $1 
              AND status = 'active'
              AND decay_score < 0.05
        """, project)
        
        for row in rows:
            memory_id = str(row["id"])
            cues = row["cues"]
            
            # Build OKF frontmatter
            frontmatter = {
                "okf_version": "0.1",
                "id": memory_id,
                "project": project,
                "cues": cues,
                "status": "archived",
                "valid_at": row["valid_at"].isoformat() if row["valid_at"] else "",
                "recorded_at": row["recorded_at"].isoformat() if row["recorded_at"] else "",
                "salience": row["salience"],
                "snarc": row["snarc"],
                "provenance": "dream-cycle-v1.0",
            }
            
            # Build Markdown
            md_content = f"---\n{json.dumps(frontmatter, indent=2)}\n---\n\n{row['content']}"
            
            # Write to disk
            cue_dir = cues[0] if cues else "uncategorized"
            dir_path = os.path.join(ARCHIVE_PATH, project, cue_dir)
            os.makedirs(dir_path, exist_ok=True)
            
            file_path = os.path.join(dir_path, f"{memory_id}.md")
            with open(file_path, "w") as f:
                f.write(md_content)
            
            # Update status
            await conn.execute("""
                UPDATE episodic_memory SET status = 'archived' WHERE id = $1
            """, row["id"])
            archived += 1
    
    return {"archived": archived, "project": project}


@activity.defn
async def promote_to_graph(project: str) -> dict:
    """Promote high-hit memories to semantic graph nodes."""
    from database import get_pool
    
    pool = await get_pool()
    promoted = 0
    
    async with pool.acquire() as conn:
        # Find memories with hit_count > 3
        rows = await conn.fetch("""
            SELECT id, content, cues
            FROM episodic_memory
            WHERE project = $1 
              AND status = 'active'
              AND hit_count > 3
        """, project)
        
        for row in rows:
            # Simple entity extraction: split content by common delimiters
            words = row["content"].split()
            # Create a node for the memory itself
            node_id = uuid.uuid4()
            await conn.execute("""
                INSERT INTO semantic_nodes (project, label, kind, weight)
                VALUES ($1, $2, 'memory', $3)
                ON CONFLICT DO NOTHING
            """, project, row["content"][:50], min(row["hit_count"] / 10.0, 1.0))
            
            # Mark as promoted
            await conn.execute("""
                UPDATE episodic_memory SET status = 'promoted' WHERE id = $1
            """, row["id"])
            promoted += 1
    
    return {"promoted": promoted, "project": project}


# ── Workflow ──────────────────────────────────────────────────────────

@workflow.defn
class DreamCycleWorkflow:
    """Nightly consolidation workflow. Runs at 03:00 AM via Temporal Cron."""
    
    @workflow.run
    async def run(self, project: str = "agent-launch-pad") -> dict:
        results = {}
        
        # Step 1: Decay Sweep
        results["decay"] = await workflow.execute_activity(
            decay_sweep,
            project,
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy={"maximum_attempts": 2},
        )
        
        # Step 2: Archive to OKF
        results["archive"] = await workflow.execute_activity(
            archive_to_okf,
            project,
            start_to_close_timeout=timedelta(minutes=10),
            retry_policy={"maximum_attempts": 2},
        )
        
        # Step 3: Promote to Graph
        results["promote"] = await workflow.execute_activity(
            promote_to_graph,
            project,
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy={"maximum_attempts": 2},
        )
        
        return results


# ── Worker Entry Point ────────────────────────────────────────────────

async def main():
    """Run the Temporal worker for Dream Cycle workflows."""
    from temporalio.client import Client
    
    temporal_host = os.environ.get("TEMPORAL_HOST", "temporal:7233")
    client = await Client.connect(temporal_host)
    
    await client.start_worker(
        workflows=[DreamCycleWorkflow],
        activities=[decay_sweep, archive_to_okf, promote_to_graph],
        task_queue="adhd-memory-tasks",
    )
    
    print(f"Dream Cycle worker started on {temporal_host}")
    
    # Keep running
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    asyncio.run(main())
