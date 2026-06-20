/*
 Minimal Electron main process scaffold for the Dual-Browser Mirror panel.
 This is a stub that opens a BrowserWindow loading the Next.js app (assumed at http://localhost:3000)
 and forwards an example IPC channel to the local toolbelt API.

 In a full implementation we would:
 - Integrate native WebRTC playback or a <video> element in the renderer
 - Expose IPC endpoints to call the local toolbelt server
 - Mount the mirrored browser panel at system tool level (requires OS integration)
*/
const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const net = require('net')
const { spawn } = require('child_process')
const isDev = process.env.NODE_ENV !== 'production'
const { read, write } = require('./consent_store')
const { load_env, read_consent } = require('../shared/config')

let radioWin = null;
let spotifyAuthWin = null;

function createRadioWindow() {
  radioWin = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  radioWin.loadFile(path.join(__dirname, 'radio.html'))
}

function createWindow() {
  // Main UI window
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Open devtools automatically in development for easier debugging
  if (isDev) {
    console.log('Development mode: opening devtools')
    win.webContents.openDevTools()
  }

  const url = isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../renderer/index.html')}`
  
  // Try to load the dev server (Next.js) with a short retry window when running in development.
  // If it cannot be reached, fall back to the local renderer stub so the app still shows a helpful placeholder.
  async function waitAndLoad() {
    if (!isDev) {
      return win.loadURL(url)
    }

    const fetch = require('node-fetch')
    const maxWaitMs = 15000
    const start = Date.now()
    const tryInterval = 500

    async function tryFetch() {
      try {
        const res = await fetch(url, { method: 'GET', timeout: 2000 })
        if (res.ok) {
          console.log('Renderer dev server available, loading', url)
          return win.loadURL(url)
        }
      } catch (e) {
        // ignore and retry until timeout
      }
      if (Date.now() - start < maxWaitMs) {
        console.log('Renderer not available yet, retrying...')
        setTimeout(tryFetch, tryInterval)
      } else {
        const fallback = `file://${path.join(__dirname, 'renderer_stub.html')}`
        console.warn('Renderer dev server unreachable, loading fallback:', fallback)
        return win.loadURL(fallback)
      }
    }

    await tryFetch()
  }

  waitAndLoad().catch(err => {
    console.error('Failed to load renderer', err)
    const fallback = `file://${path.join(__dirname, 'renderer_stub.html')}`
    win.loadURL(fallback)
  })
}

app.whenReady().then(() => {
  createWindow()
  createRadioWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Close hidden windows on exit
  if (radioWin) radioWin.close()
  if (spotifyAuthWin) spotifyAuthWin.close()
  if (process.platform !== 'darwin') app.quit()
})

