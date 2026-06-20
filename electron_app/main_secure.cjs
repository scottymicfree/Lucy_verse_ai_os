const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { validateCapability } = require('../core/security/CapabilitiesManifest.cjs');

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1400, 
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload_secure.cjs'),
      contextIsolation: true, // STRICT ISOLATION
      nodeIntegration: false, // NO NODE ACCESS IN RENDERER
      sandbox: true           // ENFORCE OS SANDBOX
    }
  });
  
  // Load LucyVerseDesktop
  mainWindow.loadURL('http://localhost:3000');
});

// Basic Utility IPCs
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

const { taskManager } = require('../core/execution/TaskManager.js'); // Assuming we compile TS or use tsx, but since it's electron we should probably compile TaskManager or use dynamic import. Wait, actually we can just keep the logic in main_secure.cjs for now or properly import it if it's compiled.

// Secure Capability Handler
ipcMain.handle("os:requestCapability", async (event, { capabilityId, args }) => {
  // 1. Validate against manifest
  if (!validateCapability(capabilityId, args.cmd)) {
    console.error(`[SECURITY FATAL] Capability Denied: ${capabilityId} / ${args.cmd}`);
    return { code: -1, stdout: "", stderr: "Capability Denied by PolicyGravityLayer" };
  }
  
  console.log(`[CAPABILITY GRANTED] Executing ${capabilityId}: ${args.cmd}`);

  // 2. Log to DataVault WAL (Stubbed here, to be replaced by WalManager in Phase 2)
  // await WalManager.append({ capabilityId, args, timestamp: Date.now() });

  // 3. Temporary Safe Spawn (to be replaced by WASM Executor in Phase 2)
  if (capabilityId === "engine:launch") {
    // Engine runs indefinitely in background
    const child = spawn(args.cmd, args.flags || [], { cwd: args.cwd, shell: true });
    return { code: 0, stdout: "Engine Launch Background Process Started", stderr: "" };
  }

  if (capabilityId === "wasm:execute") {
    // Route to Python trusted executor via HTTP
    try {
      const fetch = (await import('node-fetch')).default;
      const res = await fetch('http://127.0.0.1:8000/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: 'wasm', code: args.code }) // args.code contains base64 wasm
      });
      const data = await res.json();
      return { code: data.ok ? 0 : 1, stdout: JSON.stringify(data.result), stderr: "" };
    } catch (e) {
      return { code: -1, stdout: "", stderr: "WASM execution failed: " + e.message };
    }
  }

  // legacy:process:execute and others: Use TaskManager
  // To avoid compiling TS TaskManager inside CJS, we'll implement a robust promise wrap with timeouts inline,
  // matching the TaskManager logic since we are in the main process
  return new Promise((resolve) => {
    const child = spawn(args.cmd, args.flags || [], { cwd: args.cwd, shell: true });
    let stdout = "";
    let stderr = "";
    
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ code: -1, stdout, stderr: stderr + '\n[Security] Process execution timed out (30s limit).' });
    }, 30000);

    child.stdout.on("data", d => stdout += d.toString());
    child.stderr.on("data", d => stderr += d.toString());
    
    child.on("close", code => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
    
    child.on("error", err => {
      clearTimeout(timeout);
      resolve({ code: -1, stdout, stderr: err.message });
    });
  });
});
