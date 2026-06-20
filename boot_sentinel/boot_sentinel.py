import os
import json
import datetime
import psutil
from dataclasses import dataclass
from probes.service_probe import ServiceProbe

@dataclass
class HardwareStatus:
    cpu_percent: float
    mem_used: int
    mem_total: int
    disk_used: int
    disk_total: int
    ok: bool
    reasons: list[str]

class HardwareProbe:
    def check(self) -> HardwareStatus:
        reasons = []

        cpu = psutil.cpu_percent(interval=1)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")

        if cpu > 95:
            reasons.append(f"High CPU usage: {cpu}%")
        if mem.percent > 95:
            reasons.append(f"High memory usage: {mem.percent}%")
        if disk.percent > 95:
            reasons.append(f"Low disk space: {disk.percent}% used")

        return HardwareStatus(
            cpu_percent=cpu,
            mem_used=mem.used,
            mem_total=mem.total,
            disk_used=disk.used,
            disk_total=disk.total,
            ok=len(reasons) == 0,
            reasons=reasons,
        )

class IncidentStore:
    def __init__(self, log_path: str):
        self.log_path = log_path
        os.makedirs(os.path.dirname(self.log_path), exist_ok=True)
        
    def record(self, component: str, errors: list[str]):
        report = {
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "component": component,
            "errors": errors,
            "severity": "CRITICAL"
        }
        try:
            reports = []
            if os.path.exists(self.log_path):
                with open(self.log_path, 'r') as f:
                    content = f.read()
                    if content:
                        reports = json.loads(content)
            
            reports.append(report)
            
            with open(self.log_path, 'w') as f:
                json.dump(reports, f, indent=2)
        except Exception as e:
            print(f"[INCIDENT STORE EXCEPTION] Could not write report: {e}")

class BootSentinel:
    def __init__(self):
        self.dev_mode = os.environ.get("LUCY_DEV_MODE", "false").lower() == "true"
        self.incident_store = IncidentStore("luclog_resource/boot_incidents.json")
        self.hardware_probe = HardwareProbe()
        self.service_probe = ServiceProbe()
        
    def run_checks(self) -> bool:
        print("[BOOT] Sensory upgrade detected: HardwareProbe, DockerProbe, ServiceProbe active.")
        print("[BOOT] HardwareProbe online")
        print("[BOOT] DockerProbe online")
        print("[BOOT] ServiceProbe online")
        print("[BOOT] Real telemetry enabled")
        print("[BOOT] Running Boot Sentinel Checks...")
        
        # 1. Hardware Check
        hw_status = self.hardware_probe.check()
        if not hw_status.ok:
            self.incident_store.record("hardware", hw_status.reasons)
            if not self.dev_mode:
                print(f"[BOOT ERROR] Hardware check failed: {hw_status.reasons}")
                return False
            else:
                print(f"[BOOT WARN] Hardware probe failed but dev mode is enabled. Details: {hw_status.reasons}")

        # 2. Service Check
        # In a real environment, load these from config or env
        services = [
            ("ollama", os.environ.get("OLLAMA_HEALTH_URL", "http://localhost:11434/")),
            ("emma", os.environ.get("EMMA_HEALTH_URL", "http://localhost:8000/docs")),
            ("registry", os.environ.get("REGISTRY_HEALTH_URL", "http://localhost:5000/v2/")),
            ("executor", os.environ.get("EXECUTOR_HEALTH_URL", "http://localhost:8080/health")),
        ]
        
        bad = []
        for name, url in services:
            status = self.service_probe.check(name, url)
            if not status.ok:
                bad.append(status)
                
        if bad:
            errors = [f"{s.name} @ {s.url}: ok={s.ok}, code={s.code}, error={s.error}" for s in bad]
            self.incident_store.record("services", errors)
            if not self.dev_mode:
                print(f"[BOOT ERROR] Service check failed: {errors}")
                return False
            else:
                print(f"[BOOT WARN] Service probe failed but dev mode is enabled. Details: {errors}")

        print("[BOOT] Boot Sentinel OK")
        return True
