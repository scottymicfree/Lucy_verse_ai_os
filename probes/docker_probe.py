import docker
from dataclasses import dataclass

@dataclass
class ContainerStatus:
    name: str
    status: str
    health: str | None

class DockerProbe:
    def __init__(self):
        try:
            self.client = docker.from_env()
        except Exception as e:
            print(f"[DockerProbe] Warning: Could not connect to Docker daemon: {e}")
            self.client = None

    def list_status(self) -> list[ContainerStatus]:
        if not self.client:
            return []
            
        try:
            containers = self.client.containers.list(all=True)
            result = []
            for c in containers:
                health = c.attrs.get("State", {}).get("Health", {}).get("Status")
                result.append(ContainerStatus(
                    name=c.name,
                    status=c.status,
                    health=health,
                ))
            return result
        except Exception as e:
            print(f"[DockerProbe] Error listing containers: {e}")
            return []

    def restart_unhealthy(self, names: list[str]) -> list[str]:
        if not self.client:
            return []
            
        restarted = []
        try:
            for c in self.client.containers.list(all=True):
                if c.name in names:
                    c.restart()
                    restarted.append(c.name)
        except Exception as e:
            print(f"[DockerProbe] Error restarting containers: {e}")
        return restarted
