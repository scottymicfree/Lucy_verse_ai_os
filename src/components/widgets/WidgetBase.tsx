import React from 'react';
import { motion } from 'motion/react';
import { MoreHorizontal } from 'lucide-react';

interface WidgetBaseProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function WidgetBase({ title, icon, action, children, className = '' }: WidgetBaseProps) {
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className={`glass-card p-5 h-full flex flex-col relative group overflow-hidden ${className}`}
    >
      <div className="flex justify-between items-center mb-4 z-10">
        <h3 className="font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {action}
          <button className="text-lucy-muted hover:text-white transition-colors opacity-0 group-hover:opacity-100">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 relative z-10">
        {children}
      </div>
    </motion.div>
  );
}
