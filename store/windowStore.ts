import { create } from 'zustand';
import { nanoid } from 'nanoid';

export type WindowType = "WIDGET" | "APP" | "PANEL" | "DIALOG";

export interface WindowDescriptor {
  id: string;
  type: WindowType;
  title: string;
  icon?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isFocused: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  isPinned?: boolean;
  payload?: any;
}

export interface WindowState {
  windows: Record<string, WindowDescriptor>;
  zOrder: string[]; // topmost last
  focusedId: string | null;
  nextZIndex: number;
}

export interface WindowActions {
  openWindow: (config: Partial<WindowDescriptor>) => string;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  bringToFront: (id: string) => void;
}

export const useWindowStore = create<WindowState & WindowActions>((set, get) => ({
  windows: {},
  zOrder: [],
  focusedId: null,
  nextZIndex: 100,

  openWindow: (config) => {
    const id = config.id || nanoid();
    const { nextZIndex, windows, zOrder } = get();
    
    // Check if window exists
    if (windows[id]) {
      get().focusWindow(id);
      return id;
    }

    const newWindow: WindowDescriptor = {
      id,
      type: config.type || "APP",
      title: config.title || "Window",
      icon: config.icon,
      x: config.x ?? (window.innerWidth / 2 - (config.width || 800) / 2 + (Math.random() * 40 - 20)),
      y: config.y ?? (window.innerHeight / 2 - (config.height || 600) / 2 + (Math.random() * 40 - 20)),
      width: config.width || 800,
      height: config.height || 600,
      zIndex: nextZIndex,
      isFocused: true,
      isMinimized: false,
      isMaximized: false,
      isPinned: config.isPinned || false,
      payload: config.payload
    };

    set({
      windows: { ...windows, [id]: newWindow },
      zOrder: [...zOrder, id],
      focusedId: id,
      nextZIndex: nextZIndex + 1
    });

    return id;
  },

  closeWindow: (id) => {
    const { windows, zOrder, focusedId } = get();
    const newWindows = { ...windows };
    delete newWindows[id];
    
    const newZOrder = zOrder.filter(wId => wId !== id);
    const newFocusedId = focusedId === id ? (newZOrder.length > 0 ? newZOrder[newZOrder.length - 1] : null) : focusedId;

    set({
      windows: newWindows,
      zOrder: newZOrder,
      focusedId: newFocusedId
    });
  },

  focusWindow: (id) => {
    const { windows, zOrder, focusedId } = get();
    if (!windows[id] || focusedId === id) return;
    get().bringToFront(id);
  },

  moveWindow: (id, x, y) => {
    const { windows } = get();
    if (!windows[id]) return;
    set({
      windows: {
        ...windows,
        [id]: { ...windows[id], x, y }
      }
    });
  },

  resizeWindow: (id, width, height) => {
    const { windows } = get();
    if (!windows[id]) return;
    set({
      windows: {
        ...windows,
        [id]: { ...windows[id], width, height }
      }
    });
  },

  minimizeWindow: (id) => {
    const { windows } = get();
    if (!windows[id]) return;
    set({
      windows: {
        ...windows,
        [id]: { ...windows[id], isMinimized: true, isFocused: false }
      }
    });
  },

  maximizeWindow: (id) => {
    const { windows } = get();
    if (!windows[id]) return;
    set({
      windows: {
        ...windows,
        [id]: { ...windows[id], isMaximized: !windows[id].isMaximized }
      }
    });
  },

  restoreWindow: (id) => {
    const { windows } = get();
    if (!windows[id]) return;
    set({
      windows: {
        ...windows,
        [id]: { ...windows[id], isMinimized: false, isMaximized: false }
      }
    });
    get().bringToFront(id);
  },

  bringToFront: (id) => {
    const { windows, zOrder, nextZIndex } = get();
    if (!windows[id]) return;
    
    // Remove from current position and push to end
    const newZOrder = zOrder.filter(wId => wId !== id);
    newZOrder.push(id);

    set({
      windows: {
        ...windows,
        [id]: { ...windows[id], zIndex: nextZIndex, isFocused: true }
      },
      zOrder: newZOrder,
      focusedId: id,
      nextZIndex: nextZIndex + 1
    });
  }
}));
