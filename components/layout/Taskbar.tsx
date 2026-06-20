import React from 'react';
import { Search, Grid, Brain, Wifi, Battery, Volume2 } from 'lucide-react';
// @ts-ignore
import { APPLICATIONS } from '../LucyVerseDesktop';

interface TaskbarProps {
  onToggleAi: () => void;
  openApp: (id: string) => void;
  toggleMinimize: (id: string) => void;
  focusWindow: (id: string) => void;
  windows: any[];
  onSearchClick: () => void;
}

export function Taskbar({ onToggleAi, openApp, toggleMinimize, focusWindow, windows, onSearchClick }: TaskbarProps) {
  const dockApps = ["lucy", "files", "browser", "dj", "memory", "agents"];

  return (
    <div className="h-16 glass-panel border-t border-white/5 flex items-center justify-between px-6 z-30 relative bg-slate-900/60 backdrop-blur-3xl">
      
      {/* Weather/Temp Area (Left) */}
      <div className="flex items-center gap-2">
        <div className="text-yellow-400">☀️</div>
        <div className="text-xs font-semibold text-white">
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
        <div className="relative mx-2 cursor-pointer group" onClick={onSearchClick}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-lucy-muted group-hover:text-lucy-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search (⌘ Space)" 
            readOnly
            className="w-48 h-10 bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 text-sm focus:outline-none group-hover:border-lucy-primary/50 transition-colors cursor-pointer text-white"
          />
        </div>

        {/* AI Tile (Lucy) */}
        <button 
          onClick={onToggleAi}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center hover:shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all group mx-2"
        >
          <Brain size={20} className="text-white group-hover:scale-110 transition-transform" />
        </button>

        {/* Pinned / Active Desktop Apps */}
        {dockApps.map((id) => {
          const app = APPLICATIONS?.find((a:any) => a.id === id);
          if (!app) return null;
          
          const isOpen = windows.some((w: any) => w.appId === app.id);
          const isMinimized = windows.some((w: any) => w.appId === app.id && w.minimized);
          
          return (
            <button 
              key={app.id}
              onClick={() => {
                 const winObj = windows.find((w: any) => w.appId === app.id);
                 if (isOpen && !isMinimized && winObj) {
                    const maxZ = Math.max(0, ...windows.filter((w: any) => !w.minimized).map((w: any) => w.zIndex));
                    if (winObj.zIndex >= maxZ) {
                      toggleMinimize(winObj.id); 
                    } else {
                      focusWindow(winObj.id);
                    }
                 } else {
                    openApp(app.id);
                 }
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group ${isOpen ? 'bg-white/10 shadow-inner' : 'hover:bg-white/10'}`}
            >
              <div className={`text-slate-200 transition-transform ${isOpen ? 'scale-110' : ''}`}>
                {app.icon}
              </div>
              {isOpen && (
                <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isMinimized ? 'bg-slate-500' : 'bg-lucy-primary drop-shadow-[0_0_3px_rgba(14,165,233,0.8)]'}`}></div>
              )}
            </button>
          );
        })}
      </div>

      {/* System Tray (Right) */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-lucy-muted">
          <Wifi size={16} />
          <Volume2 size={16} />
          <Battery size={16} />
        </div>
        <div className="text-right text-xs text-white">
          <div className="font-semibold">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>
    </div>
  );
}
