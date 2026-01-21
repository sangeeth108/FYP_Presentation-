const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // Add preload
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  win.loadFile("index.html");
}

// Listen for file dialog request from renderer
ipcMain.handle("open-json", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }]
  });

  if (result.canceled) return null;

  const data = fs.readFileSync(result.filePaths[0], "utf-8");
  return data;
});

app.whenReady().then(createWindow);
