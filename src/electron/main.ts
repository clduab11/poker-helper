// Electron main process for CoinPoker Analysis Tool
// Responsible for secure window creation, process isolation, and event-driven startup

import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';

// Prevent multiple instances for security
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

/**
 * Create the main overlay window.
 * Uses security best practices: disables Node integration, enables context isolation.
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // For secure IPC
      nodeIntegration: false, // Disable Node.js integration in renderer
      contextIsolation: true, // Enable context isolation
      sandbox: true, // Enforce sandboxing
    },
  });

  // Add security headers and CSP before loading content
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';"
        ],
        'X-Frame-Options': ['DENY'],
        'X-Content-Type-Options': ['nosniff'],
        'Referrer-Policy': ['no-referrer'],
        'Permissions-Policy': ['camera=(), microphone=(), geolocation=()'],
        'Cross-Origin-Embedder-Policy': ['require-corp'],
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Resource-Policy': ['same-origin'],
      }
    });
  });

  // Load the React overlay UI
  mainWindow.loadURL(
    process.env['ELECTRON_START_URL'] ||
      `file://${path.join(__dirname, '../frontend/index.html')}`
  );

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}


// App lifecycle
app.on('ready', () => {
  createMainWindow();
  // Grant screen capture permissions for overlay window
  if (mainWindow) {
    mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
      // Allow screen and window capture for the overlay UI
      if (permission === 'media' || permission === 'display-capture') {
        callback(true);
      } else {
        callback(false);
      }
    });
  }
});

app.on('window-all-closed', () => {
  // On macOS, apps stay active until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

// Example: Secure IPC channel for overlay UI to backend
ipcMain.handle('secure-message', async (_event, data) => {
  // TODO: Route to backend service, validate/sanitize input
  return { status: 'ok', echo: data };
});