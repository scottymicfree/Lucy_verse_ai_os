import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { validateCapability } from '../core/security/CapabilitiesManifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  return new Promise((resolve) => {
    // If it's a dev server launch, don't wait for close
    if (capabilityId === "engine:launch") {
      const child = spawn(args.cmd, args.flags || [], { cwd: args.cwd, shell: true });
      resolve({ code: 0, stdout: "Engine Launch Background Process Started", stderr: "" });
      return;
    }

    // Otherwise, wait for execution
    const child = spawn(args.cmd, args.flags || [], { cwd: args.cwd, shell: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", d => stdout += d.toString());
    child.stderr.on("data", d => stderr += d.toString());
    child.on("close", code => resolve({ code, stdout, stderr }));
    child.on("error", err => resolve({ code: -1, stdout, stderr: err.message }));
  });
});
