import os
import httpx
import uvicorn
from datetime import datetime, timezone
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Knowledge Sentinel")

WORKERS = {
    "knowledge-query": os.environ.get("WORKER_COGNEE_URL", "http://cognee-worker:8200"),
}

SENTINEL_TIMEOUT = 20


class DispatchRequest(BaseModel):
    question: str
    task_type: str = "knowledge-query"
    deadline: Optional[str] = None
    reply_to: Optional[str] = None


class CapabilitiesResponse(BaseModel):
    sentinel_type: str
    capabilities: list[str]
    workers: dict[str, str]


def is_expired(deadline: Optional[str]) -> bool:
    if not deadline:
        return False
    now = datetime.now(timezone.utc)
    try:
        dl = datetime.fromisoformat(deadline.strip().replace("Z", "+00:00"))
        if dl.tzinfo is None:
            dl = dl.replace(tzinfo=timezone.utc)
        else:
            dl = dl.astimezone(timezone.utc)
        return now > dl
    except (ValueError, TypeError):
        return True


async def call_worker(url: str, req: DispatchRequest) -> dict:
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{url}/query",
            json={"question": req.question, "top_k": 3, "max_tokens": 1024},
        )
        ct = resp.headers.get("content-type", "")
        if "application/json" not in ct:
            return {"status": "error", "answer": None, "error": f"non-JSON response ({ct})"}
        resp.raise_for_status()
        data = resp.json()
        return {"status": "ok", "answer": data.get("answer"), "sources": data.get("sources", []), "confidence": data.get("confidence", 0.0)}


@app.get("/health")
async def health():
    worker_status = {}
    all_ok = True
    async with httpx.AsyncClient(timeout=5.0) as client:
        for task_type, url in WORKERS.items():
            try:
                r = await client.get(f"{url}/health")
                worker_status[task_type] = "ok" if r.status_code == 200 else f"status_{r.status_code}"
            except Exception as e:
                worker_status[task_type] = f"unreachable: {e}"
                all_ok = False
    return {"status": "ok" if all_ok else "degraded", "workers": worker_status, "version": "0.2.0"}


@app.get("/capabilities")
async def capabilities():
    return CapabilitiesResponse(sentinel_type="knowledge-sentinel", capabilities=list(WORKERS.keys()), workers=WORKERS)


@app.post("/dispatch")
async def dispatch(req: DispatchRequest, background_tasks: BackgroundTasks):
    if is_expired(req.deadline):
        return {"status": "expired", "answer": None}
    worker_url = WORKERS.get(req.task_type)
    if worker_url is None:
        return {"status": "rejected", "answer": None, "error": f"No worker for task_type '{req.task_type}'"}
    if req.reply_to:
        background_tasks.add_task(_process_and_callback, req, worker_url)
        return {"status": "accepted", "answer": None}
    try:
        return await call_worker(worker_url, req)
    except Exception as e:
        return {"status": "error", "answer": None, "error": f"Sentinel error: {e}"}


def _process_and_callback(req: DispatchRequest, worker_url: str):
    async def _run():
        try:
            result = await call_worker(worker_url, req)
        except Exception as e:
            result = {"status": "error", "answer": None, "error": str(e)}
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                await client.post(f"{req.reply_to}/callback", json=result)
            except Exception:
                pass
    import asyncio
    asyncio.run(_run())


if __name__ == "__main__":
    port = int(os.environ.get("SENTINEL_PORT", 8100))
    uvicorn.run(app, host="0.0.0.0", port=port)
