# ADHD Memory Layer — Backend Specification v1.0

**Created**: 2026-07-22
**Status**: Draft
**Port**: 8400
**Stack**: FastAPI (Python 3.12), Redis, PostgreSQL+pgvector, Temporal

---

## User Scenarios & Testing

### User Story 1 — Agent Remembers After Task (Priority: P1)

An agent completes a task (e.g., queries stock price, runs code, approves content). The agent calls `POST /remember` with the task outcome, cues, and event data. The AML scores the event via SNARC salience, stores it in Redis working memory (if salient enough) and PostgreSQL episodic memory, and indexes it by cue for future recall.

**Why this priority**: Core write path. Without this, no memories are stored and the entire system is useless.

**Independent Test**: Call `/remember` with a high-salience event (status_code=500, confidence=0.95). Verify it appears in `episodic_memory` table and in Redis `wm:<project>` ZSET.

**Acceptance Scenarios**:

1. **Given** agent completes a task with salience > 0.6, **When** agent calls `/remember`, **Then** memory is stored in both Redis WM and PostgreSQL with `status='active'`.
2. **Given** agent completes a routine task with salience < 0.2, **When** agent calls `/remember`, **Then** memory is dropped, returns `{"status": "dropped"}`.
3. **Given** Redis WM already has 7 items, **When** a new high-salience item arrives, **Then** the lowest-salience item is evicted via `ZPOPMIN`.
4. **Given** memory is stored, **When** Redis WM TTL (900s) expires, **Then** memory remains queryable via PostgreSQL (just not in WM).

---

### User Story 2 — Agent Recalls Before Task (Priority: P1)

An agent is about to execute a task. The agent calls `POST /recall` with a cue (e.g., "SYSTEM.KA") and optional query text. The AML checks Redis WM first, then falls back to cue-indexed PostgreSQL lookup. Returns up to 5 relevant memories, updating `hit_count` and `stability` (spaced repetition).

**Why this priority**: Core read path. Without this, agents can't benefit from stored memories.

**Independent Test**: Store a memory via `/remember`, then call `/recall` with the same cue. Verify the memory is returned and `hit_count` incremented.

**Acceptance Scenarios**:

1. **Given** memory exists in Redis WM for cue "PSX", **When** agent calls `/recall` with cue "PSX", **Then** memory is returned from WM (fast path).
2. **Given** memory exists in PostgreSQL but not in Redis WM, **When** agent calls `/recall` with cue "SYSTEM.KA", **Then** memory is fetched from PostgreSQL via cue index.
3. **Given** no memories match the cue, **When** agent calls `/recall`, **Then** returns empty list `{"memories": []}`.
4. **Given** memory is recalled, **When** recall completes, **Then** `hit_count` is incremented and `stability` multiplied by 1.2.

---

### User Story 3 — Hyperfocus Lock (Priority: P2)

An agent enters a focused state on a specific topic. The agent calls `POST /focus` with a topic. For the next 30 minutes, memories matching that topic get a recall boost.

**Why this priority**: Enhances recall quality during focused work sessions. Nice-to-have for MVP.

**Independent Test**: Call `/focus` with topic "docker-deployment", then call `/recall` with a related cue. Verify focus boost is applied.

**Acceptance Scenarios**:

1. **Given** focus is set to "docker-deployment", **When** agent recalls with a matching cue, **Then** matching memories score higher in results.
2. **Given** focus TTL (1800s) expires, **When** agent recalls, **Then** no focus boost is applied.

---

### User Story 4 — Manual Forget / Archive (Priority: P2)

An agent or user wants to manually archive a specific memory to OKF. Calls `POST /forget` with memory_id. The memory is exported to a Markdown file, status set to `archived`, removed from Redis indices.

**Why this priority**: Manual override for memory management. Needed for cleanup and externalization.

**Independent Test**: Store a memory, call `/forget` with its ID, verify it's archived to disk and removed from Redis.

**Acceptance Scenarios**:

1. **Given** memory exists with status "active", **When** agent calls `/forget`, **Then** OKF file is written, status becomes "archived", Redis indices cleared.
2. **Given** memory doesn't exist, **When** agent calls `/forget`, **Then** returns 404.

---

### User Story 5 — 3D Knowledge Graph (Priority: P3)

A UI or agent calls `GET /graph?project=agent-launch-pad&limit=100` to get nodes/links for force-directed visualization. Nodes represent memories and semantic entities; edges represent cue relationships and semantic connections. Node size/opacity reflects `decay_score` and `hit_count`.

**Why this priority**: Visualization is valuable for understanding memory state but not required for core functionality.

