// Immutable manifest of allowed capabilities
export const CAPABILITIES = {
  "fs:read": {
    id: "fs:read",
    allowedCommands: ["Get-ChildItem", "cat", "ls", "Get-Content"],
    requiresWasm: false,
    description: "Read-only access to the host file system."
  },
  "fs:write": {
    id: "fs:write",
    allowedCommands: ["New-Item", "Move-Item", "Rename-Item", "Remove-Item"],
    requiresWasm: false,
    description: "Write access to the host file system."
  },
  "process:execute": {
    id: "process:execute",
    allowedCommands: ["npm", "pip", "powershell"],
    requiresWasm: false,
    description: "Allows execution of whitelisted background processes."
  },
  "engine:launch": {
    id: "engine:launch",
    allowedCommands: ["npm run dev"],
    requiresWasm: false,
    description: "Spawns the Alpha Matrix Engine on port 3005."
  }
};

export function validateCapability(requestedId, cmd) {
  const cap = CAPABILITIES[requestedId];
  if (!cap) return false;
  
  // Basic validation that the command is in the allowed list
  // In a robust implementation, this would involve AST parsing of the command line
  return cap.allowedCommands.some(allowed => cmd.startsWith(allowed));
}
