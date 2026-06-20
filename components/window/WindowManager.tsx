import React, { useEffect } from 'react';
import { useWindowStore } from '../../store/windowStore';
import { WindowFrame } from './WindowFrame';

interface WindowManagerProps {
  renderApp?: (appId: string, win: any) => React.ReactNode;
}

export const WindowManager: React.FC<WindowManagerProps> = ({ renderApp }) => {
  const { windows, zOrder } = useWindowStore();
  
  // Listen for global shortcuts (e.g. Esc to unfocus or close dialogs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // In the future, we can add logic for Alt+Tab or Esc here
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {zOrder.map(id => {
        const win = windows[id];
        if (!win || win.isMinimized) return null;
        return (
          <WindowFrame key={id} window={win}>
            {win.type === "APP" && renderApp && renderApp(win.payload?.appId, win)}
          </WindowFrame>
        );
      })}
    </>
  );
};