**Independent Test**: Store several memories, call `/graph`, verify nodes/links JSON is returned with correct structure.

**Acceptance Scenarios**:

1. **Given** memories exist for project, **When** UI calls `/graph`, **Then** returns `{nodes: [...], links: [...]}` with decay/hit metrics.
2. **Given** no memories exist, **When** UI calls `/graph`, **Then** returns empty graph `{nodes: [], links: []}`.

---

### Edge Cases

- What happens when Redis is unreachable? → Fall back to PostgreSQL-only recall (slower but functional).
- What happens when PostgreSQL is unreachable? → Return 503 with `{"status": "error", "error": "database unavailable"}`.
- What happens when Temporal is unreachable? → Dream Cycle doesn't run; memories still stored/recalled normally.
- What happens when embedding generation fails? → Store memory with `embedding=NULL`, recall uses cue-only matching (no vector similarity).
- What happens when cue string contains special characters? → Sanitize cue to alphanumeric + hyphens/underscores.
- What happens when content exceeds 10KB? → Truncate to 10KB, store full content in OKF archive only.
- What happens when OKF archive path doesn't exist? → Create directory structure on first write.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST accept `POST /remember` with project, content, cues, and event_data.
- **FR-002**: System MUST calculate SNARC salience from event_data using pure heuristics (<10ms).
- **FR-003**: System MUST drop memories with salience < 0.2 (return `{"status": "dropped"}`).
- **FR-004**: System MUST store memories with salience >= 0.2 in PostgreSQL `episodic_memory` table.
- **FR-005**: System MUST add memories with salience >= 0.6 to Redis working memory ZSET (`wm:<project>`).
- **FR-006**: System MUST enforce 7-slot cap on Redis WM via `ZREMRANGEBYRANK`.
- **FR-007**: System MUST index memories by cue in Redis SETs (`cues:<project>:<cue>`).
- **FR-008**: System MUST accept `POST /recall` with project, cue, and optional query_embedding.
- **FR-009**: System MUST check Redis WM first, then fall back to PostgreSQL cue-indexed lookup.
- **FR-010**: System MUST apply spaced repetition on recall: increment `hit_count`, multiply `stability` by 1.2.
- **FR-011**: System MUST accept `POST /focus` to set hyperfocus topic with 1800s TTL.
- **FR-012**: System MUST accept `POST /forget` to archive a memory to OKF and set status='archived'.
- **FR-013**: System MUST accept `GET /graph` to return nodes/links JSON for visualization.
- **FR-014**: System MUST implement Temporal `DreamCycleWorkflow` for nightly consolidation (03:00 cron).
- **FR-015**: Dream Cycle MUST decay memories not accessed in >1 day using `R = e^(-t/S)`.
- **FR-016**: Dream Cycle MUST archive memories with `decay_score < 0.05` to OKF bundles.
- **FR-017**: Dream Cycle MUST promote memories with `hit_count > 3` to semantic graph nodes/edges.
- **FR-018**: System MUST expose `GET /health` checking PostgreSQL, Redis, and Temporal connectivity.
- **FR-019**: System MUST use Redis DB 1 to avoid conflicts with Postiz/n8n.
- **FR-020**: System MUST export archived memories in Google OKF v0.1 format (YAML frontmatter + Markdown).

### Non-Functional Requirements

- **NFR-001**: `/remember` response time MUST be < 100ms (excluding embedding generation).
- **NFR-002**: `/recall` response time MUST be < 50ms for Redis WM hits, < 200ms for PostgreSQL fallback.
- **NFR-003**: System MUST handle 100 concurrent requests without degradation.
- **NFR-004**: Working memory ZSET TTL MUST be 900s (15 minutes).
- **NFR-005**: Hyperfocus pointer TTL MUST be 1800s (30 minutes).
- **NFR-006**: Dream Cycle MUST complete within 30 minutes for projects with <10K memories.

### Key Entities

- **Episodic Memory**: A single agent experience. Attributes: id, project, content, embedding, salience, snarc, cues, valid_at, recorded_at, decay_score, stability, hit_count, last_hit_at, status.
- **Semantic Node**: A promoted entity from the semantic graph. Attributes: id, project, label, kind, weight, okf_bundle_id.
- **Semantic Edge**: A relationship between two semantic nodes. Attributes: src, dst, rel, weight, valid_at.
- **Working Memory**: Redis ZSET holding the 7 most salient active memories per project. Score = salience.
- **Cue Index**: Redis SET mapping cue strings to episodic_memory IDs for fast lookup.
- **OKF Bundle**: Portable Markdown file with YAML frontmatter, representing an archived or promoted memory.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Agents can store a memory via `/remember` and retrieve it via `/recall` within 200ms end-to-end.
- **SC-002**: Working memory never exceeds 7 items per project (enforced by Redis ZSET cap).
- **SC-003**: Routine events (salience < 0.2) are dropped without storage overhead.
- **SC-004**: Dream Cycle archives decayed memories to OKF files within 30 minutes nightly.
- **SC-005**: Promoted memories (hit_count > 3) appear in the semantic graph `/graph` endpoint.
- **SC-006**: System remains functional when Redis is down (PostgreSQL-only fallback).
- **SC-007**: 100 concurrent `/remember` + `/recall` requests complete without errors or >500ms p99 latency.

