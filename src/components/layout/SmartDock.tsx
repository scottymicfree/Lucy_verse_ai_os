import React from 'react';
import { Home, Grip, FolderOpen, Calendar, CheckSquare, FileText, Image as ImageIcon, Settings, Brain } from 'lucide-react';

interface SmartDockProps {
  onToggleAi: () => void;
}

const navItems = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'apps', icon: Grip, label: 'Apps' },
  { id: 'files', icon: FolderOpen, label: 'Files' },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
  { id: 'notes', icon: FileText, label: 'Notes' },
  { id: 'photos', icon: ImageIcon, label: 'Photos' },
];

export function SmartDock({ onToggleAi }: SmartDockProps) {
  return (
    <aside className="w-20 glass-panel flex flex-col items-center py-6 gap-6 z-20">
      {/* Profile */}
      <div className="w-10 h-10 rounded-full bg-lucy-primary/20 border border-lucy-primary flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-transform">
        <div className="w-full h-full bg-gradient-to-br from-lucy-primary to-lucy-secondary opacity-50" />
      </div>

      <nav className="flex-1 flex flex-col items-center gap-4 w-full">
        {navItems.map((item, idx) => {
          const isActive = idx === 0;
          return (
            <button
              key={item.id}
              className={`w-12 h-12 flex flex-col items-center justify-center rounded-xl transition-all ${
                isActive ? 'bg-lucy-primary/20 text-lucy-primary shadow-lg' : 'text-lucy-muted hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="text-[10px] mt-1 hidden">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* AI Tile (Lucy) */}
      <button 
        onClick={onToggleAi}
        className="w-12 h-12 relative flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
      >
        <Brain size={20} className="text-lucy-primary group-hover:scale-110 transition-transform" />
        {/* Status Indicator */}
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-lucy-primary shadow-[0_0_8px_rgba(14,165,233,0.8)] animate-pulse" />
      </button>

      <button className="w-12 h-12 flex items-center justify-center rounded-xl text-lucy-muted hover:bg-white/5 hover:text-white transition-all">
        <Settings size={20} />
      </button>
    </aside>
  );
}
