import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { useWindowStore } from './windowStore';

export type WidgetType = "WEATHER" | "CALENDAR" | "TASKS" | "MUSIC" | "PHOTOS" | "SYSTEM_MONITOR";

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  windowId: string;
  config: Record<string, any>;
}

export interface WidgetState {
  widgets: Record<string, WidgetInstance>;
}

export interface WidgetActions {
  addWidget: (type: WidgetType, initialConfig?: any, x?: number, y?: number) => void;
  removeWidget: (id: string) => void;
  updateWidgetConfig: (id: string, patch: Partial<WidgetInstance["config"]>) => void;
}

const widgetTitleFromType = (type: WidgetType) => {
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

const getWidgetDefaultSize = (type: WidgetType) => {
  switch(type) {
    case "WEATHER": return { width: 340, height: 200 };
    case "TASKS": return { width: 380, height: 420 };
    case "MUSIC": return { width: 360, height: 260 };
    case "CALENDAR": return { width: 340, height: 320 };
    default: return { width: 360, height: 300 };
  }
};

export const useWidgetStore = create<WidgetState & WidgetActions>((set, get) => ({
  widgets: {},
  
  addWidget: (type, initialConfig, x, y) => {
    const id = nanoid();
    const size = getWidgetDefaultSize(type);
    
    // Auto-calculate position if not provided (simple placement)
    let finalX = x;
    let finalY = y;
    if (finalX === undefined || finalY === undefined) {
      const widgetCount = Object.keys(get().widgets).length;
      finalX = 50 + (widgetCount * 40);
      finalY = 50 + (widgetCount * 40);
    }
    
    const windowId = useWindowStore.getState().openWindow({
      type: "WIDGET",
      title: widgetTitleFromType(type),
      width: size.width,
      height: size.height,
      x: finalX,
      y: finalY,
      payload: { widgetId: id }
    });
    
    set(state => ({
      widgets: {
        ...state.widgets,
        [id]: { id, type, windowId, config: initialConfig ?? {} }
      }
    }));
  },
  
  removeWidget: (id) => {
    const widget = get().widgets[id];
    if (widget) {
      useWindowStore.getState().closeWindow(widget.windowId);
      set(state => {
        const copy = { ...state.widgets };
        delete copy[id];
        return { widgets: copy };
      });
    }
  },
  
  updateWidgetConfig: (id, patch) => {
    set(state => ({
      widgets: {
        ...state.widgets,
        [id]: {
          ...state.widgets[id],
          config: { ...state.widgets[id].config, ...patch }
        }
      }
    }));
  }
}));
