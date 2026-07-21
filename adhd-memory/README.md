# ADHD Memory Layer + Brain Dashboard

Biologically-inspired memory management for AI agents with 3D visualization.

## Architecture

```
Agent / Odysseus -- HTTP --> ADHD Memory Layer :8400
                                    |
                                    +--> Redis (postiz-redis:6379/1) — Working Memory, Cue Index
                                    +--> PostgreSQL (cognee-postgres:5432) — Episodic Memory
                                    +--> Temporal (temporal:7233) — Dream Cycle Cron
                                    +--> Disk (/data/brain-archive) — OKF v0.1 bundles
```

## Backend: `workers/adhd-memory/`

### Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Deep health (Postgres, Redis, Temporal) |
| `/remember` | POST | Write-time attention gate (SNARC scoring) |
| `/recall` | POST | Cue-dependent retrieval (spaced repetition) |
| `/focus` | POST | Hyperfocus lock (30min TTL) |
| `/forget` | POST | Archive to OKF (force decay) |
| `/graph` | GET | Nodes/links for 3D visualization |
| `/vault` | GET | List archived OKF bundles |
| `/restore` | POST | Restore archived memory |

### Run Locally

```bash
cd workers/adhd-memory
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8400
```

### Run Temporal Worker

```bash
python worker.py
```

## Frontend: `frontend/brain-ui/`

### Stack

- Vite + React + TypeScript
- Tailwind CSS + Ant Design
- react-force-graph-3d (ThreeJS)
- Zustand (state)
- Framer Motion (animations)

### Run Locally

```bash
cd frontend/brain-ui
npm install
npm run dev
```

Opens at `http://localhost:5173`.

### Features

- **Working Memory Tray**: 7 slots with TTL countdown rings
- **3D Brain Graph**: Nodes fade with decay, grow with hits
- **Cue Command Palette**: Cmd+K, cue-dependent search
- **SNARC Inspector**: Radar chart showing why memories were stored
- **Dream Cycle Console**: Timeline slider for nightly consolidation
- **OKF Vault**: Browse and restore forgotten memories

## Docker Compose

Add to `sentinels/media/docker-compose.yml`:

```yaml
  adhd-memory:
    build:
      context: ../../workers/adhd-memory
    ports:
      - "8400:8400"
    environment:
      - PORT=8400
      - DATABASE_URL=postgresql://sentinel:VI8sHTvPW3GrkHoSCERc9Zdg7QcggVg+@cognee-postgres:5432/cognee
      - REDIS_URL=redis://postiz-redis:6379/1
      - TEMPORAL_HOST=temporal:7233
      - ARCHIVE_PATH=/data/brain-archive
    volumes:
      - ./brain-archive:/data/brain-archive
    restart: unless-stopped
    networks:
      - default

  adhd-memory-worker:
    build:
      context: ../../workers/adhd-memory
    command: python worker.py
    environment:
      - DATABASE_URL=postgresql://sentinel:VI8sHTvPW3GrkHoSCERc9Zdg7QcggVg+@cognee-postgres:5432/cognee
      - REDIS_URL=redis://postiz-redis:6379/1
      - TEMPORAL_HOST=temporal:7233
      - ARCHIVE_PATH=/data/brain-archive
    volumes:
      - ./brain-archive:/data/brain-archive
    restart: unless-stopped
    networks:
      - default
```

## Database Schema

Run on first startup (auto-created by `database.py`):

```sql
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
```
