import os
import json
import sqlite3
import httpx
from fastapi import FastAPI

app = FastAPI()

PLUGIN_CAPABILITIES = {}

@app.on_event("startup")
async def load_plugin_capabilities():
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(
                "http://tool_registry:8005/plugins",
                params={"status": "approved"}
            )
            plugins = r.json()
        except Exception as e:
            print(f"[worker] Failed to load plugins: {e}")
            return

    for p in plugins:
        for cap in p["capabilities"]:
            PLUGIN_CAPABILITIES[cap["name"]] = {
                "plugin_id": p["id"],
                "entrypoint": p["entrypoint"],
                "method": cap["method"],
                "path": cap["path"]
            }
    print(f"[worker] Loaded {len(PLUGIN_CAPABILITIES)} plugin capabilities")

def execute_heavy_step(step: dict) -> dict:
    """Execute a heavy step synchronously.

    Args:
        step: Dictionary containing at least 'tool', 'endpoint', and optional 'payload'.
    Returns:
        The JSON-parsed response from the tool endpoint, or an error dict.
    """
    db_path = os.getenv("DB_PATH", "/app/data/scheduler.db")
    # Connect to SQLite database
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Identify the pending task record that matches this step
    payload_json = json.dumps(step.get("payload", {}))
    cur.execute(
        "SELECT id FROM tasks WHERE tool=? AND endpoint=? AND payload=? AND status='pending' ORDER BY id LIMIT 1",
        (step.get("tool"), step.get("endpoint"), payload_json),
    )
    row = cur.fetchone()
    task_id = row[0] if row else None

    if task_id:
        cur.execute("UPDATE tasks SET status='running' WHERE id=?", (task_id,))
        conn.commit()

    # Perform the HTTP request to the tool endpoint
    try:
        with httpx.Client() as client:
            response = client.post(
                step["endpoint"],
                json=step.get("payload", {}),
                headers={"x-secret-key": os.getenv("SCHEDULER_SECRET", "lucy-secret")},
                timeout=30,
            )
            response.raise_for_status()
            result = response.json()
            final_status = "done"
    except Exception as exc:
        result = {"error": str(exc)}
        final_status = "failed"

    # Update the task record with final status and result
    if task_id:
        cur.execute(
            "UPDATE tasks SET status=?, result=? WHERE id=?",
            (final_status, json.dumps(result), task_id),
        )
        conn.commit()

    conn.close()
    return result

async def execute_plugin_call(step: dict):
    capability = step["capability"]
    args = step.get("args", {})

    if capability not in PLUGIN_CAPABILITIES:
        raise ValueError(f"Unknown plugin capability: {capability}")

    cap = PLUGIN_CAPABILITIES[capability]
    base = cap["entrypoint"]["base_url"]
    path = cap["path"]
    url = f"{base}{path}"

    async with httpx.AsyncClient() as client:
        if cap["method"].upper() == "GET":
            r = await client.get(url, params=args)
        else:
            r = await client.post(url, json=args)

    r.raise_for_status()
    return r.json()

async def execute_step(step: dict) -> dict:
    """Dispatch a step based on its type.

    Supports:
    - "plugin_call": Executes a registered plugin capability.
    - default: Executes a heavy step (synchronous).
    """
    step_type = step.get("type")
    if step_type == "plugin_call":
        return await execute_plugin_call(step)
    # Fallback to heavy step executor for other types
    return execute_heavy_step(step)