---

## Architecture & Placement

- **Service Name:** `adhd-memory-layer`
- **Port:** `8400` (Shared Infrastructure range)
- **Stack:** FastAPI (Python 3.12), Redis (Working Memory), PostgreSQL+pgvector (Episodic), Temporal (Consolidation).
- **Network:** Resides on the `media_default` Docker network to access `postiz-redis` and `temporal`.

```mermaid
graph TD
    Agent[Agent / Odysseus] -- HTTP REST --> AML[ADHD Memory Layer :8400]
    AML -- ZSET / Hash --> Redis[(postiz-redis:6379)]
    AML -- Vector / JSONB --> Postgres[(cognee-postgres:5432)]
    Temporal[(temporal:7233)] -- Cron 03:00 --> DreamWorkflow[Dream Cycle Workflow]
    DreamWorkflow -- Decay / Promote / Archive --> Postgres
    DreamWorkflow -- Write OKF Bundles --> FS[Local Filesystem / Git]
```

---

## Database Schema (PostgreSQL)

Execute this in the `cognee-postgres` database.

```sql
-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Episodic Memory: The decaying log of agent experiences
CREATE TABLE episodic_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    salience FLOAT NOT NULL,
    snarc JSONB NOT NULL,               -- {surprise, novelty, arousal, reward, conflict}
    cues TEXT[] NOT NULL,               -- Required for retrieval (e.g., ["PSX", "SYSTEM.KA"])
    valid_at TIMESTAMPTZ NOT NULL,      -- When the fact was true in the world
    recorded_at TIMESTAMPTZ DEFAULT now(), -- When the agent learned it
    decay_score FLOAT DEFAULT 1.0,      -- Starts at 1.0, drops over time (R = e^(-t/S))
    stability FLOAT DEFAULT 1.0,        -- Resistance to decay (grows with hits)
    hit_count INT DEFAULT 0,            -- Number of times recalled
    last_hit_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'active'        -- 'active', 'promoted' (to GBrain), 'archived' (to OKF)
);

-- Index for fast cue-based retrieval
CREATE INDEX idx_episodic_cues ON episodic_memory USING GIN (cues);
CREATE INDEX idx_episodic_project_status ON episodic_memory (project, status);
CREATE INDEX idx_episodic_embedding ON episodic_memory USING ivfflat (embedding vector_cosine_ops);

-- Semantic Graph (Placeholder for GBrain integration later)
CREATE TABLE semantic_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project TEXT NOT NULL,
    label TEXT NOT NULL,
    kind TEXT NOT NULL,
    weight FLOAT DEFAULT 1.0,
    okf_bundle_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE semantic_edges (
    src UUID REFERENCES semantic_nodes(id),
    dst UUID REFERENCES semantic_nodes(id),
    rel TEXT NOT NULL,
    weight FLOAT DEFAULT 1.0,
    valid_at TIMESTAMPTZ,
    PRIMARY KEY (src, dst, rel)
);
```

---

## Redis Schema

Use DB `1` in `postiz-redis` to avoid conflicts with Postiz/n8n.

*   **Working Memory:** `wm:<project>` (ZSET) — Score = Salience. Capped at 7 items via `ZREMRANGEBYRANK`.
*   **Hyperfocus Pointer:** `focus:<project>` (STRING) — TTL 1800s (30 mins).
*   **Cue Index:** `cues:<project>:<cue>` (SET) — Contains `episodic_memory.id` strings.

---

## API Specification (FastAPI)

### POST /remember (Write-Time Attention Gate)

Agents call this after executing a task. The AML scores the event and routes it to the appropriate memory tier.

**Payload:**
```json
{
  "project": "agent-launch-pad",
  "content": "SYSTEM.KA closed at 350 PKR, volume 1.2M",
  "cues": ["PSX", "SYSTEM.KA", "stock-market"],
  "event_data": {
    "status_code": 200,
    "status": "completed",
    "confidence_combined": 0.95,
    "task_type": "psx-quote"
  }
}
```

