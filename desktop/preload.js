const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: settings => ipcRenderer.invoke('settings:save', settings),
  testProvider: (provider, values) => ipcRenderer.invoke('provider:test', provider, values),
  connectYouTube: values => ipcRenderer.invoke('youtube:connect', values),
  openExternal: url => ipcRenderer.invoke('external:open', url),
  openDataFolder: () => ipcRenderer.invoke('data:open'),
});
