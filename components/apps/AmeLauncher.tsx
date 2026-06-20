import React, { useEffect, useRef, useState } from 'react';

export const AmeLauncher: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<'loading' | 'online' | 'error'>('loading');

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'http://localhost:3005') return;
      
      const { type, payload } = event.data;
      if (type === 'AME_READY') {
        setStatus('online');
        console.log("AME is online and connected to Lucy OS.");
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const sendCommand = (command: string, payload: any) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ command, payload }, 'http://localhost:3005');
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <div className="bg-slate-800 px-4 py-2 flex justify-between items-center border-b border-slate-700">
        <h3 className="text-white font-bold text-sm">Alpha Matrix Engine</h3>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${status === 'online' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
          <span className="text-xs text-slate-300 capitalize">{status}</span>
        </div>
      </div>
      
      <div className="flex-1 relative">
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
            <p className="text-slate-400">Waiting for AME to boot on port 3005...</p>
          </div>
        )}
        <iframe 
          ref={iframeRef}
          src="http://localhost:3005" 
          className="w-full h-full border-none"
          title="Alpha Matrix Engine"
          sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-downloads"
        />
      </div>
      
      {/* Dev Controls - remove in prod */}
      {status === 'online' && (
        <div className="bg-slate-800 p-2 flex gap-2">
          <button 
            onClick={() => sendCommand('TOGGLE_RAYTRACING', { enabled: true })}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
          >
            Test Command (Raytracing)
          </button>
        </div>
      )}
    </div>
  );
};
