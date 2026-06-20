import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "cognitive_memory.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_schema():
    conn = get_connection()
    cur = conn.cursor()
    # Episodes table (raw events)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS episodes (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            source TEXT NOT NULL,
            payload TEXT NOT NULL
        );
    """)
    # Entities table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS entities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            type TEXT,
            embedding BLOB,
            importance REAL DEFAULT 0.0,
            last_access TEXT,
            created_at TEXT NOT NULL
        );
    """)
    # Edge table (directed)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS edges (
            src INTEGER NOT NULL,
            dst INTEGER NOT NULL,
            relation TEXT,
            weight REAL DEFAULT 1.0,
            created_at TEXT NOT NULL,
            FOREIGN KEY(src) REFERENCES entities(id) ON DELETE CASCADE,
            FOREIGN KEY(dst) REFERENCES entities(id) ON DELETE CASCADE,
            PRIMARY KEY(src, dst, relation)
        );
    """)
    # Alias table for alternative names
    cur.execute("""
        CREATE TABLE IF NOT EXISTS aliases (
            entity_id INTEGER NOT NULL,
            alias TEXT NOT NULL,
            UNIQUE(entity_id, alias),
            FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE
        );
    """)
    conn.commit()
    conn.close()

def insert_episode(episode_id: str, source: str, payload: str, ts: str = None):
    ts = ts or datetime.utcnow().isoformat()
    conn = get_connection()
    conn.execute(
        "INSERT OR REPLACE INTO episodes (id, timestamp, source, payload) VALUES (?,?,?,?)",
        (episode_id, ts, source, payload),
    )
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_schema()
    print(f"Cognitive memory DB initialized at {DB_PATH}")
