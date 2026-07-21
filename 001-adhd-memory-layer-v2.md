# ADHD Memory Layer v2.0 — Production-Ready Specification

**Created**: 2026-07-22
**Status**: Draft
**Version**: 2.0
**Port**: 8400
**Stack**: FastAPI, sentence-transformers (all-MiniLM-L6-v2, 384 dims), Redis, PostgreSQL+pgvector, Temporal

---

## Changes from v1.0

| Area | v1.0 | v2.0 |
|---|---|---|
| Embeddings | Random 1536-dim vectors | Real `all-MiniLM-L6-v2` (384 dims) |
| Auth | None | Bearer token on all endpoints except /health |
| /vault | Mock data | Real filesystem scan of /data/brain-archive |
| /dream-cycle/status | Static slider | Real Temporal workflow status |
| Frontend Three.js | `require('three')` broken | ES module `import * as THREE` |
| SNARC Inspector | Bar chart | Real `@ant-design/plots` Radar |
| DreamCycleConsole | Disconnected | Connected to real /dream-cycle/status |
| OkfVault | Mock tree | Real /vault API calls |

---

## Backend Changes

### Dependencies
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
asyncpg==0.30.0
redis[hiredis]==5.2.0
temporalio==1.9.0
sentence-transformers==3.1.0
torch==2.4.0 --index-url https://download.pytorch.org/whl/cpu
pydantic==2.9.0
```

### Database Schema (384 dims)
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS episodic_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(384),
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
```

### Auth Middleware
- All endpoints except `/health` require `Authorization: Bearer <token>`
- Validate against `AUTH_TOKEN` env var
- Return 401 if missing/invalid

### New Endpoints
- `GET /vault` — Scan `/data/brain-archive/` directory, return JSON tree
- `GET /dream-cycle/status` — Query Temporal for latest DreamCycleWorkflow run

---

## Frontend Changes

### Three.js Fix
```typescript
// BEFORE (broken):
const THREE = require('three');

// AFTER (working):
import * as THREE from 'three';
```

### SNARC Radar Fix
```tsx
// BEFORE (bar chart):
<div className="h-2 bg-gray-800 rounded-full">...</div>

// AFTER (real radar):
import { Radar } from '@ant-design/plots';
<Radar data={radarData} xField="dimension" yField="value" />
```

### DreamCycleConsole Fix
- Fetch from `/api/dream-cycle/status` every 30s
- Display real Temporal workflow state
- Green checkmarks when completed

### OkfVault Fix
- Fetch from `/api/vault` on open
- Real file tree from backend
- Restore button triggers `/api/restore`

---

## Docker Compose Changes
```yaml
adhd-memory:
  build:
    context: ../knowledge-sentinel/adhd-memory
  ports:
    - "8400:8400"
  environment:
    PORT: 8400
    AUTH_TOKEN: ${AUTH_TOKEN}
    DATABASE_URL: postgresql://cognee:cognee@cognee-postgres:5432/cognee_db
    REDIS_URL: redis://postiz-redis:6379/1
    TEMPORAL_HOST: temporal:7233
    ARCHIVE_PATH: /data/brain-archive
    HF_HOME: /data/huggingface
  volumes:
    - brain-archive:/data/brain-archive
    - huggingface-cache:/data/huggingface
  restart: unless-stopped
```

---

## Spec Version

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-07-22 | Initial backend specification |
| 2.0 | 2026-07-22 | Production-ready: real embeddings, auth, real APIs |
