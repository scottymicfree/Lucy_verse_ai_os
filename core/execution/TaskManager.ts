import { randomUUID } from 'crypto';
import { ChildProcess, spawn } from 'child_process';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout';

export interface Task {
  id: string;
  capabilityId: string;
  cmd: string;
  args: string[];
  cwd?: string;
  status: TaskStatus;
  stdout: string;
  stderr: string;
  createdAt: number;
  process?: ChildProcess;
}

export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  createTask(capabilityId: string, cmd: string, args: string[], cwd?: string): Task {
    const id = randomUUID();
    const task: Task = {
      id,
      capabilityId,
      cmd,
      args,
      cwd,
      status: 'pending',
      stdout: '',
      stderr: '',
      createdAt: Date.now()
    };
    this.tasks.set(id, task);
    return task;
  }

  async runTask(id: string, timeoutMs = this.DEFAULT_TIMEOUT): Promise<{code: number, stdout: string, stderr: string}> {
    const task = this.tasks.get(id);
    if (!task) throw new Error('Task not found');

    task.status = 'running';

    return new Promise((resolve) => {
      const child = spawn(task.cmd, task.args, { cwd: task.cwd, shell: true });
      task.process = child;

      let timeoutTimer: NodeJS.Timeout;

      if (timeoutMs > 0) {
        timeoutTimer = setTimeout(() => {
          if (task.status === 'running') {
            task.status = 'timeout';
            child.kill('SIGKILL');
            resolve({ code: -1, stdout: task.stdout, stderr: task.stderr + '\n[TaskManager] Error: Task execution timed out.' });
          }
        }, timeoutMs);
      }

      child.stdout.on('data', (data) => {
        task.stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        task.stderr += data.toString();
      });

      child.on('close', (code) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (task.status !== 'timeout') {
          task.status = code === 0 ? 'completed' : 'failed';
          resolve({ code: code ?? -1, stdout: task.stdout, stderr: task.stderr });
        }
      });

      child.on('error', (err) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (task.status !== 'timeout') {
          task.status = 'failed';
          resolve({ code: -1, stdout: task.stdout, stderr: task.stderr + '\n' + err.message });
        }
      });
    });
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }
}

export const taskManager = new TaskManager();
