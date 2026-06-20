import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "cognitive_memory.db")

class EpisodicMemory:
    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH)
        self._ensure_table()

    def _ensure_table(self):
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS episodes (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                source TEXT NOT NULL,
                payload TEXT NOT NULL
            )
        ''')
        self.conn.commit()

    def record(self, payload: dict, source: str = "unknown"):
        """Store a raw event/incident payload with a generated UUID, timestamp, and source."""
        from uuid import uuid4
        eid = str(uuid4())
        ts = datetime.utcnow().isoformat() + "Z"
        self.conn.execute(
            "INSERT INTO episodes (id, timestamp, source, payload) VALUES (?, ?, ?, ?)",
            (eid, ts, source, json.dumps(payload))
        )
        self.conn.commit()

    def recent(self, limit: int = 100):
        cur = self.conn.execute(
            "SELECT id, timestamp, source, payload FROM episodes ORDER BY timestamp DESC LIMIT ?", (limit,)
        )
        rows = []
        for row in cur:
            rows.append({
                "id": row[0],
                "timestamp": row[1],
                "source": row[2],
                "payload": json.loads(row[3])
            })
        return rows