// Example IPC handler bridging renderer -> toolbelt server
ipcMain.handle('toolbelt:call', async (event, method, payload) => {
  if (method === '/_consent/save') {
    try {
      const ok = write(payload)
      return { ok: !!ok }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  }

  if (method === '/_config') {
    try {
      const cfg = load_env()
      const consent = read_consent()
      return { ok: true, config: cfg, consent }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  }

  const fetch = require('node-fetch')
  try {
    const res = await fetch(`http://localhost:8001${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const json = await res.json()
    // emit presence events to renderer
    try { event.sender.send('lucy:presence', { action: method }) } catch (e) {}
    return json
  } catch (err) {
    console.error('toolbelt call failed', err)
    return { ok: false, error: String(err) }
  }
})

// Handle dropped files from renderer
const os = require('os')
const fs = require('fs')
const tmpdir = os.tmpdir()
ipcMain.handle('dropped-file', async (event, name, data) => {
  try {
    const buf = Buffer.from(data, 'base64');
    const out = path.join(tmpdir, `${Date.now()}-${name}`)
    fs.writeFileSync(out, buf)
    // notify toolbelt of dropped file
    const fetch = require('node-fetch')
    await fetch('http://localhost:8001/file/dropped', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path: out, name }) })
    return { ok: true, path: out }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})

ipcMain.on('notify-toast', (event, msg) => {
  console.log('TOAST:', msg)
})

// Audio & Spotify handlers
const keytar = require('keytar');
const SpotifyWebApi = require('spotify-web-api-node');

const SPOTIFY_CLIENT_ID = 'your-real-client-id';
const SPOTIFY_CLIENT_SECRET = 'your-real-client-secret';
const SPOTIFY_REDIRECT_URI = 'lucy-os://callback';
const KEYTAR_SERVICE = 'LucyOS-Spotify';
const KEYTAR_ACCOUNT = 'Tokens';

const spotifyApi = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET,
  redirectUri: SPOTIFY_REDIRECT_URI
});

ipcMain.handle('spotify:oauth', async () => {
  const scopes = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing'];
  const state = 'lucy-os-auth';
  const authUrl = spotifyApi.createAuthorizeURL(scopes, state);
  shell.openExternal(authUrl);
  return { ok: true, url: authUrl };
});

ipcMain.handle('spotify:setToken', async (event, tokens) => {
  try {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, JSON.stringify(tokens));
    spotifyApi.setAccessToken(tokens.access_token);
    if (tokens.refresh_token) {
      spotifyApi.setRefreshToken(tokens.refresh_token);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('spotify:getToken', async () => {
  try {
    const tokensStr = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (tokensStr) {
      const tokens = JSON.parse(tokensStr);
      spotifyApi.setAccessToken(tokens.access_token);
      if (tokens.refresh_token) {
        spotifyApi.setRefreshToken(tokens.refresh_token);
      }
      return { ok: true, tokens };
    }
    return { ok: false, error: 'No tokens found' };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.on('radio:play', () => {
  if (radioWin) { radioWin.webContents.send('radio:play'); }
});

ipcMain.on('radio:stop', () => {
  if (radioWin) { radioWin.webContents.send('radio:stop'); }
});

ipcMain.on('radio:setVolume', (event, vol) => {
  if (radioWin) { radioWin.webContents.send('radio:setVolume', vol); }
});

ipcMain.on('spotify:play', async () => {
  try { await spotifyApi.play(); } catch(e){}
});

ipcMain.on('spotify:pause', async () => {
  try { await spotifyApi.pause(); } catch(e){}
});

ipcMain.on('spotify:next', async () => {
  try { await spotifyApi.skipToNext(); } catch(e){}
});

ipcMain.on('spotify:prev', async () => {
  try { await spotifyApi.skipToPrevious(); } catch(e){}
});

ipcMain.on('spotify:auth', async () => {
  const scopes = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing'];
  const state = 'lucy-os-auth';
  const authUrl = spotifyApi.createAuthorizeURL(scopes, state);
  shell.openExternal(authUrl);
});

ipcMain.on('audio:capture:start', () => {
  console.log('WASAPI capture started (stub)');
});

ipcMain.on('audio:capture:stop', () => {
  console.log('WASAPI capture stopped (stub)');
});

ipcMain.handle('library:addSong', async (event, filePath) => {
  const destDir = path.join(app.getPath("music"), "LucyLibrary");
  await fs.promises.mkdir(destDir, { recursive: true });

  const fileName = path.basename(filePath);
  const destPath = path.join(destDir, fileName);

  await fs.promises.copyFile(filePath, destPath);

  return { success: true, path: destPath };
});

ipcMain.handle('library:queueSong', async (event, filePath) => {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.connect(1234, 'localhost', () => {
      client.write(`queue.push ${filePath}\r\n`);
      setTimeout(() => {
        client.destroy();
        resolve({ success: true });
      }, 100);
    });
    client.on('error', (err) => {
      console.error('Liquidsoap telnet error:', err);
      resolve({ success: false, error: err.message });
    });
  });
});

ipcMain.handle("os:openPath", async (event, targetPath) => {
  await shell.openPath(targetPath);
});

ipcMain.handle("os:listDir", async (event, dirPath) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name,
      isDir: e.isDirectory(),
    }));
  } catch (err) {
    return [];
  }
});

ipcMain.handle("os:runCommand", async (event, { cwd, cmd, args }) => {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", d => (stdout += d.toString()));
    child.stderr.on("data", d => (stderr += d.toString()));
    child.on("close", code => resolve({ code, stdout, stderr }));
    child.on("error", err => resolve({ code: -1, stdout, stderr: err.message }));
  });
});
