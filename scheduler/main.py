import os
import json
import asyncio
from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import List, Optional
import httpx
import aiosqlite
from redis import Redis
from rq import Queue

app = FastAPI(title="Lucy Scheduler")

# Shared secret – same as other services

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/stats")
async def stats():
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("SELECT COUNT(*) FROM tasks")
        total = (await cur.fetchone())[0]
        cur = await db.execute("SELECT COUNT(*) FROM tasks WHERE status='pending'")
        pending = (await cur.fetchone())[0]
        cur = await db.execute("SELECT COUNT(*) FROM tasks WHERE status='running'")
        running = (await cur.fetchone())[0]
        cur = await db.execute("SELECT COUNT(*) FROM tasks WHERE status='done'")
        done = (await cur.fetchone())[0]
        cur = await db.execute("SELECT COUNT(*) FROM tasks WHERE status='failed'")
        failed = (await cur.fetchone())[0]
        return {"total_tasks": total, "pending": pending, "running": running, "done": done, "failed": failed}

SHARED_SECRET = os.getenv("TOOL_REGISTRY_SECRET", "lucy-secret")
# Redis connection for heavy task queue
redis_conn = Redis(host="redis", port=6379)
task_queue = Queue("lucy_tasks", connection=redis_conn)

def verify_secret(x_secret_key: str = Header(...)):
    if x_secret_key != SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret")
    return True

# ---- Request/Response models ----
class ScheduleRequest(BaseModel):
    goal: str                     # High‑level description
    schedule_type: str = "once"  # "once", "interval", "cron"
    interval_seconds: Optional[int] = None
    cron: Optional[str] = None
    context: Optional[dict] = None

class ScheduleResponse(BaseModel):
    schedule_id: int
    message: str

# ---- Database helpers ----
DB_PATH = "/app/data/scheduler.db"

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tool TEXT,
                endpoint TEXT,
                payload TEXT,
                status TEXT,          -- pending, running, done, failed
                result TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                step_id INTEGER,
                tool TEXT,
                endpoint TEXT,
                result TEXT,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        await db.commit()

@app.on_event("startup")
async def startup():
    await init_db()

# ---- Helper to talk to Planner ----
async def get_plan(goal: str) -> List[dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "http://planner:8006/plan",
            json={"goal": goal},
            headers={"x-secret-key": SHARED_SECRET},
            timeout=30,
        )
        resp.raise_for_status()
        plan = resp.json()
        return plan.get("steps", [])

# ---- Execution helpers ----
async def execute_small_step(step: dict):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            step["endpoint"],
            json=step.get("payload", {}),
            headers={"x-secret-key": SHARED_SECRET},
            timeout=30,
        )
        resp.raise_for_status()
        result = resp.json()
        # Log result
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "INSERT INTO logs (tool, endpoint, result) VALUES (?, ?, ?)",
                (step["tool"], step["endpoint"], json.dumps(result)),
            )
            await db.commit()
        return result

async def enqueue_heavy_step(step: dict):
    # Record task in SQLite for tracking
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO tasks (tool, endpoint, payload, status) VALUES (?, ?, ?, ?)",
            (
                step["tool"],
                step["endpoint"],
                json.dumps(step.get("payload", {})),
                "pending",
            ),
        )
        await db.commit()
    # Enqueue heavy step to Redis RQ (max_retries=3)
    task_queue.enqueue("worker.execute_heavy_step", step, retry=3)


# ---- Main scheduling endpoint ----
@app.post("/schedule", response_model=ScheduleResponse, dependencies=[Depends(verify_secret)])
async def schedule(request: ScheduleRequest):
    # 1. Obtain plan from Planner
    steps = await get_plan(request.goal)
    if not steps:
        raise HTTPException(status_code=400, detail="Planner returned no steps")

    # 2. Process each step according to its heavy flag
    for step in steps:
        if step.get("heavy", False):
            await enqueue_heavy_step(step)
        else:
            # fire‑and‑forget small step
            asyncio.create_task(execute_small_step(step))

    # Simple placeholder schedule ID (could be expanded later)
    return ScheduleResponse(schedule_id=0, message="Schedule accepted and processed")
