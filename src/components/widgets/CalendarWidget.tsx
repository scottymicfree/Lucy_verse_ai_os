import React from 'react';
import { WidgetBase } from './WidgetBase';
import { Plus } from 'lucide-react';

export function CalendarWidget() {
  const events = [
    { time: '10:00 AM', title: 'Design Review', subtitle: 'Teams Meeting', color: 'bg-indigo-500' },
    { time: '1:00 PM', title: 'Client Presentation', subtitle: 'Conference Room B', color: 'bg-emerald-500' },
    { time: '4:30 PM', title: 'Workout', subtitle: 'Gym', color: 'bg-rose-500' }
  ];

  return (
    <WidgetBase 
      title="Calendar" 
      action={<button className="p-1 hover:bg-white/10 rounded"><Plus size={16}/></button>}
    >
      <div className="text-xs text-lucy-muted mb-4">May 16 • Thursday</div>
      <div className="space-y-4">
        {events.map((evt, i) => (
          <div key={i} className="flex gap-4 items-start group cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors -mx-2">
            <div className="text-xs font-medium w-16 text-lucy-muted group-hover:text-white transition-colors">{evt.time}</div>
            <div className="flex-1 border-l-2 border-white/10 pl-3 relative">
              <div className={`absolute -left-[2px] top-1.5 w-0.5 h-0.5 ${evt.color} rounded-full`} />
              <div className="text-sm font-semibold">{evt.title}</div>
              <div className="text-[10px] text-lucy-muted">{evt.subtitle}</div>
            </div>
          </div>
        ))}
      </div>
    </WidgetBase>
  );
}
