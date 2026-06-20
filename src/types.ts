export interface LucyState {
  npc_counts: Record<string, number>;
  active_resources: string[];
  system_load: {
    cpu: number;
    memory: number;
    io: number;
  };
  player_activity: number;
  pending_tasks: Task[];
  logs: LogEntry[];
  neural_architecture: {
    mood: string;
    active_chains: number;
    agents: Agent[];
    workflow_pipeline: WorkflowStep[];
  };
  social_analytics?: SocialAnalytics;
}

export interface Agent {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'busy' | 'error';
  load: number;
  last_action: string;
  description: string;
  parameters: Record<string, AgentParameter>;
  active_tasks: AgentTask[];
  logs: LogEntry[];
}

export interface AgentTask {
  id: string;
  title: string;
  status: 'running' | 'paused';
}

export interface AgentParameter {
  value: any;
  type: 'string' | 'number' | 'boolean' | 'select';
  options?: string[];
  description: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed';
}

export interface SocialAnalytics {
  platform: 'twitter' | 'instagram' | 'linkedin';
  followers: number;
  engagement_rate: number;
  post_performance: { date: string; reach: number }[];
  scheduled_posts: ScheduledPost[];
}

export interface ScheduledPost {
  id: string;
  content: string;
  scheduled_at: string;
  platform: string;
}

export interface Task {
  id: number;
  title: string;
  status: 'pending' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  source?: string;
}

export type View = 'dashboard' | 'neural' | 'debug' | 'commands' | 'social' | 'checklists' | 'settings' | 'ai' | 'media' | 'music' | 'voice';
