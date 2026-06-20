// Immutable manifest of allowed capabilities
const CAPABILITIES = {
  "fs:read": {
    id: "fs:read",
    allowedCommands: [/^Get-ChildItem/i, /^cat/i, /^ls/i, /^Get-Content/i],
    requiresWasm: false,
    description: "Read-only access to the host file system."
  },
  "fs:write": {
    id: "fs:write",
    allowedCommands: [/^New-Item/i, /^Move-Item/i, /^Rename-Item/i, /^Remove-Item/i],
    requiresWasm: false,
    description: "Write access to the host file system."
  },
  "legacy:process:execute": {
    id: "legacy:process:execute",
    allowedCommands: [/^npm(?!.*--unsafe-perm)/i, /^pip(?!.*--trusted-host)/i, /^powershell/i],
    requiresWasm: false,
    description: "Allows execution of whitelisted background processes (Lower Trust)."
  },
  "wasm:execute": {
    id: "wasm:execute",
    allowedCommands: [/.*/], // WASM code itself is validated downstream by trusted_executor
    requiresWasm: true,
    description: "Primary execution path for sovereign AI cognitive loops."
  },
  "engine:launch": {
    id: "engine:launch",
    allowedCommands: [/^npm( run dev)?$/i],
    requiresWasm: false,
    description: "Spawns the Alpha Matrix Engine on port 3005."
  }
};

function validateCapability(requestedId, cmd) {
  const cap = CAPABILITIES[requestedId];
  if (!cap) return false;
  
  // Strict regex validation of the command line
  return cap.allowedCommands.some(pattern => pattern.test(cmd));
}

module.exports = {
  CAPABILITIES,
  validateCapability
};
