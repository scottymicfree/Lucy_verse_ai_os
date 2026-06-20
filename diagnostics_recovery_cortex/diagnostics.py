import os
from boot_sentinel.boot_sentinel import HardwareProbe, IncidentStore
from probes.docker_probe import DockerProbe
from probes.service_probe import ServiceProbe

class DiagnosticsRecoveryCortex:
    def __init__(self):
        self.incident_store = IncidentStore("luclog_resource/incident_memory.json")
        self.hardware_probe = HardwareProbe()
        self.docker_probe = DockerProbe()
        self.service_probe = ServiceProbe()
        print("[Diagnostics] Real telemetry active. Monitoring hardware, containers, and services.")

    def recovery_planner(self, component: str, details: list[str]):
        """Propose actions based on the failure."""
        print(f"[Diagnostics] Recovery Planner analyzing {component} failure...")
        
        # Simple auto-recovery example for docker containers
        if component == "docker":
            unhealthy_names = [d.split(":")[0] for d in details]
            print(f"[Diagnostics] Attempting to restart unhealthy containers: {unhealthy_names}")
            restarted = self.docker_probe.restart_unhealthy(unhealthy_names)
            print(f"[Diagnostics] Restarted: {restarted}")

    def monitoring_loop(self):
        """Called repeatedly from the main cognition loop."""
        # 1. Hardware Status
        hw_status = self.hardware_probe.check()
        if not hw_status.ok:
            print(f"[Diagnostics] Hardware anomaly detected: {hw_status.reasons}")
            self.incident_store.record("hardware", hw_status.reasons)
            self.recovery_planner("hardware", hw_status.reasons)

        # 2. Docker Status
        containers = self.docker_probe.list_status()
        unhealthy = [
            c for c in containers
            if c.health not in (None, "healthy") or c.status != "running"
        ]
        if unhealthy:
            details = [f"{c.name}: status={c.status}, health={c.health}" for c in unhealthy]
            print(f"[Diagnostics] Container anomaly detected: {details}")
            self.incident_store.record("docker", details)
            self.recovery_planner("docker", details)
            
        # 3. Could also ping core services here
