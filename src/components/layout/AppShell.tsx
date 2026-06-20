import React, { useState } from 'react';
import { SmartDock } from './SmartDock';
import { ControlCenter } from './ControlCenter';
import { Taskbar } from './Taskbar';
import { WidgetGrid } from '../widgets/WidgetGrid';
import { AIPanelOverlay } from '../ai/AIPanelOverlay';

export function AppShell() {
  const [isAiOpen, setIsAiOpen] = useState(false);

  return (
    <div className="flex h-screen w-full relative">
      {/* Left Sidebar: Smart Dock */}
      <SmartDock onToggleAi={() => setIsAiOpen(prev => !prev)} />

      {/* Center Canvas: Widget Grid */}
      <main className="flex-1 h-full overflow-hidden relative pb-16">
        <div className="absolute inset-0 p-8 overflow-y-auto no-scrollbar">
          <WidgetGrid />
        </div>
      </main>

      {/* Right Sidebar: Control Center */}
      <ControlCenter />

      {/* Bottom Taskbar */}
      <div className="absolute bottom-0 left-0 right-0">
        <Taskbar onToggleAi={() => setIsAiOpen(prev => !prev)} />
      </div>

      {/* Slide-out AI Panel overlay */}
      <AIPanelOverlay isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
    </div>
  );
}
