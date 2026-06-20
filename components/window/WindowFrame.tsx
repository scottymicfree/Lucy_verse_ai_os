import React, { useRef } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { useWindowStore, WindowDescriptor } from '../../store/windowStore';
import { X, Minus, Maximize2 } from 'lucide-react';
import { WidgetHost } from '../widgets/WidgetHost';

interface WindowFrameProps {
  window: WindowDescriptor;
  children?: React.ReactNode;
}

const GRID_SIZE = 40; // Size of grid cell for snapping

export const WindowFrame: React.FC<WindowFrameProps> = ({ window: win, children }) => {
  const { 
    moveWindow, 
    resizeWindow, 
    focusWindow, 
    minimizeWindow, 
    maximizeWindow, 
    closeWindow, 
    bringToFront 
  } = useWindowStore();
  
  const constraintsRef = useRef(null);
  const dragControls = useDragControls();

  const onPointerDown = (e: React.PointerEvent) => {
    focusWindow(win.id);
  };

  const handleDragEnd = (event: any, info: any) => {
    // Grid Snapping logic
    let newX = Math.round((win.x + info.offset.x) / GRID_SIZE) * GRID_SIZE;
    let newY = Math.round((win.y + info.offset.y) / GRID_SIZE) * GRID_SIZE;
    
    // Prevent dragging completely off screen
    newX = Math.max(0, Math.min(newX, document.body.clientWidth - 100));
    newY = Math.max(0, Math.min(newY, document.body.clientHeight - 100));

    moveWindow(win.id, newX, newY);
  };

  // For resize, we implement a simple custom drag on the bottom-right corner
  const handleResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    focusWindow(win.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = win.width;
    const startHeight = win.height;

    const onMove = (moveEvent: PointerEvent) => {
      let newWidth = startWidth + (moveEvent.clientX - startX);
      let newHeight = startHeight + (moveEvent.clientY - startY);
      
      // Minimum sizes
      newWidth = Math.max(300, newWidth);
      newHeight = Math.max(200, newHeight);
      
      // Snap resize to grid
      newWidth = Math.round(newWidth / GRID_SIZE) * GRID_SIZE;
      newHeight = Math.round(newHeight / GRID_SIZE) * GRID_SIZE;

      resizeWindow(win.id, newWidth, newHeight);
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  // If minimized, don't render here (rendered in dock instead)
  if (win.isMinimized) return null;

  return (
    <motion.div
      className={`absolute shadow-2xl rounded-2xl bg-lucy-bg/70 backdrop-blur-2xl border border-white/10 overflow-hidden flex flex-col pointer-events-auto ${win.isFocused ? 'ring-1 ring-lucy-primary/50' : ''}`}
      style={{
        width: win.isMaximized ? '100vw' : win.width,
        height: win.isMaximized ? '100vh' : win.height,
        zIndex: win.zIndex,
      }}
      initial={{ left: win.x, top: win.y, opacity: 0, scale: 0.95 }}
      animate={{ 
        left: win.isMaximized ? 0 : win.x, 
        top: win.isMaximized ? 0 : win.y,
        opacity: 1, 
        scale: 1 
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30, duration: 0.2 }}
      drag={!win.isMaximized}
      dragListener={false} // We trigger drag manually via TitleBar
      dragControls={dragControls}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      onPointerDown={onPointerDown}
    >
      {/* Title Bar */}
      <div 
        className="h-10 bg-black/20 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing border-b border-white/5"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="flex items-center gap-2 pointer-events-none text-lucy-text/80 font-medium text-sm">
          {win.icon && <span>{win.icon}</span>}
          <span>{win.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {win.type !== "WIDGET" && ( // Widgets use their own 3-dot menu for minimize/close typically, but we can allow standard OS controls too if wanted. For now, OS controls.
            <>
              <button onClick={(e) => { e.stopPropagation(); minimizeWindow(win.id); }} className="p-1 hover:bg-white/10 rounded-md text-lucy-text/70 transition-colors">
                <Minus size={14} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); maximizeWindow(win.id); }} className="p-1 hover:bg-white/10 rounded-md text-lucy-text/70 transition-colors">
                <Maximize2 size={14} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }} className="p-1 hover:bg-red-500/80 rounded-md text-lucy-text/70 transition-colors">
                <X size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 w-full relative overflow-hidden">
        {win.type === "WIDGET" ? (
          <WidgetHost widgetId={win.payload?.widgetId} />
        ) : children ? (
          children
        ) : (
          <div className="p-4 w-full h-full text-white/50 flex items-center justify-center">
            {win.type} Content (App/Panel)
          </div>
        )}
      </div>

      {/* Resize Handle (Bottom Right) */}
      {!win.isMaximized && (
        <div 
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 z-50"
          onPointerDown={handleResize}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 1L9 9L1 9" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </motion.div>
  );
};
