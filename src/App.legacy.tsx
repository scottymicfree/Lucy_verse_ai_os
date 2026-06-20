import * as React from 'react';
import { useState, useEffect, useRef, useMemo, Component } from 'react';
import { 
  LayoutDashboard, 
  Terminal, 
  Send, 
  CheckSquare, 
  FileText, 
  Bell, 
  Settings, 
  Activity, 
  Users, 
  Cpu, 
  AlertTriangle,
  ChevronRight,
  Plus,
  Search,
  RefreshCcw,
  Menu,
  X,
  Brain,
  Share2,
  TrendingUp,
  Clock,
  Filter,
  Zap,
  BarChart3,
  Calendar,
  Layers,
  Database,
  ArrowUpRight,
  MessageSquare,
  Pause,
  Play,
  Video,
  Music,
  Mic,
  LogOut,
  GripVertical,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { LucyState, LogEntry, Task, View, Agent, WorkflowStep, AgentTask } from './types';
import { auth, signInWithGoogle, logOut, onAuthStateChanged, User, db, handleFirestoreError, OperationType } from './firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { textToSpeech, thinkingQuery, generateVideo, generateMusic, connectLive } from './gemini';

// View Configuration
const VIEW_CONFIG: Record<Exclude<View, 'settings'>, { label: string; icon: any }> = {
  dashboard: { label: "Dashboard", icon: LayoutDashboard },
  neural: { label: "Neural Architecture", icon: Brain },
  ai: { label: "Lucy AI", icon: Zap },
  media: { label: "Media Studio", icon: Video },
  music: { label: "Music Studio", icon: Music },
  voice: { label: "Voice Link", icon: Mic },
  debug: { label: "Debug Monitor", icon: Terminal },
  commands: { label: "Command Center", icon: Send },
  social: { label: "Social Analytics", icon: Share2 },
  checklists: { label: "Checklists", icon: CheckSquare }
};

// Error Boundary Component
class ErrorBoundary extends (React.Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "{}");
        if (parsed.error) errorMessage = `Firestore Error: ${parsed.error}`;
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-lucy-bg flex items-center justify-center p-6 text-center">
          <div className="glass-card p-8 max-w-md space-y-4 border-red-500/30">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-white">System Error</h2>
            <p className="text-sm text-lucy-muted">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-lucy-primary text-white rounded-xl font-bold"
            >
              Restart System
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [state, setState] = useState<LucyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [notifications, setNotifications] = useState<string[]>([]);
  
  // Debug Monitor State
  const [logFilter, setLogFilter] = useState<LogEntry['level'] | 'all'>('all');
  const [logSearch, setLogSearch] = useState('');
  
  // Gemini State
  const [aiChat, setAiChat] = useState<{ role: string, text: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [mediaPrompt, setMediaPrompt] = useState('');
  const [isGeneratingMedia, setIsGeneratingMedia] = useState(false);
  const [generatedMediaUrl, setGeneratedMediaUrl] = useState<string | null>(null);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<string[]>([]);
  
  // Settings State
  const [enabledDashboards, setEnabledDashboards] = useState<View[]>(['dashboard', 'neural', 'debug', 'commands', 'social', 'checklists', 'ai', 'media', 'music', 'voice']);

  const logEndRef = useRef<HTMLDivElement>(null);

  // Agent Detail State
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentSortBy, setAgentSortBy] = useState<'name' | 'status' | 'load'>('name');

  // Social Scheduling State
  const [isSchedulingPost, setIsSchedulingPost] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostPlatform, setNewPostPlatform] = useState('Twitter');
  const [newPostTime, setNewPostTime] = useState('');

  // Twitter OAuth State
  const [twitterConnected, setTwitterConnected] = useState(false);
  const [twitterUsername, setTwitterUsername] = useState<string | null>(null);
  const [recentTweets, setRecentTweets] = useState<any[]>([]);

  // Sync selectedAgent with latest state
  useEffect(() => {
    if (selectedAgent && state) {
      const updatedAgent = state.neural_architecture.agents.find(a => a.id === selectedAgent.id);
      if (updatedAgent) {
        setSelectedAgent(updatedAgent);
      }
    }
  }, [state]);

  // Live Voice Session
  useEffect(() => {
    if (!isLiveActive) return;

    let session: any;
    const startSession = async () => {
      try {
        session = await connectLive({
          onopen: () => {
            console.log("Live session opened");
            setLiveTranscript(["Session started. Speak now..."]);
          },
          onmessage: (message: any) => {
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              const base64 = message.serverContent.modelTurn.parts[0].inlineData.data;
              const audio = new Audio(`data:audio/pcm;rate=16000;base64,${base64}`);
            }
            if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
              setLiveTranscript(prev => [message.serverContent.modelTurn.parts[0].text, ...prev.slice(0, 10)]);
            }
          },
          onerror: (err: any) => {
            console.error("Live session error:", err);
            setIsLiveActive(false);
          },
          onclose: () => {
            console.log("Live session closed");
            setIsLiveActive(false);
          }
        });
      } catch (err) {
        console.error("Failed to connect live:", err);
        setIsLiveActive(false);
      }
    };

    startSession();
    return () => {
      if (session) session.close();
    };
  }, [isLiveActive]);

  const checkTwitterStatus = async () => {
    try {
      const res = await fetch('/api/auth/twitter/status');
      const data = await res.json();
      setTwitterConnected(data.connected);
      setTwitterUsername(data.username);
      
      if (data.connected) {
        const postsRes = await fetch('/api/social/posts');
        const posts = await postsRes.json();
        if (Array.isArray(posts)) {
          setRecentTweets(posts);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkTwitterStatus();

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'OAUTH_AUTH_SUCCESS' && e.data?.platform === 'twitter') {
        checkTwitterStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const connectTwitter = async () => {
    try {
      const redirectUri = `${window.location.origin}/api/auth/twitter/callback`;
      const response = await fetch(`/api/auth/twitter/url?redirectUri=${encodeURIComponent(redirectUri)}`);
      const { url } = await response.json();
      window.open(url, 'oauth_popup', 'width=600,height=700');
    } catch (e) {
      console.error(e);
    }
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync & Persistence Bridge
  useEffect(() => {
    if (!user) return;

    // 1. Initial fetch from backend to populate state
    // This also triggers the backend to load from Firestore if it can
    const fetchAndSync = async () => {
      try {
        const res = await fetch(`/api/state?userId=${user.uid}`);
        const backendState = await res.json();
        
        // 2. Write the backend state to Firestore from the client
        // The client is authenticated as the user, so it has permission to write to its own doc
        const stateDoc = doc(db, 'states', user.uid);
        await setDoc(stateDoc, backendState);
        console.log("Client-side sync: State persisted to Firestore.");
      } catch (err) {
        console.error("Client-side sync failed:", err);
      }
    };

    fetchAndSync();

    // 3. Listen for real-time updates from Firestore
    const stateDoc = doc(db, 'states', user.uid);
    const unsubscribe = onSnapshot(stateDoc, (snapshot) => {
      if (snapshot.exists()) {
        setState(snapshot.data() as LucyState);
      }
    }, (error) => {
      // Don't throw here to avoid crashing the UI, just log
      console.warn("Firestore snapshot listener error:", error);
    });

    // 4. Periodic sync to ensure backend changes are persisted
    const interval = setInterval(fetchAndSync, 30000); // Sync every 30 seconds

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    if (activeView === 'debug') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state?.logs, activeView]);

  const sendCommand = async (cmd: string, args?: any) => {
    if (!user) return;
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, args, userId: user.uid })
      });
      const result = await res.json();
      if (result.status === 'success') {
        setNotifications(prev => [`Command sent: ${cmd}`, ...prev.slice(0, 4)]);
      }
    } catch (err) {
      console.error("Command failed", err);
    }
  };

  const speakLog = async (text: string) => {
    const base64 = await textToSpeech(text);
    if (base64) {
      const audio = new Audio(`data:audio/mp3;base64,${base64}`);
      audio.play();
    }
  };

  const handleAiQuery = async () => {
    if (!aiInput.trim()) return;
    const userMsg = { role: 'user', text: aiInput };
    setAiChat(prev => [...prev, userMsg]);
    setAiInput('');
    setIsAiThinking(true);
    
    const result = await thinkingQuery(aiInput);
    if (result) {
      setAiChat(prev => [...prev, { role: 'lucy', text: result }]);
    }
    setIsAiThinking(false);
  };

  const handleGenerateVideo = async () => {
    if (!mediaPrompt.trim()) return;
    setIsGeneratingMedia(true);
    const url = await generateVideo(mediaPrompt);
    if (url) setGeneratedMediaUrl(url);
    setIsGeneratingMedia(false);
  };

  const handleGenerateMusic = async () => {
    if (!mediaPrompt.trim()) return;
    setIsGeneratingMedia(true);
    const base64 = await generateMusic(mediaPrompt);
    if (base64) {
      const blob = new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], { type: 'audio/wav' });
      setGeneratedMediaUrl(URL.createObjectURL(blob));
    }
    setIsGeneratingMedia(false);
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    sendCommand(commandInput);
    setCommandInput('');
  };

  const sortedAgents = useMemo(() => {
    if (!state) return [];
    return [...state.neural_architecture.agents].sort((a, b) => {
      if (agentSortBy === 'name') return a.name.localeCompare(b.name);
      if (agentSortBy === 'load') return b.load - a.load;
      if (agentSortBy === 'status') return a.status.localeCompare(b.status);
      return 0;
    });
  }, [state?.neural_architecture.agents, agentSortBy]);

  const filteredLogs = useMemo(() => {
    if (!state) return [];
    return state.logs.filter(log => {
      const matchesFilter = logFilter === 'all' || log.level === logFilter;
      const matchesSearch = log.message.toLowerCase().includes(logSearch.toLowerCase()) || 
                            (log.source?.toLowerCase().includes(logSearch.toLowerCase()));
      return matchesFilter && matchesSearch;
    });
  }, [state?.logs, logFilter, logSearch]);

  const NavItem = ({ view, icon: Icon, label }: { view: View, icon: any, label: string, key?: any }) => (
    <button
      onClick={() => { setActiveView(view); setIsMenuOpen(false); }}
      className={`flex items-center gap-3 w-full p-4 rounded-xl transition-all ${
        activeView === view 
          ? 'bg-lucy-primary text-white shadow-lg shadow-lucy-primary/20' 
          : 'text-lucy-muted hover:bg-white/5'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
      {activeView === view && (
        <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
      )}
    </button>
  );

  if (!isAuthReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-lucy-bg">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="text-lucy-primary mb-4"
        >
          <RefreshCcw size={48} />
        </motion.div>
        <p className="text-lucy-muted animate-pulse">Initializing Lucy Twin...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-lucy-bg flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 w-full max-w-sm space-y-6"
        >
          <div className="w-20 h-20 bg-lucy-primary/20 rounded-full flex items-center justify-center mx-auto">
            <Brain size={40} className="text-lucy-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Lucy Mobile Twin</h1>
            <p className="text-lucy-muted text-sm mt-2">Neural Architecture Remote Interface</p>
          </div>
          <button 
            onClick={signInWithGoogle}
            className="w-full py-3 bg-lucy-primary text-white rounded-xl font-bold hover:bg-lucy-primary/80 transition-colors flex items-center justify-center gap-2"
          >
            <Database size={18} />
            LOGIN WITH GOOGLE
          </button>
        </motion.div>
      </div>
    );
  }

  if (loading || !state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-lucy-bg">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="text-lucy-primary mb-4"
        >
          <RefreshCcw size={48} />
        </motion.div>
        <p className="text-lucy-muted animate-pulse">Connecting to Lucy Orchestrator...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto relative bg-lucy-bg text-lucy-text font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-card rounded-none border-x-0 border-t-0 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="p-2 hover:bg-white/5 rounded-lg text-lucy-muted"
          >
            <Menu size={24} />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Lucy <span className="text-lucy-primary">Mobile Twin</span></h1>
            <div className="flex items-center gap-1.5">
              <div className="status-dot status-online" />
              <span className="text-[10px] uppercase tracking-wider font-bold text-lucy-muted">Synchronized</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button 
            onClick={() => setIsNotificationsOpen(true)}
            className="p-2 bg-white/5 rounded-xl border border-white/10 relative"
          >
            <Bell size={20} className="text-lucy-muted" />
            {state && state.pending_tasks.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-lucy-primary rounded-full border-2 border-lucy-bg" />
            )}
          </button>

          {/* Profile */}
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="w-10 h-10 rounded-xl bg-lucy-primary/20 border border-lucy-primary/30 flex items-center justify-center overflow-hidden"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon size={20} className="text-lucy-primary" />
            )}
          </button>
        </div>
      </header>

      {/* Sidebar Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-3/4 max-w-xs bg-lucy-card z-50 p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <span className="text-xl font-bold">Menu</span>
                <button onClick={() => setIsMenuOpen(false)} className="text-lucy-muted"><X size={24} /></button>
              </div>
              <nav className="space-y-2 overflow-y-auto max-h-[60vh] no-scrollbar">
                {enabledDashboards.map(view => {
                  const config = VIEW_CONFIG[view as keyof typeof VIEW_CONFIG];
                  if (!config) return null;
                  return (
                    <NavItem 
                      key={view}
                      view={view as View} 
                      icon={config.icon} 
                      label={config.label} 
                    />
                  );
                })}
              </nav>
              <div className="absolute bottom-8 left-6 right-6 pt-6 border-t border-white/5 space-y-2">
                <button 
                  onClick={() => { setActiveView('settings'); setIsMenuOpen(false); }}
                  className="flex items-center gap-3 w-full p-4 text-lucy-muted hover:text-white transition-colors"
                >
                  <Settings size={20} />
                  <span className="font-medium">Settings</span>
                </button>
                <button 
                  onClick={() => { logOut(); setIsMenuOpen(false); }}
                  className="flex items-center gap-3 w-full p-4 text-red-400 hover:text-red-300 transition-colors"
                >
                  <X size={20} />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeView === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-4 flex flex-col gap-2">
                  <div className="text-lucy-primary bg-lucy-primary/10 w-fit p-2 rounded-lg">
                    <Users size={20} />
                  </div>
                  <span className="text-2xl font-bold">{state?.player_activity}</span>
                  <span className="text-xs text-lucy-muted">Active Players</span>
                </div>
                <div className="glass-card p-4 flex flex-col gap-2">
                  <div className="text-amber-500 bg-amber-500/10 w-fit p-2 rounded-lg">
                    <Cpu size={20} />
                  </div>
                  <span className="text-2xl font-bold">{state?.system_load.cpu}%</span>
                  <span className="text-xs text-lucy-muted">CPU Usage</span>
                </div>
              </div>

              {/* System Overview */}
              <div className="glass-card p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Activity size={18} className="text-lucy-primary" />
                  System Resources
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-lucy-muted">Memory Usage</span>
                      <span className="font-bold">{state?.system_load.memory}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div animate={{ width: `${state?.system_load.memory}%` }} className="h-full bg-lucy-secondary" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-lucy-muted">I/O Throughput</span>
                      <span className="font-bold">{state?.system_load.io}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div animate={{ width: `${state?.system_load.io}%` }} className="h-full bg-amber-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* NPC Counts */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Zap size={18} className="text-lucy-primary" />
                    NPC Activity
                  </h3>
                  <span className="text-[10px] text-lucy-muted font-mono">LIVE SYNC</span>
                </div>
                <div className="space-y-3">
                  {Object.entries(state?.npc_counts || {}).map(([gang, count]) => {
                    const countNum = count as number;
                    return (
                      <div key={gang} className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-lucy-muted">{gang}</span>
                          <span className="font-bold">{countNum}</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(countNum / 10) * 100}%` }}
                            className="h-full bg-lucy-primary" 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'neural' && (
            <motion.div
              key="neural"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Brain className="text-lucy-primary" /> Neural Architecture
                  </h2>
                  <div className="px-3 py-1 bg-lucy-primary/10 border border-lucy-primary/20 rounded-full text-[10px] font-bold text-lucy-primary uppercase">
                    Mood: {state?.neural_architecture.mood}
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  <span className="text-[10px] font-bold text-lucy-muted uppercase tracking-widest mr-1">Sort:</span>
                  {(['name', 'status', 'load'] as const).map((sort) => (
                    <button
                      key={sort}
                      onClick={() => setAgentSortBy(sort)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                        agentSortBy === sort 
                          ? 'bg-lucy-primary text-white border-lucy-primary shadow-lg shadow-lucy-primary/20' 
                          : 'bg-white/5 text-lucy-muted border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {sort}
                    </button>
                  ))}
                </div>
              </div>

              {/* Agents Grid */}
              <div className="grid grid-cols-2 gap-3">
                {sortedAgents.map(agent => (
                  <button 
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className="glass-card p-4 text-left hover:bg-white/5 transition-all group relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className={`w-2 h-2 rounded-full ${
                        agent.status === 'active' ? 'bg-green-500' : 
                        agent.status === 'busy' ? 'bg-amber-500' : 
                        agent.status === 'error' ? 'bg-red-500' : 'bg-lucy-muted'
                      }`} />
                      <span className="text-[10px] font-mono text-lucy-muted">{agent.load}%</span>
                    </div>
                    <div className="font-bold text-sm">{agent.name}</div>
                    <div className="text-[10px] text-lucy-muted truncate mt-1">{agent.last_action}</div>
                    <motion.div 
                      className="absolute bottom-0 left-0 h-0.5 bg-lucy-primary"
                      animate={{ width: `${agent.load}%` }}
                    />
                  </button>
                ))}
              </div>

              {/* Workflow Pipeline */}
              <div className="glass-card p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Layers size={18} className="text-lucy-primary" />
                  Workflow Pipeline
                </h3>
                <div className="space-y-4 relative">
                  <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-white/5" />
                  {state?.neural_architecture.workflow_pipeline.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-4 relative z-10">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        step.status === 'completed' ? 'bg-green-500 border-green-500' :
                        step.status === 'running' ? 'bg-lucy-primary border-lucy-primary animate-pulse' :
                        'bg-lucy-card border-white/10'
                      }`}>
                        {step.status === 'completed' && <CheckSquare size={10} className="text-white" />}
                      </div>
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${step.status === 'completed' ? 'text-lucy-muted' : 'text-white'}`}>
                          {step.name}
                        </div>
                        <div className="text-[10px] text-lucy-muted uppercase tracking-widest">{step.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Chains */}
              <div className="glass-card p-4 bg-gradient-to-r from-lucy-primary/10 to-transparent border-l-4 border-lucy-primary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp size={20} className="text-lucy-primary" />
                    <div>
                      <div className="text-sm font-bold">{state?.neural_architecture.active_chains} Active Chains</div>
                      <div className="text-[10px] text-lucy-muted">Real-time reasoning active</div>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'debug' && (
            <motion.div
              key="debug"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-[calc(100vh-180px)] space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Debug Monitor</h2>
                  <button className="p-2 hover:bg-white/5 rounded-lg text-lucy-muted"><RefreshCcw size={18} /></button>
                </div>
                
                {/* Search and Filters */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-lucy-muted" size={16} />
                    <input 
                      type="text" 
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      placeholder="Search logs..." 
                      className="w-full glass-card bg-white/5 p-2.5 pl-10 text-sm focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {(['all', 'info', 'warn', 'error', 'success'] as const).map(level => (
                      <button
                        key={level}
                        onClick={() => setLogFilter(level)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all whitespace-nowrap ${
                          logFilter === level 
                            ? 'bg-lucy-primary text-white' 
                            : 'bg-white/5 text-lucy-muted hover:bg-white/10'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 glass-card p-4 overflow-y-auto font-mono text-[10px] space-y-2 bg-black/40">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log, i) => (
                    <div key={i} className="flex gap-2 border-b border-white/5 pb-2 last:border-0 group/log">
                      <span className="text-lucy-muted shrink-0">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
                      <span className={`uppercase font-bold shrink-0 ${
                        log.level === 'warn' ? 'text-amber-500' : 
                        log.level === 'error' ? 'text-red-500' : 
                        log.level === 'success' ? 'text-green-500' : 'text-lucy-primary'
                      }`}>
                        {log.level}:
                      </span>
                      <span className="text-lucy-muted font-bold shrink-0">[{log.source || '?'}]</span>
                      <span className="text-lucy-text break-all flex-1">{log.message}</span>
                      <button 
                        onClick={() => speakLog(log.message)}
                        className="opacity-0 group-hover/log:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
                      >
                        <Bell size={12} className="text-lucy-primary" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-lucy-muted italic">
                    <Search size={32} className="mb-2 opacity-20" />
                    No logs matching criteria
                  </div>
                )}
                <div ref={logEndRef} />
              </div>
            </motion.div>
          )}

          {activeView === 'social' && (
            <motion.div
              key="social"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Share2 className="text-lucy-primary" /> Social Analytics
                </h2>
                <div className="flex gap-1">
                  <button className="p-2 bg-white/5 rounded-lg text-lucy-primary"><TrendingUp size={18} /></button>
                </div>
              </div>

              {/* Analytics Overview */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-4">
                  <div className="text-xs text-lucy-muted mb-1">Followers</div>
                  <div className="text-2xl font-bold">{state?.social_analytics?.followers.toLocaleString()}</div>
                  <div className="text-[10px] text-green-500 flex items-center gap-1 mt-1">
                    <TrendingUp size={10} /> +12% this week
                  </div>
                </div>
                <div className="glass-card p-4">
                  <div className="text-xs text-lucy-muted mb-1">Engagement</div>
                  <div className="text-2xl font-bold">{state?.social_analytics?.engagement_rate}%</div>
                  <div className="text-[10px] text-lucy-primary flex items-center gap-1 mt-1">
                    <BarChart3 size={10} /> Above average
                  </div>
                </div>
              </div>

              {/* Performance Chart Placeholder */}
              <div className="glass-card p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-sm">
                  <TrendingUp size={16} className="text-lucy-primary" />
                  Reach Performance
                </h3>
                <div className="h-32 flex items-end gap-2 px-2">
                  {state?.social_analytics?.post_performance.map((p, i) => {
                    const reachNum = p.reach as number;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${(reachNum / 700) * 100}%` }}
                          className="w-full bg-lucy-primary/40 rounded-t-sm border-t-2 border-lucy-primary"
                        />
                        <span className="text-[8px] text-lucy-muted">{p.date.split('-')[2]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Twitter Integration */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-lucy-muted uppercase tracking-widest">Live Sync</h3>
                  {!twitterConnected ? (
                    <button 
                      onClick={connectTwitter}
                      className="px-3 py-1.5 bg-[#1DA1F2]/20 text-[#1DA1F2] text-xs font-bold rounded-lg border border-[#1DA1F2]/30 hover:bg-[#1DA1F2]/30 transition-colors"
                    >
                      Connect Twitter
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] text-lucy-muted uppercase font-bold">@{twitterUsername}</span>
                       <button onClick={checkTwitterStatus} className="text-lucy-primary hover:text-white transition-colors" title="Sync Now"><RefreshCcw size={14}/></button>
                    </div>
                  )}
                </div>

                {twitterConnected && recentTweets.length > 0 && (
                  <div className="space-y-3">
                    {recentTweets.slice(0, 3).map(tweet => (
                        <div key={tweet.id} className="glass-card p-4 space-y-3 border-l-2 border-[#1DA1F2]">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-[#1DA1F2]/10 flex items-center justify-center text-[#1DA1F2]">
                                <Share2 size={12} />
                              </div>
                              <span className="text-[10px] font-bold uppercase text-lucy-muted">Twitter</span>
                            </div>
                            <span className="text-[10px] text-lucy-muted flex items-center gap-1">
                              <Clock size={10} /> {new Date(tweet.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-lucy-text">"{tweet.text}"</p>
                          <div className="flex gap-4 pt-2 border-t border-white/5 text-[10px] text-lucy-muted font-bold">
                            <span className="flex items-center gap-1"><TrendingUp size={12}/> {tweet.public_metrics?.like_count || 0} Likes</span>
                            <span className="flex items-center gap-1"><Activity size={12}/> {tweet.public_metrics?.retweet_count || 0} Reposts</span>
                          </div>
                        </div>
                    ))}
                  </div>
                )}
                {twitterConnected && recentTweets.length === 0 && (
                   <div className="glass-card p-6 flex flex-col items-center justify-center text-center opacity-60">
                     <p className="text-xs text-lucy-muted">No recent tweets found for your connected account.</p>
                   </div>
                )}
              </div>

              {/* Scheduled Posts */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-lucy-muted uppercase tracking-widest">Scheduled</h3>
                  <button 
                    onClick={() => setIsSchedulingPost(true)}
                    className="p-1.5 bg-lucy-primary/10 text-lucy-primary rounded-lg hover:bg-lucy-primary/20 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {state?.social_analytics?.scheduled_posts.map(post => (
                  <div key={post.id} className="glass-card p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center text-blue-500">
                          <Share2 size={12} />
                        </div>
                        <span className="text-[10px] font-bold uppercase text-lucy-muted">{post.platform}</span>
                      </div>
                      <span className="text-[10px] text-lucy-muted flex items-center gap-1">
                        <Clock size={10} /> {new Date(post.scheduled_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-lucy-text italic">"{post.content}"</p>
                    <div className="flex gap-2 pt-2 border-t border-white/5">
                      <button className="flex-1 py-1.5 bg-white/5 rounded text-[10px] font-bold hover:bg-white/10 transition-colors">Edit</button>
                      <button className="flex-1 py-1.5 bg-red-500/10 text-red-500 rounded text-[10px] font-bold hover:bg-red-500/20 transition-colors">Cancel</button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeView === 'commands' && (
            <motion.div
              key="commands"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-bold">Command Center</h2>
              
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-lucy-muted uppercase tracking-widest">Neural Controls</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => sendCommand('trigger_workflow', { name: 'Memory Consolidation' })}
                    className="glass-card p-4 text-left hover:bg-lucy-primary/10 transition-colors group"
                  >
                    <Zap size={20} className="text-lucy-primary mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-sm">Consolidate Memory</div>
                    <div className="text-[10px] text-lucy-muted">Optimize agent storage</div>
                  </button>
                  <button 
                    onClick={() => sendCommand('update_agent_param', { agent: 'Reasoning', param: 'depth', value: 'high' })}
                    className="glass-card p-4 text-left hover:bg-lucy-primary/10 transition-colors group"
                  >
                    <Brain size={20} className="text-lucy-primary mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-sm">Boost Reasoning</div>
                    <div className="text-[10px] text-lucy-muted">Increase chain depth</div>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-lucy-muted uppercase tracking-widest">FiveM Controls</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => sendCommand('spawn_npc', { gang: 'Ballas', count: 1 })}
                    className="glass-card p-4 text-left hover:bg-lucy-primary/10 transition-colors group"
                  >
                    <Plus size={20} className="text-lucy-primary mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-sm">Spawn Ballas</div>
                    <div className="text-[10px] text-lucy-muted">Trigger NPC workflow</div>
                  </button>
                  <button 
                    onClick={() => sendCommand('restart_resource', { name: 'civil_unrest_gangs' })}
                    className="glass-card p-4 text-left hover:bg-amber-500/10 transition-colors group"
                  >
                    <RefreshCcw size={20} className="text-amber-500 mb-2 group-hover:rotate-180 transition-transform duration-500" />
                    <div className="font-bold text-sm">Restart Core</div>
                    <div className="text-[10px] text-lucy-muted">Reload gang scripts</div>
                  </button>
                </div>
              </div>

              <form onSubmit={handleCommandSubmit} className="space-y-3">
                <h3 className="text-sm font-bold text-lucy-muted uppercase tracking-widest">Custom Command</h3>
                <div className="relative">
                  <input
                    type="text"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    placeholder="💬 Type a command for Lucy..."
                    className="w-full glass-card bg-white/5 p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-lucy-primary/50 transition-all"
                  />
                  <button 
                    type="submit"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-lucy-primary text-white rounded-lg shadow-lg shadow-lucy-primary/30"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {activeView === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-bold">Settings</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-lucy-muted uppercase tracking-widest">Dashboards</h3>
                  <span className="text-[10px] text-lucy-muted italic">Drag to reorder</span>
                </div>
                
                <Reorder.Group 
                  axis="y" 
                  values={enabledDashboards} 
                  onReorder={setEnabledDashboards}
                  className="space-y-2"
                >
                  {enabledDashboards.map(view => {
                    const config = VIEW_CONFIG[view as keyof typeof VIEW_CONFIG];
                    if (!config) return null;
                    return (
                      <Reorder.Item 
                        key={view} 
                        value={view}
                        className="glass-card p-4 flex items-center justify-between cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical size={16} className="text-lucy-muted" />
                          <div className="text-lucy-primary"><config.icon size={18} /></div>
                          <span className="text-sm font-medium capitalize">{config.label}</span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEnabledDashboards(prev => prev.filter(v => v !== view));
                          }}
                          className="w-10 h-5 rounded-full transition-all relative bg-lucy-primary"
                        >
                          <motion.div 
                            animate={{ x: 20 }}
                            className="absolute top-1 w-3 h-3 bg-white rounded-full"
                          />
                        </button>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>

                {/* Add more dashboards section */}
                {Object.keys(VIEW_CONFIG).some(v => !enabledDashboards.includes(v as View)) && (
                  <div className="space-y-2 pt-4 border-t border-white/5">
                    <h4 className="text-[10px] font-bold text-lucy-muted uppercase tracking-widest">Disabled Dashboards</h4>
                    <div className="space-y-2">
                      {Object.entries(VIEW_CONFIG)
                        .filter(([view]) => !enabledDashboards.includes(view as View))
                        .map(([view, config]) => (
                          <div key={view} className="glass-card p-4 flex items-center justify-between opacity-60">
                            <div className="flex items-center gap-3">
                              <div className="text-lucy-muted"><config.icon size={18} /></div>
                              <span className="text-sm font-medium capitalize">{config.label}</span>
                            </div>
                            <button 
                              onClick={() => setEnabledDashboards(prev => [...prev, view as View])}
                              className="w-10 h-5 rounded-full transition-all relative bg-white/10"
                            >
                              <motion.div 
                                animate={{ x: 2 }}
                                className="absolute top-1 w-3 h-3 bg-white rounded-full"
                              />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-lucy-muted uppercase tracking-widest">API Integrations</h3>
                <div className="glass-card p-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-lucy-muted uppercase font-bold">Twitter API Key</label>
                    <input type="password" value="••••••••••••••••" readOnly className="w-full bg-white/5 border border-white/10 p-2 rounded text-xs focus:outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-lucy-muted uppercase font-bold">FXServer Token</label>
                    <input type="password" value="••••••••••••••••" readOnly className="w-full bg-white/5 border border-white/10 p-2 rounded text-xs focus:outline-none" />
                  </div>
                  <button className="w-full py-2 bg-lucy-primary/10 text-lucy-primary text-xs font-bold rounded-lg border border-lucy-primary/20">
                    Link New Platform
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'ai' && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col h-[calc(100vh-180px)] space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Brain className="text-lucy-primary" /> Neural Chat
                </h2>
                <button onClick={() => setAiChat([])} className="text-xs text-lucy-muted hover:text-white transition-colors">Clear</button>
              </div>

              <div className="flex-1 glass-card p-4 overflow-y-auto space-y-4 bg-black/40">
                {aiChat.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-lucy-muted text-center p-8">
                    <MessageSquare size={48} className="mb-4 opacity-20" />
                    <p className="text-sm">Ask Lucy anything about the server or neural architecture.</p>
                  </div>
                )}
                {aiChat.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                      msg.role === 'user' 
                        ? 'bg-lucy-primary text-white rounded-tr-none' 
                        : 'bg-white/5 text-lucy-text rounded-tl-none border border-white/10'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isAiThinking && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/10 flex gap-1">
                      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-lucy-primary rounded-full" />
                      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-lucy-primary rounded-full" />
                      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-lucy-primary rounded-full" />
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAiQuery()}
                  placeholder="Ask Lucy..."
                  className="w-full glass-card bg-white/5 p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-lucy-primary/50 transition-all"
                />
                <button 
                  onClick={handleAiQuery}
                  disabled={isAiThinking}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-lucy-primary text-white rounded-lg disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {activeView === 'media' && (
            <motion.div
              key="media"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Video className="text-lucy-primary" /> Media Generation
              </h2>

              <div className="glass-card p-6 space-y-4">
                <div className="aspect-video bg-black/40 rounded-xl overflow-hidden flex items-center justify-center relative border border-white/5">
                  {generatedMediaUrl ? (
                    <video src={generatedMediaUrl} controls className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-8">
                      <Video size={48} className="mx-auto mb-4 opacity-10" />
                      <p className="text-sm text-lucy-muted">Generate cinematic server trailers or NPC interactions.</p>
                    </div>
                  )}
                  {isGeneratingMedia && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="text-lucy-primary"
                      >
                        <RefreshCcw size={32} />
                      </motion.div>
                      <p className="text-xs font-bold text-lucy-primary animate-pulse">VE-O 3.1 GENERATING...</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <textarea
                    value={mediaPrompt}
                    onChange={(e) => setMediaPrompt(e.target.value)}
                    placeholder="Describe the video scene..."
                    className="w-full glass-card bg-white/5 p-4 text-sm focus:outline-none min-h-[100px] resize-none"
                  />
                  <button
                    onClick={handleGenerateVideo}
                    disabled={isGeneratingMedia || !mediaPrompt.trim()}
                    className="w-full py-3 bg-lucy-primary text-white rounded-xl font-bold hover:bg-lucy-primary/80 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Zap size={18} />
                    GENERATE VIDEO (VEO)
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'checklists' && (
            <motion.div
              key="checklists"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Checklists</h2>
                <button className="text-lucy-primary text-sm font-bold flex items-center gap-1">
                  <Plus size={16} /> New
                </button>
              </div>
              
              <div className="space-y-3">
                {state?.pending_tasks.map(task => (
                  <div key={task.id} className="glass-card p-4 flex items-center gap-4 hover:bg-white/5 transition-colors">
                    <button className="w-6 h-6 rounded border-2 border-lucy-primary/50 flex items-center justify-center text-lucy-primary">
                      {task.status === 'completed' && <CheckSquare size={16} />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-sm">{task.title}</div>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          task.priority === 'high' ? 'bg-red-500/10 text-red-500' :
                          task.priority === 'medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-lucy-muted/10 text-lucy-muted'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                      <div className="text-[10px] text-lucy-muted">Assigned by Lucy Orchestrator</div>
                    </div>
                    <ChevronRight size={16} className="text-lucy-muted" />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeView === 'music' && (
            <motion.div
              key="music"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Music className="text-lucy-primary" /> Audio Generation
              </h2>

              <div className="glass-card p-6 space-y-4">
                <div className="h-48 bg-black/40 rounded-xl overflow-hidden flex items-center justify-center relative border border-white/5">
                  {generatedMediaUrl ? (
                    <div className="w-full px-8 space-y-4">
                      <div className="flex items-center justify-center gap-4">
                        <button className="p-4 bg-lucy-primary text-white rounded-full shadow-lg shadow-lucy-primary/20">
                          <Play size={24} />
                        </button>
                      </div>
                      <audio src={generatedMediaUrl} controls className="w-full" />
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <Music size={48} className="mx-auto mb-4 opacity-10" />
                      <p className="text-sm text-lucy-muted">Generate cinematic soundtracks or radio clips using Lyria.</p>
                    </div>
                  )}
                  {isGeneratingMedia && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="text-lucy-primary"
                      >
                        <Music size={32} />
                      </motion.div>
                      <p className="text-xs font-bold text-lucy-primary animate-pulse">LYRIA GENERATING...</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <textarea
                    value={mediaPrompt}
                    onChange={(e) => setMediaPrompt(e.target.value)}
                    placeholder="Describe the music style (e.g., 'Cinematic orchestral track for a high-speed chase')..."
                    className="w-full glass-card bg-white/5 p-4 text-sm focus:outline-none min-h-[100px] resize-none"
                  />
                  <button
                    onClick={handleGenerateMusic}
                    disabled={isGeneratingMedia || !mediaPrompt.trim()}
                    className="w-full py-3 bg-lucy-primary text-white rounded-xl font-bold hover:bg-lucy-primary/80 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Zap size={18} />
                    GENERATE AUDIO (LYRIA)
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'voice' && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Mic className="text-lucy-primary" /> Live Voice
              </h2>

              <div className="glass-card p-8 flex flex-col items-center justify-center space-y-8 min-h-[400px] relative overflow-hidden">
                {/* Visualizer Effect */}
                <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                  <div className="flex gap-1 items-end h-32">
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ height: isLiveActive ? [20, 80, 40, 100, 20] : 10 }}
                        transition={{ repeat: Infinity, duration: 0.5 + Math.random(), ease: "easeInOut" }}
                        className="w-2 bg-lucy-primary rounded-t-full"
                      />
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <motion.div
                    animate={isLiveActive ? { scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className={`w-32 h-32 rounded-full flex items-center justify-center border-4 transition-all ${
                      isLiveActive ? 'bg-lucy-primary/20 border-lucy-primary shadow-2xl shadow-lucy-primary/40' : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <Mic size={48} className={isLiveActive ? 'text-lucy-primary' : 'text-lucy-muted'} />
                  </motion.div>
                  {isLiveActive && (
                    <motion.div
                      layoutId="live-indicator"
                      className="absolute -top-2 -right-2 px-2 py-1 bg-red-500 text-white text-[8px] font-bold rounded-full animate-pulse"
                    >
                      LIVE
                    </motion.div>
                  )}
                </div>

                <div className="text-center space-y-2">
                  <h3 className="font-bold text-lg">{isLiveActive ? 'Lucy is listening...' : 'Start Live Session'}</h3>
                  <p className="text-xs text-lucy-muted max-w-xs mx-auto">
                    {isLiveActive 
                      ? 'Speak naturally to interact with the neural architecture in real-time.' 
                      : 'Connect to the Gemini 3.1 Flash Live engine for low-latency voice interaction.'}
                  </p>
                </div>

                <button
                  onClick={() => setIsLiveActive(!isLiveActive)}
                  className={`px-8 py-3 rounded-full font-bold transition-all flex items-center gap-2 ${
                    isLiveActive ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-lucy-primary text-white hover:bg-lucy-primary/80'
                  }`}
                >
                  {isLiveActive ? <X size={20} /> : <Play size={20} />}
                  {isLiveActive ? 'DISCONNECT' : 'CONNECT LIVE'}
                </button>

                {isLiveActive && (
                  <div className="w-full max-w-md bg-black/20 rounded-xl p-4 border border-white/5 max-h-32 overflow-y-auto no-scrollbar">
                    <p className="text-[10px] text-lucy-muted uppercase font-bold mb-2">Live Transcript</p>
                    <div className="space-y-1">
                      {liveTranscript.map((t, i) => (
                        <p key={i} className="text-xs text-lucy-text">{t}</p>
                      ))}
                      {liveTranscript.length === 0 && <p className="text-xs text-lucy-muted italic">Waiting for speech...</p>}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Schedule Post Modal */}
      <AnimatePresence>
        {isSchedulingPost && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsSchedulingPost(false)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="glass-card w-full max-w-md p-6 space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Share2 className="text-lucy-primary" size={20} />
                  Schedule Post
                </h2>
                <button onClick={() => setIsSchedulingPost(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-lucy-muted uppercase">Platform</label>
                  <select 
                    value={newPostPlatform}
                    onChange={(e) => setNewPostPlatform(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-lucy-primary transition-colors"
                  >
                    <option value="Twitter" className="bg-lucy-bg">Twitter / X</option>
                    <option value="Instagram" className="bg-lucy-bg">Instagram</option>
                    <option value="LinkedIn" className="bg-lucy-bg">LinkedIn</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-lucy-muted uppercase">Content</label>
                  <textarea 
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="What's happening?"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-lucy-primary transition-colors min-h-[120px] resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-lucy-muted uppercase">Scheduled Time</label>
                  <input 
                    type="datetime-local"
                    value={newPostTime}
                    onChange={(e) => setNewPostTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-lucy-primary transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsSchedulingPost(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-bold transition-colors"
                >
                  CANCEL
                </button>
                <button 
                  onClick={() => {
                    if (newPostContent && newPostTime) {
                      sendCommand('schedule_post', { 
                        content: newPostContent, 
                        platform: newPostPlatform, 
                        at: newPostTime 
                      });
                      setIsSchedulingPost(false);
                      setNewPostContent('');
                      setNewPostTime('');
                    }
                  }}
                  disabled={!newPostContent || !newPostTime}
                  className="flex-1 py-3 rounded-xl bg-lucy-primary text-white font-bold hover:bg-lucy-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  SCHEDULE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent Detail Modal */}
      <AnimatePresence>
        {selectedAgent && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedAgent(null)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="glass-card w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    selectedAgent.status === 'active' ? 'bg-green-500' : 
                    selectedAgent.status === 'busy' ? 'bg-amber-500' : 'bg-gray-500'
                  }`} />
                  <h2 className="text-xl font-bold">{selectedAgent.name}</h2>
                </div>
                <button 
                  onClick={() => setSelectedAgent(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {/* Description */}
                <section>
                  <h3 className="text-xs font-bold text-lucy-muted uppercase tracking-wider mb-2">Description</h3>
                  <p className="text-sm text-lucy-text leading-relaxed">
                    {selectedAgent.description}
                  </p>
                </section>

                {/* Parameters */}
                <section>
                  <h3 className="text-xs font-bold text-lucy-muted uppercase tracking-wider mb-3">Parameters</h3>
                  <div className="space-y-4">
                    {Object.entries(selectedAgent.parameters).map(([key, p]) => {
                      const param = p as any; // Cast to any to avoid TS errors with unknown
                      return (
                        <div key={key} className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-lucy-text capitalize">
                              {key.replace(/_/g, ' ')}
                            </label>
                            <span className="text-[10px] text-lucy-muted">{param.description}</span>
                          </div>
                          {param.type === 'select' ? (
                            <select 
                              value={param.value}
                              onChange={(e) => sendCommand('update_agent_param', { agentId: selectedAgent.id, paramKey: key, value: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm outline-none focus:border-lucy-primary transition-colors"
                            >
                              {param.options?.map((opt: string) => (
                                <option key={opt} value={opt} className="bg-lucy-bg">{opt}</option>
                              ))}
                            </select>
                          ) : param.type === 'number' ? (
                            <input 
                              type="number"
                              value={param.value}
                              onChange={(e) => sendCommand('update_agent_param', { agentId: selectedAgent.id, paramKey: key, value: parseFloat(e.target.value) })}
                              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm outline-none focus:border-lucy-primary transition-colors"
                            />
                          ) : param.type === 'boolean' ? (
                            <button 
                              onClick={() => sendCommand('update_agent_param', { agentId: selectedAgent.id, paramKey: key, value: !param.value })}
                              className={`w-full p-2 rounded-lg text-sm font-medium transition-colors ${
                                param.value ? 'bg-lucy-primary/20 text-lucy-primary border border-lucy-primary/30' : 'bg-white/5 text-lucy-muted border border-white/10'
                              }`}
                            >
                              {param.value ? 'ENABLED' : 'DISABLED'}
                            </button>
                          ) : (
                            <input 
                              type="text"
                              value={param.value}
                              onChange={(e) => sendCommand('update_agent_param', { agentId: selectedAgent.id, paramKey: key, value: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm outline-none focus:border-lucy-primary transition-colors"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Active Tasks */}
                <section>
                  <h3 className="text-xs font-bold text-lucy-muted uppercase tracking-wider mb-2">Active Tasks</h3>
                  <div className="space-y-2">
                    {selectedAgent.active_tasks.length > 0 ? (
                      selectedAgent.active_tasks.map((task) => (
                        <div key={task.id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5 group/task">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              task.status === 'running' ? 'bg-lucy-primary animate-pulse' : 'bg-amber-500'
                            }`} />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{task.title}</span>
                              <span className="text-[10px] text-lucy-muted uppercase">{task.status}</span>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity">
                            {task.status === 'running' ? (
                              <button 
                                onClick={() => sendCommand('pause_task', { agentId: selectedAgent.id, taskId: task.id })}
                                className="p-1.5 hover:bg-amber-500/20 text-amber-500 rounded-md transition-colors"
                                title="Pause Task"
                              >
                                <Pause size={14} />
                              </button>
                            ) : (
                              <button 
                                onClick={() => sendCommand('resume_task', { agentId: selectedAgent.id, taskId: task.id })}
                                className="p-1.5 hover:bg-green-500/20 text-green-500 rounded-md transition-colors"
                                title="Resume Task"
                              >
                                <Play size={14} />
                              </button>
                            )}
                            <button 
                              onClick={() => sendCommand('cancel_task', { agentId: selectedAgent.id, taskId: task.id })}
                              className="p-1.5 hover:bg-red-500/20 text-red-500 rounded-md transition-colors"
                              title="Cancel Task"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-lucy-muted italic">No active tasks</p>
                    )}
                  </div>
                </section>

                {/* Agent Logs */}
                <section>
                  <h3 className="text-xs font-bold text-lucy-muted uppercase tracking-wider mb-2">Agent Logs</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                    {selectedAgent.logs.length > 0 ? (
                      selectedAgent.logs.map((log, i) => (
                        <div key={i} className="text-[10px] font-mono p-2 bg-black/20 rounded border-l-2 border-white/10">
                          <div className="flex justify-between mb-1">
                            <span className="text-lucy-muted">{new Date(log.timestamp).toLocaleTimeString()}</span>
                            <span className={
                              log.level === 'error' ? 'text-red-400' : 
                              log.level === 'warn' ? 'text-amber-400' : 
                              log.level === 'success' ? 'text-green-400' : 'text-blue-400'
                            }>
                              {log.level.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-lucy-text">{log.message}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-lucy-muted italic">No recent logs</p>
                    )}
                  </div>
                </section>
              </div>

              <div className="p-4 border-t border-white/10 bg-white/5 flex gap-3">
                <button 
                  onClick={() => setSelectedAgent(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 font-bold transition-colors"
                >
                  CLOSE
                </button>
                <button 
                  onClick={() => {
                    sendCommand('restart_agent', { agentId: selectedAgent.id });
                    setSelectedAgent(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-bold transition-colors"
                >
                  RESTART AGENT
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Profile Modal */}
        <AnimatePresence>
          {isProfileOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsProfileOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md glass-card p-8 space-y-6 overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4">
                  <button onClick={() => setIsProfileOpen(false)} className="text-lucy-muted hover:text-white">
                    <X size={24} />
                  </button>
                </div>

                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-24 h-24 rounded-3xl bg-lucy-primary/20 border-2 border-lucy-primary/40 p-1">
                    <div className="w-full h-full rounded-2xl overflow-hidden bg-black/40">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lucy-primary">
                          <UserIcon size={48} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{user?.displayName || 'Lucy User'}</h2>
                    <p className="text-sm text-lucy-muted">{user?.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-lucy-primary/10 text-lucy-primary text-[10px] font-bold uppercase tracking-widest rounded-full border border-lucy-primary/20">
                      Administrator
                    </span>
                    <span className="px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-widest rounded-full border border-green-500/20">
                      Verified
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                  <button className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
                    <Settings size={18} /> Account Settings
                  </button>
                  <button 
                    onClick={() => { logOut(); setIsProfileOpen(false); }}
                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <LogOut size={18} /> Sign Out
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Notifications Modal */}
        <AnimatePresence>
          {isNotificationsOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsNotificationsOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 100 }}
                className="relative w-full max-w-md h-[80vh] glass-card flex flex-col overflow-hidden"
              >
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Bell className="text-lucy-primary" /> Notifications
                  </h2>
                  <button onClick={() => setIsNotificationsOpen(false)} className="text-lucy-muted hover:text-white">
                    <X size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {state?.pending_tasks.map(task => (
                    <div key={task.id} className="glass-card p-4 space-y-2 border-l-4 border-lucy-primary">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-lucy-primary uppercase tracking-widest">New Task</span>
                        <span className="text-[10px] text-lucy-muted">Just now</span>
                      </div>
                      <p className="text-sm font-medium text-white">{task.title}</p>
                      <div className="flex gap-2 pt-2">
                        <button className="px-3 py-1 bg-lucy-primary text-white text-[10px] font-bold rounded-lg">View</button>
                        <button className="px-3 py-1 bg-white/5 text-lucy-muted text-[10px] font-bold rounded-lg">Dismiss</button>
                      </div>
                    </div>
                  ))}
                  {state?.logs.slice(0, 5).map((log, i) => (
                    <div key={i} className="glass-card p-4 space-y-1 opacity-60">
                      <div className="flex justify-between items-start">
                        <span className={`text-[8px] font-bold uppercase ${
                          log.level === 'error' ? 'text-red-500' : 
                          log.level === 'warn' ? 'text-amber-500' : 'text-lucy-muted'
                        }`}>{log.level}</span>
                        <span className="text-[8px] text-lucy-muted">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-lucy-text line-clamp-1">{log.message}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto glass-card rounded-none border-x-0 border-b-0 p-2 flex justify-around items-center z-40">
        <button 
          onClick={() => setActiveView('dashboard')}
          className={`p-3 rounded-xl transition-all ${activeView === 'dashboard' ? 'text-lucy-primary bg-lucy-primary/10' : 'text-lucy-muted'}`}
        >
          <LayoutDashboard size={24} />
        </button>
        <button 
          onClick={() => setActiveView('neural')}
          className={`p-3 rounded-xl transition-all ${activeView === 'neural' ? 'text-lucy-primary bg-lucy-primary/10' : 'text-lucy-muted'}`}
        >
          <Brain size={24} />
        </button>
        <button 
          onClick={() => setActiveView('debug')}
          className={`p-3 rounded-xl transition-all ${activeView === 'debug' ? 'text-lucy-primary bg-lucy-primary/10' : 'text-lucy-muted'}`}
        >
          <Terminal size={24} />
        </button>
        <button 
          onClick={() => setActiveView('social')}
          className={`p-3 rounded-xl transition-all ${activeView === 'social' ? 'text-lucy-primary bg-lucy-primary/10' : 'text-lucy-muted'}`}
        >
          <Share2 size={24} />
        </button>
      </nav>
    </div>
  );
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
