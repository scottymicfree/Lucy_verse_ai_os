export type Capability =
  | "Security.ApprovePolicyChanges"
  | "Security.EscalateSecurity"
  | "Security.Decide"
  | "Security.ReportEvents"
  | "Security.RequestContainment"
  | "Security.QueryStatus"
  | "Security.RequestDecision";

export interface AgentIdentity {
  id: string;
  role: "Emma" | "Sentinel" | "Lucy" | string;
  capabilities: Capability[];
}

export type SecurityActionType = "EXECUTE_UNTRUSTED"|"NETWORK_INBOUND"|"SYNTHETIC_QUARANTINE_THREAT"|"SYNTHETIC_MAZE_THREAT";

export interface SecurityEvent {
  id: string;
  timestamp: string;
  type: string;
  sourceId: string;
  details?: string;
}

export interface OSWindow {
  id: string;
  appId: string;
  title: string;
  x: number; y: number;
  width: number|string;
  height: number|string;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
}
