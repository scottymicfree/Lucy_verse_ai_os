import React from 'react';
import { useWidgetStore } from '../../store/widgetStore';
import { WidgetFrame } from './WidgetFrame';

// Import our real widgets
import { WeatherWidget } from './WeatherWidget';
import { TasksWidget } from './TasksWidget';
import { MusicWidget } from './MusicWidget';
import { CalendarWidget } from './CalendarWidget';
import { PhotosWidget } from './PhotosWidget';

interface WidgetHostProps {
  widgetId: string;
}

export const WidgetHost: React.FC<WidgetHostProps> = ({ widgetId }) => {
  const widget = useWidgetStore(s => s.widgets[widgetId]);
  
  if (!widget) return null;

  switch (widget.type) {
    case "WEATHER":
      return (
        <WidgetFrame widgetId={widgetId}>
          <WeatherWidget />
        </WidgetFrame>
      );
    case "TASKS":
      return (
        <WidgetFrame widgetId={widgetId}>
          <TasksWidget />
        </WidgetFrame>
      );
    case "MUSIC":
      return (
        <WidgetFrame widgetId={widgetId}>
          <MusicWidget />
        </WidgetFrame>
      );
    case "CALENDAR":
      return (
        <WidgetFrame widgetId={widgetId}>
          <CalendarWidget />
        </WidgetFrame>
      );
    case "PHOTOS":
      return (
        <WidgetFrame widgetId={widgetId}>
          <PhotosWidget />
        </WidgetFrame>
      );
    default:
      return (
        <WidgetFrame widgetId={widgetId}>
          <div className="flex items-center justify-center w-full h-full text-white/50">
            Unknown Widget
          </div>
        </WidgetFrame>
      );
  }
};
