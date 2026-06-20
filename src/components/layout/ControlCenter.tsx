import React from 'react';
import { Wifi, Bluetooth, Plane, Moon, Sun, Battery, Bell, Volume2 } from 'lucide-react';

export function ControlCenter() {
  return (
    <aside className="w-80 glass-panel p-6 flex flex-col gap-6 z-20 overflow-y-auto no-scrollbar pb-20">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">9:41 AM</h2>
          <p className="text-sm text-lucy-muted">Thursday, May 16</p>
        </div>
        <button className="p-2 hover:bg-white/5 rounded-full text-lucy-muted transition-colors">
          <Settings size={18} />
        </button>
      </div>

      {/* Quick Toggles */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card bg-lucy-primary/20 border-lucy-primary/50 p-4 rounded-xl flex items-center gap-3 cursor-pointer">
          <Wifi size={20} className="text-white" />
          <div>
            <div className="text-sm font-semibold">Wi-Fi</div>
            <div className="text-[10px] text-white/70">Home_5G</div>
          </div>
        </div>
        <div className="glass-card bg-lucy-primary p-4 rounded-xl flex items-center gap-3 cursor-pointer">
          <Bluetooth size={20} className="text-white" />
          <div>
            <div className="text-sm font-semibold text-white">Bluetooth</div>
            <div className="text-[10px] text-white/80">On</div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-white/5">
          <Plane size={20} className="text-lucy-muted" />
          <div>
            <div className="text-sm font-semibold">Airplane</div>
            <div className="text-[10px] text-lucy-muted">Off</div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-white/5">
          <Moon size={20} className="text-lucy-primary" />
          <div>
            <div className="text-sm font-semibold">Focus</div>
            <div className="text-[10px] text-lucy-muted">On</div>
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="glass-card p-4 rounded-xl flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Sun size={16} className="text-lucy-muted" />
          <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
            <div className="w-2/3 h-full bg-lucy-primary" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Volume2 size={16} className="text-lucy-muted" />
          <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
            <div className="w-1/2 h-full bg-lucy-primary" />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <span className="text-[10px] text-lucy-primary cursor-pointer hover:underline">Clear all</span>
        </div>
        <div className="space-y-3">
          <div className="glass-card p-3 rounded-xl flex gap-3 hover:bg-white/5 cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-400 font-bold text-xs">T</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex justify-between">
                <span className="font-semibold text-sm">Microsoft Teams</span>
                <span className="text-[10px] text-lucy-muted">9:30 AM</span>
              </div>
              <p className="text-xs text-lucy-muted truncate">New message from Sarah</p>
            </div>
          </div>
          {/* More notifications could go here */}
        </div>
      </div>
    </aside>
  );
}

// Ensure Settings icon is imported
import { Settings } from 'lucide-react';
