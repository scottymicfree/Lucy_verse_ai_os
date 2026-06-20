import React from 'react';
import { WidgetBase } from './WidgetBase';
import { Image as ImageIcon } from 'lucide-react';

export function PhotosWidget() {
  const photos = [
    'bg-gradient-to-br from-blue-400 to-emerald-400',
    'bg-gradient-to-br from-purple-400 to-pink-400',
    'bg-gradient-to-br from-orange-400 to-red-400',
    'bg-gradient-to-br from-indigo-400 to-cyan-400',
    'bg-gradient-to-br from-teal-400 to-lime-400',
    'bg-gradient-to-br from-rose-400 to-orange-400'
  ];

  return (
    <WidgetBase 
      title="Photos"
      icon={<ImageIcon size={16} />}
      action={<span className="text-[10px] text-lucy-muted hover:text-white cursor-pointer">See all</span>}
    >
      <div className="grid grid-cols-2 gap-2 mt-2 h-[calc(100%-2rem)]">
        {photos.map((bg, i) => (
          <div 
            key={i} 
            className={`rounded-xl ${bg} w-full h-full opacity-80 hover:opacity-100 cursor-pointer transition-opacity shadow-inner border border-white/10`} 
          />
        ))}
      </div>
    </WidgetBase>
  );
}