**Internal Logic:**
1. Calculate SNARC Salience (0.0 to 1.0) using `event_data`.
2. If Salience < 0.2: Drop immediately. Return `{"status": "dropped"}`.
3. Generate Embedding (1536 dims) for `content`.
4. Insert into `episodic_memory` (decay_score = 1.0).
5. Add `id` to `cues:<project>:<cue>` sets in Redis.
6. If Salience >= 0.6:
   * Add `id` to `wm:<project>` ZSET in Redis.
   * Enforce 7-slot cap: `ZCARD` -> if > 7, `ZPOPMIN` (evict lowest).
   * Set TTL on `wm:<project>` to 900s (15 mins).

### POST /recall (Cue-Dependent Retrieval)

Agents call this before executing a task. **Requires a cue.**

**Payload:**
```json
{
  "project": "agent-launch-pad",
  "cue": "SYSTEM.KA",
  "query_text": "What is the current stock price?",
  "query_embedding": [0.1, 0.2]
}
```

**Internal Logic:**
1. Check `wm:<project>` (Redis ZSET). If IDs exist for the cue, fetch them from Postgres.
2. If not in WM, fetch `cues:<project>:<cue>` (Redis SET).
3. Query Postgres: `SELECT * FROM episodic_memory WHERE id = ANY($1) AND status = 'active' ORDER BY (decay_score * similarity(embedding, $2)) DESC LIMIT 5`.
4. **Spaced Repetition Hit:** For returned rows, execute `UPDATE episodic_memory SET hit_count = hit_count + 1, last_hit_at = now(), stability = stability * 1.2 WHERE id = $1`.
5. Return memory contents.

### POST /focus (Hyperfocus Lock)

Sets a sticky topic that boosts matching memories.

**Payload:** `{"project": "...", "topic": "docker-deployment"}`

**Internal Logic:** `SET focus:<project> "docker-deployment" EX 1800`

### POST /forget (Manual Externalization)

Forces a memory to be archived to OKF immediately.

**Payload:** `{"memory_id": "uuid-here"}`

**Internal Logic:** Triggers the OKF Export function for this specific memory, sets `status = 'archived'` in Postgres, removes from Redis indices.

### GET /graph (UI Data Endpoint)

Returns nodes/links JSON for the 3D force graph UI.

**Query:** `?project=agent-launch-pad&limit=100`

**Internal Logic:** Queries `episodic_memory` and `semantic_nodes` to construct the graph. Returns opacity/size metrics based on `decay_score` and `hit_count`.

---

## Algorithm Specifications

### SNARC Salience Scorer

Pure heuristics, no LLM required. Runs in <10ms.

```python
import math

def calculate_salience(event: dict) -> float:
    surprise = 0.0
    novelty = 0.5  # Placeholder for 1 - max_cosine_sim
    arousal = 0.0
    reward = 0.0
    conflict = 0.0

    # Arousal: Did something break or succeed dramatically?
    status_code = event.get('status_code', 200)
    if status_code >= 500: arousal = 1.0
    elif status_code >= 400: arousal = 0.6
    elif event.get('status') == "completed": arousal = 0.3

    # Reward: Was a user goal achieved?
    if event.get('task_type') == "user_approval": reward = 0.8
    elif event.get('confidence_combined', 1.0) > 0.8: reward = 0.4

    # Conflict: Did an agent fail to reach a consensus?
    if event.get('confidence_combined', 1.0) < 0.4: conflict = 0.7

    # Weighted sum (INCUP model adapted)
    salience = (0.25 * surprise) + (0.30 * novelty) + (0.20 * arousal) + (0.15 * reward) + (0.10 * conflict)
    return min(max(salience, 0.0), 1.0)
```

### Ebbinghaus Decay Function

Used during retrieval and the Dream Cycle.

```python
import math
from datetime import datetime, timezone

def apply_decay(current_decay: float, stability: float, hours_passed: float) -> float:
    """R = e^(-t/S)"""
    decay_rate = 1.0 / max(stability, 0.1)  # Prevent division by zero
    new_decay = current_decay * math.exp(-decay_rate * hours_passed)
    return max(new_decay, 0.0)  # Floor at 0.0
```

---

## Temporal Dream Cycle Workflow

Runs nightly at 03:00 AM via Temporal Cron Workflow. Replaces the simple Janitor polling loop.

### Workflow Steps (`DreamCycleWorkflow`):

1.  **Decay Sweep (Activity 1):**
    *   Find all `episodic_memory` where `status = 'active'` and `last_hit_at < now() - interval '1 day'`.
    *   Calculate hours passed since `last_hit_at`.
    *   Update `decay_score = apply_decay(decay_score, stability, hours_passed)`.

