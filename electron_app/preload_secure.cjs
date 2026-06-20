const { contextBridge, ipcRenderer } = require('electron');

const lucySecureApi = {
  requestCapability: (capabilityId, args) => ipcRenderer.invoke('os:requestCapability', { capabilityId, args }),
  onEngineMessage: (callback) => ipcRenderer.on('engine:message', callback),
  openPath: (targetPath) => ipcRenderer.invoke('os:openPath', targetPath),
  listDir: (dirPath) => ipcRenderer.invoke('os:listDir', dirPath),
  addToast: (msg) => ipcRenderer.send('notify-toast', msg)
};

// Deep Freeze the API to prevent prototype pollution
Object.freeze(lucySecureApi);

contextBridge.exposeInMainWorld('lucyOS', lucySecureApi);
