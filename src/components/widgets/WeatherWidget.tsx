import React from 'react';
import { WidgetBase } from './WidgetBase';

export function WeatherWidget() {
  return (
    <WidgetBase title="Weather">
      <div className="flex flex-col h-full justify-between">
        <div className="flex justify-between items-end mb-4">
          <div className="text-yellow-400 text-5xl">☀️</div>
          <div className="text-right">
            <div className="text-4xl font-light">72°</div>
            <div className="text-xs text-lucy-muted">Sunny<br/>H: 76° L: 62°</div>
          </div>
        </div>
        
        {/* Hourly Forecast */}
        <div className="flex justify-between text-xs mt-auto pt-4 border-t border-white/5">
          {['Now', '11AM', '12PM', '1PM', '2PM'].map((time, i) => (
            <div key={time} className="flex flex-col items-center gap-1">
              <span className="text-lucy-muted">{time}</span>
              <span className="text-yellow-400">☀️</span>
              <span>{72 + (i % 3)}°</span>
            </div>
          ))}
        </div>
      </div>
    </WidgetBase>
  );
}
