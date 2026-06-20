import React, { useState } from 'react';
import { useWidgetStore } from '../../store/widgetStore';
import { useWindowStore } from '../../store/windowStore';
import { MoreHorizontal, Settings, Maximize2, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WidgetFrameProps {
  widgetId: string;
  children: React.ReactNode;
}

const widgetTitleFromType = (type: string) => {
  switch(type) {
    case "WEATHER": return "Weather";
    case "CALENDAR": return "Calendar";
    case "TASKS": return "Tasks";
    case "MUSIC": return "Music Player";
    case "PHOTOS": return "Photos";
    case "SYSTEM_MONITOR": return "System Monitor";
    default: return "Widget";
  }
};

export const WidgetFrame: React.FC<WidgetFrameProps> = ({ widgetId, children }) => {
  const widget = useWidgetStore(s => s.widgets[widgetId]);
  const { removeWidget } = useWidgetStore();
  const { maximizeWindow, closeWindow } = useWindowStore();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!widget) return null;

  const onSettings = () => {
    // In future: Open settings dialog window
    setMenuOpen(false);
  };

  const onExpand = () => {
    maximizeWindow(widget.windowId);
    setMenuOpen(false);
  };

  const onRemove = () => {
    removeWidget(widgetId);
  };

  return (
    <div className="w-full h-full flex flex-col pointer-events-auto">
      {/* Chrome Title Bar - We only show this when hovering, or keep it persistent but subtle */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-black/10 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {/* Icon could go here */}
          <span className="text-xs font-semibold text-lucy-text/70 uppercase tracking-wider">{widgetTitleFromType(widget.type)}</span>
        </div>
        
        <div className="relative">
          <button 
            onPointerDown={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-1 hover:bg-white/10 rounded-md text-lucy-text/70 transition-colors"
          >
            <MoreHorizontal size={14} />
          </button>
          
          <AnimatePresence>
            {menuOpen && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40"
                  onPointerDown={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 w-48 bg-[#1e293b]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1 z-50 overflow-hidden"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button onClick={onSettings} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-lucy-text hover:bg-white/5 transition-colors">
                    <Settings size={14} className="text-lucy-primary" /> Settings
                  </button>
                  <button onClick={onExpand} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-lucy-text hover:bg-white/5 transition-colors">
                    <Maximize2 size={14} className="text-lucy-primary" /> Expand to App
                  </button>
                  <div className="h-px bg-white/10 my-1 mx-2" />
                  <button onClick={onRemove} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 size={14} /> Remove Widget
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Widget Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative pointer-events-auto">
        {children}
      </div>
    </div>
  );
};
