import React from 'react';
import { motion } from 'motion/react';
import { WeatherWidget } from './WeatherWidget';
import { CalendarWidget } from './CalendarWidget';
import { TasksWidget } from './TasksWidget';
import { MusicWidget } from './MusicWidget';
import { PhotosWidget } from './PhotosWidget';

export function WidgetGrid() {
  return (
    <div className="max-w-6xl mx-auto w-full">
      {/* Greeting Header */}
      <div className="mb-8 pl-4">
        <h1 className="text-4xl font-bold mb-2">Home</h1>
        <p className="text-xl">Good morning, Alex</p>
        <p className="text-sm text-lucy-muted">Here's what's happening today.</p>
      </div>

      {/* Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[200px]">
        
        <div className="lg:col-span-1 lg:row-span-1">
          <WeatherWidget />
        </div>

        <div className="lg:col-span-1 lg:row-span-2">
          <CalendarWidget />
        </div>

        <div className="lg:col-span-1 lg:row-span-1">
          <TasksWidget />
        </div>

        <div className="lg:col-span-1 lg:row-span-1">
          <PhotosWidget />
        </div>

        <div className="lg:col-span-1 lg:row-span-1">
          <MusicWidget />
        </div>

      </div>
    </div>
  );
}
