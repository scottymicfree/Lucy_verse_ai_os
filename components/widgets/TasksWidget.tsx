import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';

interface Task {
  id: number;
  text: string;
  date: string;
  done: boolean;
}

export function TasksWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskText, setNewTaskText] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetch('/api/state/tasks')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setTasks(data.data);
        } else {
          setTasks([]);
        }
      })
      .catch(err => console.error("Failed to load tasks", err))
      .finally(() => setLoading(false));
  }, []);

  const saveTasks = async (newTasks: Task[]) => {
    setTasks(newTasks);
    await fetch('/api/state/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTasks)
    }).catch(err => console.error("Failed to save tasks", err));
  };

  const toggleTask = (id: number) => {
    const updated = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    saveTasks(updated);
  };

  const addTask = () => {
    if (!newTaskText.trim()) return;
    const newTask: Task = {
      id: Date.now(),
      text: newTaskText,
      date: 'Today',
      done: false
    };
    saveTasks([newTask, ...tasks]);
    setNewTaskText('');
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col h-full p-4 relative">
      <div className="absolute top-2 right-2 z-10">
        <button onClick={() => setIsAdding(!isAdding)} className="p-1 hover:bg-white/10 rounded">
          <Plus size={16}/>
        </button>
      </div>
      <div className="space-y-3 mt-2 max-h-48 overflow-y-auto no-scrollbar">
        {isAdding && (
          <div className="flex gap-2">
            <input 
              autoFocus
              type="text"
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder="New task..."
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-lucy-primary"
            />
          </div>
        )}
        
        {loading ? (
          <div className="text-xs text-lucy-muted text-center py-4 animate-pulse">Loading tasks...</div>
        ) : tasks.length === 0 && !isAdding ? (
          <div className="text-xs text-lucy-muted text-center py-4">No tasks pending</div>
        ) : (
          tasks.map(t => (
            <div key={t.id} onClick={() => toggleTask(t.id)} className="flex gap-3 items-start cursor-pointer group">
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 transition-colors shrink-0 ${t.done ? 'bg-lucy-primary border-lucy-primary' : 'border-white/20 group-hover:border-white/40'}`}>
                {t.done && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <div>
                <div className={`text-sm ${t.done ? 'text-lucy-muted line-through' : 'font-medium'}`}>{t.text}</div>
                <div className="text-[10px] text-lucy-muted">{t.date}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
