import React from 'react';
import { Search, Grid, MessageSquare, Video, FolderOpen, Settings, Brain, Wifi, Battery, Volume2 } from 'lucide-react';

interface TaskbarProps {
  onToggleAi: () => void;
}

export function Taskbar({ onToggleAi }: TaskbarProps) {
  return (
    <div className="h-16 glass-panel border-t border-white/5 flex items-center justify-between px-6 z-30 relative">
      
      {/* Weather/Temp Area (Left) */}
      <div className="flex items-center gap-2">
        <div className="text-yellow-400">☀️</div>
        <div className="text-xs font-semibold">
          72°F <br/><span className="text-[10px] text-lucy-muted font-normal">Sunny</span>
        </div>
      </div>

      {/* Centered App Icons (Windows 11 Style) */}
      <div className="flex items-center justify-center gap-2 absolute left-1/2 -translate-x-1/2">
        {/* Start Button */}
        <button className="w-10 h-10 rounded-xl bg-lucy-primary/20 hover:bg-lucy-primary/30 flex items-center justify-center text-lucy-primary transition-colors">
          <Grid size={20} />
        </button>

        {/* Search */}
        <div className="relative mx-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-lucy-muted" />
          <input 
            type="text" 
            placeholder="Search" 
            className="w-48 h-10 bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 text-sm focus:outline-none focus:border-lucy-primary/50 transition-colors"
          />
        </div>

        {/* AI Tile (Lucy) */}
        <button 
          onClick={onToggleAi}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center hover:shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all group"
        >
          <Brain size={20} className="text-white group-hover:scale-110 transition-transform" />
        </button>

        {/* Pinned Apps */}
        <button className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors text-blue-400">
          <FolderOpen size={20} />
        </button>
        <button className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors text-green-400">
          <MessageSquare size={20} />
        </button>
        <button className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors text-purple-400">
          <Video size={20} />
        </button>
      </div>

      {/* System Tray (Right) */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-lucy-muted">
          <Wifi size={16} />
          <Volume2 size={16} />
          <Battery size={16} />
        </div>
        <div className="text-right text-xs">
          <div className="font-semibold">9:41 AM</div>
          <div className="text-lucy-muted">5/16/2024</div>
        </div>
      </div>
    </div>
  );
}
