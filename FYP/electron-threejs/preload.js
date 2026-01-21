const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openJSON: () => ipcRenderer.invoke("open-json")
});
