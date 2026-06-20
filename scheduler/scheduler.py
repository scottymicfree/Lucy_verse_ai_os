import json
import aiosqlite

class SchedulerService:
    """Helper wrapper for Scheduler‑related DB operations.

    Currently provides a minimal async method to list all tasks.
    Future extensions can add status queries, retries, cancellations, etc.
    """
    def __init__(self, db_path: str = "/app/data/scheduler.db"):
        self.db_path = db_path

    async def list_tasks(self):
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("SELECT * FROM tasks ORDER BY created_at DESC")
            rows = await cursor.fetchall()
            # Convert rows (sqlite.Row) to plain dicts for easier consumption
            columns = [description[0] for description in cursor.description]
            return [dict(zip(columns, row)) for row in rows]