2.  **Archive to OKF (Activity 2):**
    *   Find all `episodic_memory` where `decay_score < 0.05` and `status = 'active'`.
    *   Export each to `~/agent-launch-pad/brain-archive/<project>/<cue>/<uuid>.md` in Google OKF v0.1 format (YAML frontmatter + Markdown body).
    *   Update `status = 'archived'` in Postgres.
    *   Remove from Redis `cues` sets.

3.  **Promote to Semantic Graph (Activity 3):**
    *   Find all `episodic_memory` where `hit_count > 3` and `status = 'active'`.
    *   Extract entities/relationships (zero-LLM heuristic extraction: split `content` by verbs/prepositions).
    *   Insert into `semantic_nodes` and `semantic_edges`.
    *   Update `status = 'promoted'` in Postgres. (It remains queryable but is now part of the deep graph).

---

## OKF Bundle Export Format

When memories are archived or promoted, they are exported as portable OKF v0.1 bundles.

**File:** `~/agent-launch-pad/brain-archive/agent-launch-pad/PSX/123e4567-e89b-12d3.md`
```yaml
---
okf_version: "0.1"
id: "123e4567-e89b-12d3-a456-426614174000"
project: "agent-launch-pad"
cues: ["PSX", "SYSTEM.KA"]
status: "archived"
valid_at: "2026-07-18T10:00:00Z"
recorded_at: "2026-07-18T10:05:00Z"
salience: 0.85
snarc:
  surprise: 0.0
  novelty: 0.8
  arousal: 0.6
  reward: 0.2
  conflict: 0.0
provenance: "psx-worker-v1.2"
---

SYSTEM.KA closed at 350 PKR, volume 1.2M
```

---

## Docker Compose Integration

Add to `sentinels/media/docker-compose.yml`:

```yaml
  # -----------------------------------------------------------------------
  # ADHD Memory Layer (Shared Infrastructure)
  # -----------------------------------------------------------------------
  adhd-memory:
    build:
      context: ../../workers/adhd-memory
    ports:
      - "8400:8400"
    environment:
      - PORT=8400
      - DATABASE_URL=postgresql://agents:agents@cognee-postgres:5432/cognee
      - REDIS_URL=redis://postiz-redis:6379/1
      - TEMPORAL_HOST=temporal:7233
      - ARCHIVE_PATH=/data/brain-archive
    volumes:
      - ./brain-archive:/data/brain-archive
    restart: unless-stopped
    depends_on:
      - cognee-postgres
    networks:
      - default
```

---

## Pydantic Models

```python
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class RememberRequest(BaseModel):
    project: str
    content: str
    cues: List[str]
    event_data: Dict[str, Any] = Field(default_factory=dict)

class RecallRequest(BaseModel):
    project: str
    cue: str
    query_text: Optional[str] = None
    query_embedding: Optional[List[float]] = None

class FocusRequest(BaseModel):
    project: str
    topic: str

class MemoryResponse(BaseModel):
    id: str
    content: str
    salience: float
    decay_score: float
    cues: List[str]
    status: str
```

---

## Implementation Checklist

1.  **Initialize FastAPI App:** Create `main.py` with routes `/remember`, `/recall`, `/focus`, `/forget`, `/graph`, `/health`.
2.  **Database Setup:** Create `database.py` with asyncpg connection pool. Run schema creation SQL on startup if tables don't exist.
3.  **Redis Setup:** Create `redis_client.py` with aioredis. Ensure DB 1 is used.
4.  **Implement Salience Gate:** Write `calculate_salience(event: dict) -> float` in `heuristics.py`.
5.  **Implement Recall Logic:** Write query that fetches from Redis WM first, then Postgres using `ANY($1)` array matching for cues.
6.  **Implement Decay Logic:** Write `apply_decay()` function. Call it during recall to update `decay_score` and `last_hit_at` (spaced repetition).
7.  **Implement OKF Export:** Write `export_to_okf(memory: dict)` that writes Markdown files to `ARCHIVE_PATH`.
8.  **Temporal Integration:** Create `workflows.py` with `DreamCycleWorkflow` and register it with Temporal client.
9.  **Dockerize:** Create `Dockerfile` using `python:3.12-slim`, install `fastapi`, `uvicorn`, `asyncpg`, `redis`, `temporalio`.
10. **Health Check:** Implement `/health` that pings Postgres, Redis, and Temporal. Return `degraded` if any are unreachable.

---

## Spec Version

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-07-22 | Initial backend specification |
