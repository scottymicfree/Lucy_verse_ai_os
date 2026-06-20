import React from 'react';
import { AppShell } from './components/layout/AppShell';

export default function App() {
  return (
    <div className="min-h-screen w-full bg-lucy-bg text-lucy-text overflow-hidden relative animated-bg">
      {/* Background Particles layer could go here */}
      <AppShell />
    </div>
  );
}
