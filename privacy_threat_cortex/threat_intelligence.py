import time
import sqlite3
import os
from core.event_bus import system_event_bus

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'lucy.db'))

class SecurityMemory:
    def record_threat(self, source, event_type, payload, risk_score, action_taken):
        try:
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO security_memory (source, event_type, payload, risk_score, action_taken) VALUES (?, ?, ?, ?, ?)",
                (source, event_type, str(payload), risk_score, action_taken)
            )
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"[SecurityMemory] Error writing to DB: {e}")

class ThreatPipeline:
    def __init__(self):
        # Initialize sub-agents here (ExposureAgent, PrivacyAgent, ScamShield, etc.)
        self.active = True
        self.memory = SecurityMemory()

    def analyze(self, event):
        """Analyze the event and calculate a risk score."""
        print(f"[Threat Intel] Analyzing event: {event}")
        # Placeholder risk calculation
        event_str = str(event).lower()
        risk_score = 0.8 if any(x in event_str for x in ["unauthorized", "phishing", "leak", "suspicious"]) else 0.1
        return {"event": event, "risk_score": risk_score}

    def emma_review(self, risk_data):
        """Pass the risk data to Emma for AI-driven review."""
        if risk_data["risk_score"] > 0.5:
            return {"risk_data": risk_data, "conclusion": "HIGH_RISK", "details": "Suspicious activity detected."}
        return {"risk_data": risk_data, "conclusion": "LOW_RISK", "details": "Activity appears benign."}

    def recommend(self, review_data):
        """Generate a recommendation based on Emma's review."""
        if review_data["conclusion"] == "HIGH_RISK":
            return {"review_data": review_data, "action": "BLOCK_SOURCE", "requires_approval": True}
        return {"review_data": review_data, "action": "LOG_ONLY", "requires_approval": False}

    def request_human_approval(self, recommendation):
        """Request human approval if required by the recommendation."""
        action = recommendation["action"]
        if recommendation["requires_approval"]:
            print(f"[Threat Intel] UI PROMPT: Human approval required for action: {action}")
            # In a real system, this would block and wait for UI callback
            return "PENDING_APPROVAL"
        return action

    def handle_event(self, event):
        """The main pipeline execution method."""
        risk = self.analyze(event)
        review = self.emma_review(risk)
        rec = self.recommend(review)
        action = self.request_human_approval(rec)
        
        # Log to security memory
        self.memory.record_threat(
            source=event.get("source", "unknown"),
            event_type=event.get("type", "unknown"),
            payload=event.get("payload", {}),
            risk_score=risk["risk_score"],
            action_taken=action
        )
        return action

class ThreatIntelligenceCortex:
    def __init__(self):
        self.pipeline = ThreatPipeline()
        print("[Threat Cortex] Awaiting event ingestion pipeline.")
        system_event_bus.subscribe(self.process_incoming_threat)

    def process_incoming_threat(self, threat_data):
        return self.pipeline.handle_event(threat_data)
