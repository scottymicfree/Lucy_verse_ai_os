import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, X, Send, Command } from 'lucide-react';

interface AIPanelOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIPanelOverlay({ isOpen, onClose }: AIPanelOverlayProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed right-6 top-6 bottom-24 w-96 glass-panel rounded-2xl border border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden bg-lucy-bg/90 backdrop-blur-3xl"
        >
          {/* Header */}
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-lucy-primary/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-lucy-primary/20 flex items-center justify-center relative">
                <Brain size={16} className="text-lucy-primary" />
                <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-lucy-primary shadow-[0_0_8px_rgba(14,165,233,0.8)] animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Lucy OS</h3>
                <p className="text-[10px] text-lucy-muted uppercase tracking-wider">Listening • DJ Outfit</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-lucy-muted transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Chat / Content Area */}
          <div className="flex-1 p-4 overflow-y-auto no-scrollbar flex flex-col gap-4">
            <div className="glass-card p-3 rounded-lg text-sm bg-white/5 border-none">
              Hello! I'm active and running on the `LUCY_DJ` engine. How can I help you orchestrate your day?
            </div>
            
            <div className="ml-auto glass-card p-3 rounded-lg text-sm bg-lucy-primary/20 border-lucy-primary/30 max-w-[80%]">
              Show me my top tracks on Spotify.
            </div>

            <div className="glass-card p-3 rounded-lg text-sm bg-white/5 border-none">
              <div className="flex items-center gap-2 mb-2">
                <Command size={14} className="text-lucy-muted" />
                <span className="text-[10px] text-lucy-muted uppercase">Executing Action</span>
              </div>
              Running `[ACTION: get-top-spotify-tracks]`...
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/5">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Ask Lucy..." 
                className="w-full glass-card bg-white/5 py-3 pl-4 pr-12 text-sm rounded-xl focus:outline-none focus:border-lucy-primary/50 transition-colors"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-lucy-primary hover:bg-lucy-primary/80 flex items-center justify-center text-white transition-colors">
                <Send size={14} className="ml-0.5" />
              </button>
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
              {['Play some music', 'Organize downloads', 'Check weather'].map((suggestion, i) => (
                <button key={i} className="whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-lucy-muted hover:text-white">
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
