import os
import json
import asyncio
import sqlite3
import subprocess
from typing import List, Dict
from fastapi import HTTPException

from notifier import notify_emma
from bus import publish
from sandbox import Sandbox


class SelfExtensionEngine:
    def __init__(self):
        self.db_path = os.getenv("SELF_EXT_DB", "/app/data/self_extension.db")
        self._ensure_tables()
        # NOTE: heartbeat is started via FastAPI startup event, NOT here
        # (asyncio.create_task requires a running event loop)

    def _ensure_tables(self):
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS proposals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                diff TEXT,
                description TEXT,
                status TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                result TEXT
            )
            """
        )
        conn.commit()
        conn.close()

    async def start_heartbeat(self):
        """Start periodic heartbeat — call this from FastAPI startup event."""
        async def _beat():
            while True:
                count = await asyncio.to_thread(self._count_pending)
                await publish("heartbeat", {
                    "cognitive_state": "idle",
                    "evolution_state": "monitoring",
                    "pending_proposals": count,
                    "sandbox_health": "ok",
                })
                await asyncio.sleep(30)
        asyncio.create_task(_beat())

    async def enqueue_proposal(self, payload: dict) -> int:
        diff = payload.get("diff", "")
        description = payload.get("description", "")
        def _insert():
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO proposals (diff, description, status) VALUES (?, ?, 'pending')",
                (diff, description),
            )
            pid = cur.lastrowid
            conn.commit()
            conn.close()
            return pid
        proposal_id = await asyncio.to_thread(_insert)
        await notify_emma("proposal_created", {"id": proposal_id, "description": description})
        await publish("proposal_created", {"id": proposal_id, "description": description})
        return proposal_id

    async def list_pending(self) -> List[Dict]:
        def _query():
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()
            cur.execute("SELECT id, diff, description, status FROM proposals WHERE status='pending'")
            rows = cur.fetchall()
            conn.close()
            return rows
        rows = await asyncio.to_thread(_query)
        return [{"id": r[0], "diff": r[1], "description": r[2], "status": r[3]} for r in rows]

    async def approve(self, proposal_id: int) -> str:
        def _fetch():
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()
            cur.execute("SELECT diff FROM proposals WHERE id=? AND status='pending'", (proposal_id,))
            row = cur.fetchone()
            conn.close()
            return row

        row = await asyncio.to_thread(_fetch)
        if not row:
            raise HTTPException(status_code=404, detail="Proposal not found or not pending")

        diff_text = row[0]
        sandbox = Sandbox()
        validation = sandbox.run_static_checks(diff_text)

        def _update(status, result):
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()
            cur.execute(
                "UPDATE proposals SET status=?, result=? WHERE id=?",
                (status, json.dumps(result), proposal_id),
            )
            conn.commit()
            conn.close()

        if not validation["ok"]:
            await asyncio.to_thread(_update, "rejected", validation)
            await notify_emma("proposal_rejected", {"id": proposal_id, "reason": "static_check_failed"})
            await publish("proposal_rejected", {"id": proposal_id, "reason": "static_check_failed"})
            return "rejected – static check failed"

        await asyncio.to_thread(_update, "approved", {"static": validation})
        await notify_emma("proposal_approved", {"id": proposal_id})
        await publish("proposal_approved", {"id": proposal_id})
        await publish("self_reflection", {"id": proposal_id, "event": "mutation_success"})
        return "approved"

    async def reject(self, proposal_id: int) -> str:
        def _reject():
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()
            cur.execute("UPDATE proposals SET status='rejected' WHERE id=?", (proposal_id,))
            conn.commit()
            conn.close()
        await asyncio.to_thread(_reject)
        await notify_emma("proposal_rejected", {"id": proposal_id, "reason": "manual_reject"})
        await publish("proposal_rejected", {"id": proposal_id, "reason": "manual_reject"})
        return "rejected"

    def _count_pending(self) -> int:
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM proposals WHERE status='pending'")
        count = cur.fetchone()[0]
        conn.close()
        return count
