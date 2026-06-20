import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import { TwitterApi } from 'twitter-api-v2';
import session from 'express-session';
import cookieParser from 'cookie-parser';

// Extend the session type directly in this file
declare module 'express-session' {
  interface SessionData {
    twitterCodeVerifier: string;
    twitterState: string;
    twitterRedirectUri: string;
    twitterAccessToken: string;
    twitterRefreshToken: string;
    twitterUserId: string;
    twitterUsername: string;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin for backend sync (bypasses security rules)
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8'));

console.log(`Initializing Firebase Admin for project: ${firebaseConfig.projectId}, database: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);

// Primary App (Provisioned)
const adminApp = initializeApp({
  projectId: firebaseConfig.projectId,
});

// Use the specific database ID if provided, otherwise use (default)
let db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(adminApp);

// Test backend connection
(async () => {
  try {
    const testDoc = db.collection('_system').doc('connection_test');
    await testDoc.set({ last_test: new Date().toISOString(), status: 'ok' });
    console.log(`Backend Firestore connection to ${firebaseConfig.projectId}/${firebaseConfig.firestoreDatabaseId || '(default)'} successful.`);
  } catch (err) {
    console.error(`Backend Firestore connection failed:`, err);
    console.warn("Backend will continue with in-memory state. Client-side sync will handle persistence.");
  }
})();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  app.use(session({
    secret: process.env.SESSION_SECRET || 'lucy-super-secret-key-fallback',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: true,
      sameSite: 'none',
      httpOnly: true,
    }
  }));

  const twitterClient = new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID || '',
    clientSecret: process.env.TWITTER_CLIENT_SECRET || ''
  });

  // Mock states for Lucy (multi-user)
  const userStates = new Map<string, any>();

  const getInitialState = () => ({
    npc_counts: { Ballas: 5, Families: 3, Vagos: 2 },
    active_resources: ["civil_unrest_gangs", "npc_police", "lucy_core"],
    system_load: { cpu: 42, memory: 35, io: 12 },
    player_activity: 12,
    pending_tasks: [
      { id: "1", title: "Debug NPC spawn", status: "pending", priority: "high" },
      { id: "2", title: "Update Ballas patrol routes", status: "pending", priority: "medium" }
    ],
    logs: [
      { timestamp: new Date().toISOString(), level: "info", message: "Lucy Mobile Twin connected.", source: "System" },
      { timestamp: new Date().toISOString(), level: "warn", message: "NPC spawn delay detected in Zone 4.", source: "FiveM" }
    ],
    neural_architecture: {
      mood: "Focused",
      active_chains: 3,
      agents: [
        { 
          id: "mem-1", 
          name: "Memory", 
          status: "active", 
          load: 25, 
          last_action: "Retrieving gang history",
          description: "Long-term and short-term memory storage and retrieval system.",
          parameters: {
            retention_period: { value: 30, type: 'number', description: "Days to keep logs" },
            index_depth: { value: 'deep', type: 'select', options: ['shallow', 'medium', 'deep'], description: "Indexing granularity" }
          },
          active_tasks: [
            { id: "t-1", title: "Indexing Ballas patrol logs", status: "running" },
            { id: "t-2", title: "Cleaning old session data", status: "paused" }
          ],
          logs: [
            { timestamp: new Date().toISOString(), level: "info", message: "Memory index updated for Zone 4.", source: "Memory" },
            { timestamp: new Date().toISOString(), level: "success", message: "Retrieved 12 historical records for 'Ballas'.", source: "Memory" }
          ]
        },
        { 
          id: "reas-1", 
          name: "Reasoning", 
          status: "busy", 
          load: 80, 
          last_action: "Analyzing spawn failure",
          description: "Complex reasoning and decision-making engine using Gemini 3.1 Pro.",
          parameters: {
            thinking_level: { value: 'HIGH', type: 'select', options: ['MINIMAL', 'LOW', 'HIGH'], description: "Reasoning intensity" },
            max_chains: { value: 5, type: 'number', description: "Maximum concurrent reasoning chains" }
          },
          active_tasks: [
            { id: "t-3", title: "Root cause analysis for NPC spawn delay", status: "running" },
            { id: "t-4", title: "Optimizing patrol routes", status: "running" }
          ],
          logs: [
            { timestamp: new Date().toISOString(), level: "info", message: "Starting deep reasoning for spawn failure.", source: "Reasoning" },
            { timestamp: new Date().toISOString(), level: "warn", message: "Chain 3 timeout, retrying with higher depth.", source: "Reasoning" }
          ]
        },
        { 
          id: "tts-1", 
          name: "TTS Agent", 
          status: "idle", 
          load: 0, 
          last_action: "None",
          description: "Text-to-speech engine using Gemini 2.5 Flash TTS.",
          parameters: {
            voice: { value: 'Kore', type: 'select', options: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'], description: "Voice persona" },
            speed: { value: 1.0, type: 'number', description: "Speech rate" }
          },
          active_tasks: [],
          logs: []
        },
        { 
          id: "vid-1", 
          name: "Video Agent", 
          status: "idle", 
          load: 0, 
          last_action: "None",
          description: "Video understanding and generation using Veo 3.1.",
          parameters: {
            resolution: { value: '1080p', type: 'select', options: ['720p', '1080p'], description: "Output resolution" },
            aspect_ratio: { value: '16:9', type: 'select', options: ['16:9', '9:16'], description: "Video aspect ratio" }
          },
          active_tasks: [],
          logs: []
        },
        { 
          id: "mus-1", 
          name: "Audio Agent", 
          status: "idle", 
          load: 5, 
          last_action: "None",
          description: "Music and clip generation using Lyria.",
          parameters: {
            duration: { value: 30, type: 'number', description: "Clip length in seconds" },
            genre_bias: { value: 'Cinematic', type: 'string', description: "Preferred music style" }
          },
          active_tasks: [],
          logs: []
        },
        { 
          id: "live-1", 
          name: "Live Agent", 
          status: "active", 
          load: 15, 
          last_action: "Listening for voice input",
          description: "Real-time voice conversation engine using Gemini 3.1 Flash Live.",
          parameters: {
            transcription: { value: true, type: 'boolean', description: "Enable real-time transcription" },
            interruption_sensitivity: { value: 0.7, type: 'number', description: "Sensitivity to user speech" }
          },
          active_tasks: [
            { id: "t-5", title: "Monitoring voice channel", status: "running" }
          ],
          logs: [
            { timestamp: new Date().toISOString(), level: "info", message: "Live session established.", source: "Live" }
          ]
        },
        { 
          id: "fm-1", 
          name: "FiveM", 
          status: "active", 
          load: 45, 
          last_action: "Monitoring NPC activity",
          description: "Direct bridge to FXServer for real-time game interaction.",
          parameters: {
            sync_rate: { value: 100, type: 'number', description: "State sync frequency (ms)" },
            debug_mode: { value: false, type: 'boolean', description: "Enable verbose server logging" }
          },
          active_tasks: [
            { id: "t-6", title: "Syncing NPC positions", status: "running" },
            { id: "t-7", title: "Monitoring gang territories", status: "running" }
          ],
          logs: [
            { timestamp: new Date().toISOString(), level: "info", message: "FiveM state synchronized.", source: "FiveM" }
          ]
        }
      ],
      workflow_pipeline: [
        { id: "wf-1", name: "NPC Spawn Validation", status: "running" },
        { id: "wf-2", name: "Gang Territory Update", status: "pending" },
        { id: "wf-3", name: "Log Cleanup", status: "completed" }
      ]
    },
    social_analytics: {
      platform: "twitter",
      followers: 1250,
      engagement_rate: 4.2,
      post_performance: [
        { date: "2026-04-01", reach: 450 },
        { date: "2026-04-02", reach: 620 },
        { date: "2026-04-03", reach: 580 }
      ],
      scheduled_posts: [
        { id: "sp-1", content: "Exciting updates coming to the server! #FiveM #Lucy", scheduled_at: "2026-04-04T10:00:00Z", platform: "twitter" }
      ]
    }
  });

  const syncToFirestore = async (userId: string, state: any) => {
    try {
      const docRef = db.collection('states').doc(userId);
      await docRef.set(state);
    } catch (err) {
      // Log only once in a while or if it's not a permission error to avoid spamming
      // But for now we'll just log it as a warning
      console.warn(`Backend Firestore sync failed for user ${userId}. Persistence relying on client-side sync.`);
    }
  };

  const fetchFromFirestore = async (userId: string) => {
    try {
      const docSnap = await db.collection('states').doc(userId).get();
      return docSnap.exists ? docSnap.data() : null;
    } catch (err) {
      console.warn(`Backend Firestore fetch failed for user ${userId}. Starting with initial state.`);
      return null;
    }
  };

  // API Routes
  
  // Twitter OAuth Init
  app.get('/api/auth/twitter/url', (req, res) => {
    const redirectUri = req.query.redirectUri as string;
    if (!redirectUri) return res.status(400).json({ error: 'Missing redirectUri' });

    if (!process.env.TWITTER_CLIENT_ID) {
      return res.status(500).json({ error: 'TWITTER_CLIENT_ID not configured' });
    }

    try {
      const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(redirectUri, { scope: ['tweet.read', 'users.read'] });
      
      req.session.twitterCodeVerifier = codeVerifier;
      req.session.twitterState = state;
      req.session.twitterRedirectUri = redirectUri;

      res.json({ url });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to generate Twitter auth URL' });
    }
  });

  // Twitter OAuth Callback
  app.get(['/api/auth/twitter/callback', '/api/auth/twitter/callback/'], async (req, res) => {
    const { state, code } = req.query;
    const { twitterCodeVerifier, twitterState, twitterRedirectUri } = req.session;

    if (!twitterCodeVerifier || !state || !twitterState || !code) {
        return res.status(400).send('Invalid request or session expired');
    }

    if (state !== twitterState) {
        return res.status(400).send('State mismatch');
    }

    try {
        const { client: loggedClient, accessToken, refreshToken } = await twitterClient.loginWithOAuth2({
            code: code as string,
            codeVerifier: twitterCodeVerifier,
            redirectUri: twitterRedirectUri as string
        });

        req.session.twitterAccessToken = accessToken;
        req.session.twitterRefreshToken = refreshToken;

        const { data: user } = await loggedClient.v2.me();
        req.session.twitterUserId = user.id;
        req.session.twitterUsername = user.username;

        res.send(`
        <html>
            <body>
            <script>
                if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', platform: 'twitter' }, '*');
                window.close();
                } else {
                window.location.href = '/';
                }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
            </body>
        </html>
        `);
    } catch (e) {
        console.error("Twitter login error:", e);
        res.status(500).send('Authentication failed');
    }
  });

  app.get('/api/auth/twitter/status', (req, res) => {
    res.json({ 
        connected: !!req.session.twitterAccessToken,
        username: req.session.twitterUsername || null
    });
  });

  // Fetch Tweets
  app.get('/api/social/posts', async (req, res) => {
    if (!req.session.twitterAccessToken) {
        return res.status(401).json({ error: 'Not authenticated with Twitter' });
    }
    
    try {
        const client = new TwitterApi(req.session.twitterAccessToken);
        const userId = req.session.twitterUserId!;
        // Fetch real tweets
        const tweets = await client.v2.userTimeline(userId, {
            max_results: 10,
            'tweet.fields': ['created_at', 'public_metrics']
        });
        
        // Map to our ScheduledPost format to display alongside for now, or just send raw
        res.json(tweets.data.data);
    } catch (err) {
        console.error("Failed to fetch tweets", err);
        res.status(500).json({ error: 'Failed to fetch tweets' });
    }
  });

  app.get("/api/state", async (req, res) => {
    const userId = req.query.userId as string || "default";
    let state = userStates.get(userId);
    if (!state) {
      // Try to fetch from Firestore first
      state = await fetchFromFirestore(userId);
      if (!state) {
        state = getInitialState();
      }
      userStates.set(userId, state);
    }
    // Randomize some values for real-time feel
    state.system_load.cpu = Math.floor(Math.random() * 20) + 30;
    state.system_load.memory = Math.floor(Math.random() * 10) + 30;
    state.neural_architecture.agents.forEach((a: any) => {
      if (a.status !== 'idle') a.load = Math.floor(Math.random() * 40) + 20;
    });
    
    // Sync back to Firestore periodically or on change
    syncToFirestore(userId, state);
    
    res.json(state);
  });

  app.post("/api/command", async (req, res) => {
    const { command, args, userId = "default" } = req.body;
    console.log(`Received command from ${userId}: ${command}`, args);
    
    try {
      // Forward to the real Desktop OS Orchestrator
      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", text: command }],
          contextState: args
        })
      });

      if (!response.ok) {
        throw new Error(`OS Backend returned ${response.status}`);
      }

      const data = await response.json();
      
      // We can still log it to Firestore so the mobile app has history
      let state = await fetchFromFirestore(userId) || getInitialState();
      state.logs.unshift({
        timestamp: new Date().toISOString(),
        level: "success",
        message: `Executed: ${command}`,
        source: "Mobile Bridge"
      });
      await syncToFirestore(userId, state);

      res.json({ status: "success", result: data.text });
    } catch (err: any) {
      console.error("Command proxy failed:", err.message);
      res.status(500).json({ status: "error", error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lucy Mobile Twin server running on http://localhost:${PORT}`);
  });
}

startServer();
