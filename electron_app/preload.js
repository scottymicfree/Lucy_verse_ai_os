const { contextBridge, ipcRenderer } = require('electron')
const { read } = require('./consent_store')

contextBridge.exposeInMainWorld('electron', {
  toolbeltCall: (method, payload) => ipcRenderer.invoke('toolbelt:call', method, payload),
  consent: read(),
  config: () => ipcRenderer.invoke('toolbelt:call', '/_config', {})
})

contextBridge.exposeInMainWorld('electronAPI', {
  radioPlay: () => ipcRenderer.send('radio:play'),
  radioStop: () => ipcRenderer.send('radio:stop'),
  radioSetVolume: (v) => ipcRenderer.send('radio:setVolume', v),

  spotifyPlay: () => ipcRenderer.send('spotify:play'),
  spotifyPause: () => ipcRenderer.send('spotify:pause'),
  spotifyNext: () => ipcRenderer.send('spotify:next'),
  spotifyPrev: () => ipcRenderer.send('spotify:prev'),
  spotifyAuth: () => ipcRenderer.send('spotify:auth'),

  audioCaptureStart: () => ipcRenderer.send('audio:capture:start'),
  audioCaptureStop: () => ipcRenderer.send('audio:capture:stop')
})

// Drag-and-drop: expose handler to renderer
contextBridge.exposeInMainWorld('electronDrop', {
  handleDroppedFile: (name, data) => ipcRenderer.invoke('dropped-file', name, data)
})

contextBridge.exposeInMainWorld('lucyLibrary', {
  addSong: (filePath) => ipcRenderer.invoke('library:addSong', filePath),
  queueSong: (filePath) => ipcRenderer.invoke('library:queueSong', filePath)
})

contextBridge.exposeInMainWorld("os", {
  openPath: (p) => ipcRenderer.invoke("os:openPath", p),
  listDir: (p) => ipcRenderer.invoke("os:listDir", p),
  runCommand: (opts) => ipcRenderer.invoke("os:runCommand", opts),
})

// Provide a helper to show toasts from main if needed
contextBridge.exposeInMainWorld('electronNotify', {
  toast: (msg) => ipcRenderer.send('notify-toast', msg)
})

ipcRenderer.on('lucy:presence', (evt, data) => {
  // forward to window events
  window.dispatchEvent(new CustomEvent('lucy:actionStart', { detail: { action: data.action } }))
  setTimeout(() => window.dispatchEvent(new CustomEvent('lucy:actionEnd')), 2000)
})
