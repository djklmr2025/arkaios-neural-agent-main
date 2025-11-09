import { exec, execSync, spawn } from 'child_process';
import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, shell } from 'electron';
import isDev from 'electron-is-dev';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import kill from 'tree-kill';
import url, { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { cleanupExtractedBinary, getOptimalAgentBinary } from './electron/utils/agentPath.js';
import constants from './electron/utils/constants.js';
import MacOSPermissions from './electron/utils/macos-permissions.js';
import { generatePKCE } from './electron/utils/oauth.js';
import { isBackgroundModeReady, setupBackgroundMode } from './electron/utils/wslSetup.js';

// Guardar contra corrupción del archivo de configuración de electron-store.
// Si JSON.parse falla dentro de Conf/electron-store, interceptamos, respaldamos y regeneramos un config.json mínimo.
// Monkeypatch defensivo para fs.readFileSync: si electron-store intenta leer un JSON inválido (por ejemplo HTML), devolvemos '{}' y reparamos el archivo.
const originalReadFileSync = fs.readFileSync;
fs.readFileSync = function patchedReadFileSync(filePath, options) {
  // Loguear lecturas sospechosas para diagnósticos
  try {
    if (typeof filePath === 'string' && /config\.json|neuralagent/i.test(filePath)) {
      console.log('[fs.readFileSync]', filePath);
      const logFile = path.join(app.getPath('userData'), 'arkaios.log');
      try { fs.appendFileSync(logFile, `[readFileSync] ${filePath}\n`); } catch {}
    }
  } catch {}
  const data = originalReadFileSync.apply(fs, arguments);
  try {
    const isCfg = typeof filePath === 'string' && /config\.json$/i.test(filePath) && /neuralagent/i.test(filePath);
    if (isCfg) {
      const txt = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
      const first = (txt || '').trim().slice(0, 1);
      const looksInvalid = first === '<' || first === ':' || first === '"' || first === 't' || !/^[\[{]/.test(first);
      if (looksInvalid) {
        try {
          const backup = filePath + '.invalid.' + Date.now();
          fs.copyFileSync(filePath, backup);
          fs.writeFileSync(filePath, '{}', 'utf8');
          console.error('[Store] Patched invalid config.json, backup at', backup);
          try { fs.appendFileSync(path.join(app.getPath('userData'), 'arkaios.log'), `[patched] ${filePath} -> ${backup}\n`); } catch {}
        } catch {}
        return Buffer.from('{}');
      }
    }
  } catch {}
  return data;
};

let store;
try {
  store = new Store();
} catch (e) {
  try {
    const userData = app.getPath('userData');
    const cfg = path.join(userData, 'config.json');
    const backup = cfg + '.corrupt.' + Date.now();
    if (fs.existsSync(cfg)) {
      try { fs.copyFileSync(cfg, backup); } catch {}
    }
    try { fs.writeFileSync(cfg, '{}', 'utf8'); } catch {}
    store = new Store();
    console.error('[Store] Recovered from invalid JSON at', cfg, 'backup:', backup);
  } catch (err2) {
    console.error('[Store] Failed to recover store:', err2?.message || err2);
    // Último recurso: usar un nombre alternativo para evitar el archivo corrupto
    store = new Store({ name: 'config_safe_fallback' });
  }
}
const permissions = new MacOSPermissions();

let mainWindow;
let overlayWindow;
let aiagentProcess;
let backgroundAuthWindow;
let bgAuthProcess;
let bgAgentWindow;
let bgSetupWindow;
let readyToClose = false;
let overlayHideTimeout = null;

function ensureDeviceId() {
  let deviceId = store.get(constants.DEVICE_ID_STORE_KEY);
  if (!deviceId) {
    deviceId = uuidv4();
    store.set(constants.DEVICE_ID_STORE_KEY, deviceId);
    console.log(`[Device ID created]: ${deviceId}`);
  } else {
    console.log(`[Device ID exists]: ${deviceId}`);
  }
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Arkaios: rely on electron-builder publish config (GitHub provider); do not override feed URL.
// When building with publish.provider='github', electron-updater will auto-detect releases.

function setupAutoUpdater(window) {
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info);
    window.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available');
    window.webContents.send('update-not-available');
  });

  autoUpdater.on('error', (error) => {
    console.error('AutoUpdater error:', error);
    window.webContents.send('update-error', error.message);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    window.webContents.send('download-progress', {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded');
    window.webContents.send('update-downloaded', info);
  });
}

ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (error) {
    console.error('Check for updates error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    console.error('Download update error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('open-external', async (_, url) => {
  shell.openExternal(url);
});

ipcMain.on('set-token', (_, token) => {
  store.set(constants.ACCESS_TOKEN_STORE_KEY, token);
  if (!overlayWindow) {
    createOverlayWindow();
  }
});

ipcMain.handle('get-token', () => store.get(constants.ACCESS_TOKEN_STORE_KEY));
ipcMain.on('delete-token', () => {
  store.delete(constants.ACCESS_TOKEN_STORE_KEY);
  if (overlayWindow) {
    overlayWindow.close();
  }
});
ipcMain.on('set-refresh-token', (_, token) => store.set(constants.REFRESH_TOKEN_STORE_KEY, token));
ipcMain.handle('get-refresh-token', () => store.get(constants.REFRESH_TOKEN_STORE_KEY));
ipcMain.on('delete-refresh-token', () => store.delete(constants.REFRESH_TOKEN_STORE_KEY));
ipcMain.handle('check-permissions', async () => {
  return await permissions.checkAllPermissions();
});

ipcMain.handle('request-accessibility', async () => {
  return await permissions.requestAccessibility();
});

ipcMain.handle('request-screen-recording', async () => {
  return await permissions.requestScreenRecording();
});

ipcMain.handle('open-system-preferences', async (event, permission) => {
  return await permissions.openSystemPreferences(permission);
});

ipcMain.handle('get-app-management-shown', () => {
  return store.get(constants.APP_MANAGEMENT_SHOWN_KEY, 'false');
});

ipcMain.on('set-app-management-shown', () => {
  store.set(constants.APP_MANAGEMENT_SHOWN_KEY, 'true');
});


ipcMain.on('expand-overlay', (_, hasSuggestions) => {
  console.log("[Main Process] Received 'expand-overlay' IPC message.");
  expandMinimizeOverlay(true, hasSuggestions);
});

ipcMain.on('set-dark-mode', (_, isDarkMode) => {
  store.set(constants.DARK_MODE_STORE_KEY, isDarkMode.toString());
  if (overlayWindow) {
    overlayWindow.reload();
  }
});
ipcMain.handle('is-dark-mode', () => store.get(constants.DARK_MODE_STORE_KEY));

ipcMain.handle('get-last-background-mode-value', () => store.get(constants.LAST_BACKGROUND_MODE_VALUE));

// Handle MINIMIZE request
ipcMain.on('minimize-overlay', () => {
  console.log("[Main Process] Received 'minimize-overlay' IPC message.");
  expandMinimizeOverlay(false);
});

ipcMain.handle('check-background-ready', () => {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  if (isWindows) {
    return isBackgroundModeReady(); 
  }
  return true;
});

ipcMain.handle('start-background-setup', async () => {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  if (isWindows) {
    if (bgSetupWindow && !bgSetupWindow.isDestroyed()) {
      bgSetupWindow.focus();
      return;
    }

    bgSetupWindow = new BrowserWindow({
      width: 600,
      height: 300,
      title: 'Setting up Background Mode',
      resizable: false,
      modal: true,
      icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, 'electron', 'preload.js'),
        contextIsolation: true,
      },
    });

    const bgSetupUrl = isDev
      ? 'http://localhost:6763/#/background-setup'
      : `file://${path.join(__dirname, 'neuralagent-app', 'build', 'index.html')}#/background-setup`;

    bgSetupWindow.loadURL(bgSetupUrl);

    bgSetupWindow.on('closed', () => {
      bgSetupWindow = null;
    });

    const defaultErr = 'Setup Failed: Please ensure you have Windows 10 or higher and that virtualization is enabled in BIOS.';

    let result = { success: false, error: defaultErr };

    try {
      result = await setupBackgroundMode({
        onStatus: (msg) => {
          if (!bgSetupWindow?.isDestroyed()) {
            bgSetupWindow.webContents.send('setup-status', msg);
          }
        },
        onProgress: (pct) => {
          if (!bgSetupWindow?.isDestroyed()) {
            bgSetupWindow.webContents.send('setup-progress', pct);
          }
        },
      });
    } catch (err) {
      console.error('❌ Setup failed:', err);
      result = {
        success: false,
        error: err?.message || defaultErr,
      };
    }

    if (bgSetupWindow && !bgSetupWindow.isDestroyed()) {
      bgSetupWindow.webContents.send('setup-complete', result);
    }

    if (result.success) {
      launchBackgroundAuthWindow();
    }

    return result;
  }
});

// Hide overlay temporarily during agent mouse actions
ipcMain.on('hide-overlay-temporarily', (_, duration = 3000) => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  
  console.log(`[Overlay] Hiding temporarily for ${duration}ms`);
  
  // Clear any existing timeout
  if (overlayHideTimeout) {
    clearTimeout(overlayHideTimeout);
  }
  
  // Hide the overlay
  overlayWindow.hide();
  
  // Set timeout to show it again WITHOUT taking focus
  overlayHideTimeout = setTimeout(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      // Show overlay without stealing focus
      overlayWindow.showInactive();
      console.log('[Overlay] Restored after temporary hide (no focus)');
    }
    overlayHideTimeout = null;
  }, duration);
});

// Manual overlay show/hide controls
ipcMain.on('show-overlay', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.showInactive(); // Don't steal focus
  }
});

ipcMain.on('hide-overlay', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }
});

// Make overlay click-through during agent operations
ipcMain.on('set-overlay-click-through', (_, clickThrough = true) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    try {
      overlayWindow.setIgnoreMouseEvents(clickThrough);
      console.log(`[Overlay] Click-through mode: ${clickThrough}`);
    } catch (error) {
      console.warn('[Overlay] setIgnoreMouseEvents not supported:', error);
    }
  }
});


ipcMain.handle('get-suggestions', async (_, baseURL) => {
  return new Promise((resolve, reject) => {

    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    // const suggestor = spawn(isWindows ? './aiagent/venv/Scripts/python' : './aiagent/venv/bin/python', ['./aiagent/main.py'], {
    //   env: {
    //     ...process.env,
    //     NEURALAGENT_API_URL: baseURL,
    //     NEURALAGENT_USER_ACCESS_TOKEN: store.get(constants.ACCESS_TOKEN_STORE_KEY),
    //     NEURALAGENT_AGENT_MODE: 'suggestor',
    //   },
    // });

    const suggestorPath = getOptimalAgentBinary();

    const suggestor = spawn(suggestorPath, [], {
      env: {
        ...process.env,
        NEURALAGENT_API_URL: baseURL,
        NEURALAGENT_USER_ACCESS_TOKEN: store.get(constants.ACCESS_TOKEN_STORE_KEY),
        NEURALAGENT_AGENT_MODE: 'suggestor',
      },
    });

    let output = '';
    let errorOutput = '';

    suggestor.stdout.on('data', (data) => {
      output += data.toString();
    });

    suggestor.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    suggestor.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (err) {
          console.error('❌ Failed to parse suggestor output:', output);
          reject(err);
        }
      } else {
        console.error('❌ Suggestor exited with error:', errorOutput);
        reject(new Error('Suggestor failed'));
      }
    });
  });
});

ipcMain.on('launch-ai-agent', async (_, baseURL, threadId, backgroundMode, aiResponse) => {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  store.set(constants.LAST_BACKGROUND_MODE_VALUE, backgroundMode.toString());

  if (!backgroundMode || isMac) {
    // aiagentProcess = spawn(isWindows ? './aiagent/venv/Scripts/python' : './aiagent/venv/bin/python', ['./aiagent/main.py'], {
    //   env: {
    //     ...process.env,
    //     NEURALAGENT_API_URL: baseURL,
    //     NEURALAGENT_THREAD_ID: threadId,
    //     NEURALAGENT_USER_ACCESS_TOKEN: store.get(constants.ACCESS_TOKEN_STORE_KEY),
    //     NEURALAGENT_AGENT_MODE: backgroundMode ? 'background_agent' : 'agent',
    //     PYTHONUTF8: '1',
    //   },
    // });

    mainWindow?.minimize();

    const agentPath = getOptimalAgentBinary();
    
    aiagentProcess = spawn(agentPath, [], {
      env: {
        ...process.env,
        NEURALAGENT_API_URL: baseURL,
        NEURALAGENT_THREAD_ID: threadId,
        NEURALAGENT_USER_ACCESS_TOKEN: store.get(constants.ACCESS_TOKEN_STORE_KEY),
        NEURALAGENT_AGENT_MODE: backgroundMode ? 'background_agent' : 'agent',
      },
    });
  } else {
    if (isWindows) {
      // VERY IMPORTANT
      const envVars = {
        ...process.env,
        NEURALAGENT_API_URL: baseURL, // 'http://192.168.8.101:8000',
        NEURALAGENT_THREAD_ID: threadId,
        NEURALAGENT_USER_ACCESS_TOKEN: store.get(constants.ACCESS_TOKEN_STORE_KEY),
        SKIP_LLM_API_KEY_VERIFICATION: 'true',
        PYTHONUTF8: '1',
      };

      const shellCommand = Object.entries(envVars)
        .map(([k, v]) => `${k}="${v}"`).join(' ') + ' bash /agent/launch_bg_agent.sh';

      aiagentProcess = spawn('wsl', ['-d', 'NeuralOS', '--', 'bash', '-c', shellCommand]);

      launchBackgroundAgentWindow();
    }
  }

  mainWindow?.webContents.send('ai-agent-launch', threadId, backgroundMode, aiResponse);
  overlayWindow?.webContents.send('ai-agent-launch', threadId, backgroundMode, aiResponse);
  expandMinimizeOverlay(true, false);

  aiagentProcess.stdout.on('data', (data) => console.log(`[Agent stdout]: ${data}`));
  aiagentProcess.stderr.on('data', (data) => console.error(`[Agent stderr]: ${data}`));

  aiagentProcess.on('error', err => {
    console.error('❌  Agent process failed to start:', err);
    mainWindow?.webContents.send('trigger-cancel-all-tasks');
  });

  aiagentProcess.on('exit', (code, signal) => {
    console.log(`[Agent exited with code ${code}]`);
    if (bgAgentWindow) {
      bgAgentWindow.close();
    }
    cleanupBGAgent();
    if (mainWindow?.isMinimized()) {
      mainWindow.restore();
    }
    if (mainWindow) {
      mainWindow.focus();
    }
    mainWindow?.webContents.send('ai-agent-exit');
    overlayWindow?.webContents.send('ai-agent-exit');

    if (code !== 0 || signal) {
      mainWindow?.webContents.send('trigger-cancel-all-tasks');
    }
    aiagentProcess = null;
  });
});

ipcMain.on('stop-ai-agent', () => {
  if (aiagentProcess && !aiagentProcess.killed) {
    kill(aiagentProcess.pid, 'SIGKILL', (err) => {
      if (err) console.error('❌ Failed to kill agent:', err);
      else console.log('[✅ Agent forcibly stopped]');
    });
  }
  aiagentProcess = null;
  cleanupBGAgent();
});

const GOOGLE_CLIENT_ID = '296264060339-jamhdgfckblr0qgq360t5ok4e1kede35.apps.googleusercontent.com';
const REDIRECT_URI = 'http://127.0.0.1:36478';

function openUrlInBrowser(targetUrl) {
  const platform = process.platform;
  const command =
    platform === 'win32'
      ? `start "" "${targetUrl}"`
      : platform === 'darwin'
      ? `open "${targetUrl}"`
      : `xdg-open "${targetUrl}"`;
  exec(command);
}

ipcMain.handle('login-with-google', async () => {
  const { codeVerifier, codeChallenge } = generatePKCE();

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=openid%20email%20profile` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256` +
    `&access_type=offline`;

  openUrlInBrowser(authUrl);

  const appExpress = express();

  return new Promise((resolve, reject) => {
    const server = appExpress.listen(36478, () => {
      console.log('Listening for Google OAuth callback...');
    });

    appExpress.get('/', (req, res) => {
      const code = req.query.code;
      if (!code) {
        res.send('Login failed.');
        server.close();
        return reject('No code received');
      }

      res.send('Login successful! You can close this window.');
      server.close();
      resolve({ code, codeVerifier });
    });
  });
});

const createAppMenu = () => {
  let neuralAgentSubmenu = [];
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    neuralAgentSubmenu.push(
      {
        label: 'Background Mode Authentication',
        click: () => {
          if ((aiagentProcess && !aiagentProcess.killed) || (bgAuthProcess && !bgAuthProcess.killed)) {
            return;
          }
          launchBackgroundAuthWindow();
        },
      },
      { type: 'separator' }
    );
  }
  neuralAgentSubmenu.push(
    {
      label: 'Logout',
      click: () => {
        if (overlayWindow) {
          overlayWindow.close();
        }
        mainWindow?.webContents.send('trigger-logout');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      role: 'quit'
    },
  );
  const template = [
    {
      label: 'NeuralAgent',
      submenu: neuralAgentSubmenu,
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        // { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

function startBackgroundAuthServices() {
  bgAuthProcess = spawn('wsl', ['-d', 'NeuralOS', '--', 'bash', '/agent/background_mode_authentication.sh']);

  bgAuthProcess.stdout.on('data', data => {
    console.log(`[BG Auth]: ${data.toString()}`);
  });

  bgAuthProcess.stderr.on('data', data => {
    console.error(`[BG Auth ERROR]: ${data.toString()}`);
  });
}

function cleanupBackgroundAuthServices() {
  try {
    execSync('wsl -d NeuralOS -- bash /agent/background_mode_authentication_cleanup.sh');
    console.log('[BG Auth]: Cleanup script executed.');
  } catch (err) {
    console.error('[BG Auth]: Cleanup failed:', err);
  }

  if (bgAuthProcess) {
    if (!bgAuthProcess.killed) {
      bgAuthProcess.kill('SIGKILL');
    }
  }
  bgAuthProcess = null;
}

function cleanupBGAgent() {
  const isWindows = process.platform === 'win32';
  if (!isWindows) {
    return;
  }
  try {
    execSync('wsl -d NeuralOS -- bash /agent/stop_bg_agent.sh');
    console.log('[BG Agent]: Cleanup script executed.');
  } catch (err) {
    console.error('[BG Agent]: Cleanup failed:', err);
  }

  if (aiagentProcess) {
    if (!aiagentProcess.killed) {
      aiagentProcess.kill('SIGKILL');
    }
  }
}

function waitForNoVNCPortReady(port, timeout = 10000, interval = 300) {
  const deadline = Date.now() + timeout;

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get({ hostname: '127.0.0.1', port, path: '/', timeout: 1000 }, (res) => {
        res.destroy();
        resolve(true); // Port is ready
      });

      req.on('error', (err) => {
        if (Date.now() > deadline) return reject(new Error('Timed out waiting for noVNC'));
        setTimeout(check, interval);
      });

      req.end();
    };

    check();
  });
}

function launchBackgroundAuthWindow() {
  if (backgroundAuthWindow) return;

  startBackgroundAuthServices();

  waitForNoVNCPortReady(39742, 20000)
    .then(() => {
      backgroundAuthWindow = new BrowserWindow({
        width: 1350,
        height: 780,
        title: 'NeuralAgent Background Auth',
        icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          preload: path.join(__dirname, 'electron', 'preload.js'),
        },
      });

      const reactURL = isDev
        ? 'http://localhost:6763/#/background-auth'
        : `file://${path.join(__dirname, 'neuralagent-app', 'build', 'index.html')}#/background-auth`;

      backgroundAuthWindow.loadURL(reactURL);

      backgroundAuthWindow.on('closed', () => {
        cleanupBackgroundAuthServices();
        backgroundAuthWindow = null;
      });
    })
    .catch((err) => {
      console.error('❌ noVNC failed to start:', err);
      cleanupBackgroundAuthServices();
    });
}

function launchBackgroundAgentWindow() {
  if (bgAgentWindow) return;

  waitForNoVNCPortReady(39742, 20000)
    .then(() => {
      bgAgentWindow = new BrowserWindow({
        width: 1350,
        height: 780,
        title: 'NeuralAgent Background Task',
        icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          preload: path.join(__dirname, 'electron', 'preload.js'),
        },
      });

      const reactURL = isDev
        ? 'http://localhost:6763/#/background-task'
        : `file://${path.join(__dirname, 'neuralagent-app', 'build', 'index.html')}#/background-task`;

      bgAgentWindow.loadURL(reactURL);

      bgAgentWindow.on('closed', () => {
        bgAgentWindow = null;
      });
    })
    .catch((err) => {
      console.error('noVNC failed to start:', err);
    });
}

function createWindow() {
  if (mainWindow) return;
  mainWindow = new BrowserWindow({
    width: 1050,
    height: 750,
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startURL = isDev
    ? 'http://localhost:6763'
    : url.format({
        pathname: path.join(__dirname, 'neuralagent-app', 'build', 'index.html'),
        protocol: 'file:',
        slashes: true,
      });

  mainWindow.loadURL(startURL);

  // Inject ARKAIOS monitor script after renderer finishes loading
  const monitorScript = `(() => {
    try {
      const MONITOR_URL = 'http://localhost:3456/ingest';
      const send = (event, payload={}) => {
        const data = JSON.stringify({ t: Date.now(), event, payload });
        try {
          const ok = navigator.sendBeacon(MONITOR_URL, data);
          if (!ok) throw new Error('sendBeacon returned false');
        } catch {
          try {
            fetch(MONITOR_URL, { method:'POST', body:data, mode:'no-cors' }).catch(()=>{});
          } catch {}
        }
      };
      window.__ARKAIOS_LOG__ = send;
      send('app_loaded', { title: document.title, href: location.href });
      const clickableText = ['run','background','new task','submit','start'];
      const trackClicks = () => {
        const candidates = Array.from(document.querySelectorAll('button, [role="button"], a'));
        candidates.forEach(el => {
          if (el.__arkaiosClickTracked__) return;
          const text = (el.textContent || '').trim().toLowerCase();
          if (clickableText.some(k => text.includes(k))) {
            el.__arkaiosClickTracked__ = true;
            el.addEventListener('click', () => send('ui_click', { text }));
          }
        });
      };
      trackClicks();
      const mo = new MutationObserver(() => trackClicks());
      mo.observe(document.documentElement, { subtree: true, childList: true });

      const trackInput = () => {
        const inputs = Array.from(document.querySelectorAll('textarea, input'));
        inputs.forEach(el => {
          if (el.__arkaiosInputTracked__) return;
          el.__arkaiosInputTracked__ = true;
          el.addEventListener('input', () => {
            const val = (el.value || '').slice(0, 120);
            send('ui_input', { len: (el.value || '').length, sample: val });
          });
        });
      };
      trackInput();
      const mo2 = new MutationObserver(() => trackInput());
      mo2.observe(document.documentElement, { subtree: true, childList: true });

      document.addEventListener('paste', (e) => {
        const hasImage = Array.from(e.clipboardData?.items || []).some(i => i.type?.startsWith('image/'));
        send('paste', { hasImage });
      });
    } catch (err) { console.warn('ARKAIOS monitor init failed', err); }
  })();`;

  try {
    mainWindow.webContents.on('did-finish-load', () => {
      try { mainWindow.webContents.executeJavaScript(monitorScript); } catch (e) { console.warn('monitor inject failed', e); }

      // ARKAIOS UI hotfix: force branding and labels
      const arkaiosUiScript = `(() => {
        const replaceAll = (s) => {
          if (!s || typeof s !== 'string') return s;
          // Use broader replacements without word boundaries to catch embedded instances
          return s
            .replace(/Identity\s+Inquiry/gi, 'ARKAIOS')
            .replace(/Inquiri/gi, 'ARKAIOS')
            .replace(/Inquiry/gi, 'ARKAIOS')
            .replace(/Neural\s*Agent/gi, 'Guardian')
            .replace(/NeuralAgent/gi, 'Guardian')
            .replace(/Usuario/gi, 'Guardian')
            .replace(/User/gi, 'Guardian')
            .replace(/Saul\s+Gonzalez/gi, 'Guardian');
        };

        const processTextNode = (node) => {
          try {
            const prev = node.nodeValue;
            const next = replaceAll(prev);
            if (next !== prev) node.nodeValue = next;
          } catch {}
        };

        const processElement = (el) => {
          try {
            ['aria-label','title'].forEach(attr => {
              if (el.hasAttribute && el.hasAttribute(attr)) {
                const v = el.getAttribute(attr);
                const nv = replaceAll(v);
                if (nv !== v) el.setAttribute(attr, nv);
              }
            });
            if (typeof el.innerText === 'string') {
              const v = el.innerText;
              const nv = replaceAll(v);
              if (nv !== v) el.innerText = nv;
            }
          } catch {}
        };

        const processShadowRoot = (root) => {
          try {
            // Walk text nodes inside shadow root
            const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
            let n;
            while ((n = walker.nextNode())) processTextNode(n);
            root.querySelectorAll('[aria-label],[title]').forEach(processElement);
          } catch {}
        };

        const run = () => {
          try {
            // Walk text nodes
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
            let n;
            while ((n = walker.nextNode())) processTextNode(n);

            // Update common UI containers and chips/badges
            const selectors = [
              'header', '.sidebar', '.brand',
              '.chakra-badge', '.mantine-Badge-root', '.mantine-Chip-root', '.mantine-Chip-label',
              '[aria-label]', '[title]'
            ];
            document.querySelectorAll(selectors.join(','))
              .forEach(processElement);

            // Targeted overrides: any element whose visible text equals 'Inquiry'
            const all = Array.from(document.querySelectorAll('*'));
            all.forEach(el => {
              try {
                const txt = (el.innerText || '').trim();
                if (txt && /^Inquiry$/i.test(txt)) {
                  // Force label
                  el.innerText = 'ARKAIOS';
                }
              } catch {}
            });

            // Traverse shadow roots for web components
            document.querySelectorAll('*')
              .forEach(el => { if (el.shadowRoot) processShadowRoot(el.shadowRoot); });
          } catch (err) { console.warn('ARKAIOS UI hotfix cycle error', err); }
        };

        run();
        const mo = new MutationObserver(() => run());
        mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
        console.debug('ARKAIOS UI hotfix active');
      })();`;

      try { mainWindow.webContents.executeJavaScript(arkaiosUiScript); } catch (e) { console.warn('ui hotfix inject failed', e); }
    });
  } catch {}

  mainWindow.on('close', async (e) => {
    if (readyToClose) return;

    e.preventDefault();
    if (mainWindow?.webContents) {
      mainWindow?.webContents.send('trigger-cancel-all-tasks');
    }

    ipcMain.once('cancel-all-tasks-done', () => {
      readyToClose = true;
      mainWindow.close();
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;

    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
    }
    if (bgAgentWindow && !bgAgentWindow.isDestroyed()) {
      bgAgentWindow.close();
    }
    if (bgSetupWindow && !bgSetupWindow.isDestroyed()) {
      bgSetupWindow.close();
    }
    if (backgroundAuthWindow && !backgroundAuthWindow.isDestroyed()) {
      backgroundAuthWindow.close();
    }
  });
}

function createOverlayWindow() {
  if (overlayWindow) return;

  const windowWidth = 60;
  const windowHeight = 60;
  const margin = 25;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;

  const xPos = screenWidth - windowWidth - margin;
  const yPos = screenHeight - windowHeight - margin;

  overlayWindow = new BrowserWindow({
    width: 60,
    height: 60,
    x: xPos,
    y: yPos,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    overlayWindow.setContentProtection(true);
  } catch (e) {
    console.warn('[Overlay] setContentProtection not available:', e);
  }

  const overlayURL = isDev
    ? 'http://localhost:6763/#/overlay'
    : `file://${path.join(__dirname, 'neuralagent-app', 'build', 'index.html')}#/overlay`;

  overlayWindow.loadURL(overlayURL);

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function expandMinimizeOverlay(expanded, hasSuggestions = false) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;

  const W = expanded ? 350 : 60;
  const H = expanded ? (hasSuggestions ? 380 : 500) : 60;
  const M = 25;
  const { width: SW, height: SH } = screen.getPrimaryDisplay().workArea;
  const X = SW - W - M;
  const Y = SH - H - M;

  overlayWindow.setBounds({ x: X, y: Y, width: W, height: H }, true);

  // Ensure overlay is visible if not temporarily hidden, but don't steal focus
  if (!overlayHideTimeout) {
    overlayWindow.showInactive();
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  const devIconPath = path.join(__dirname, 'assets', 'icon.png');
  if (process.platform === 'darwin' && isDev) {
    try {
      const img = nativeImage.createFromPath(devIconPath);
      if (!img.isEmpty()) app.dock.setIcon(img);
    } catch {}
  }
  ensureDeviceId();
  createWindow();
  setupAutoUpdater(mainWindow);
  
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.log('Auto-update check failed:', err);
    });
  }, 5000);
  
  if (store.get(constants.ACCESS_TOKEN_STORE_KEY)) {
    createOverlayWindow();
  }
  createAppMenu();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      createOverlayWindow();
    }
  });
});

app.on('before-quit', () => {
  if (overlayHideTimeout) {
    clearTimeout(overlayHideTimeout);
    overlayHideTimeout = null;
  }
  cleanupExtractedBinary();
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (aiagentProcess && !aiagentProcess.killed) {
    kill(aiagentProcess.pid, 'SIGKILL', (err) => {
      if (err) console.error('❌ Failed to kill agent:', err);
      else console.log('[Agent stopped on app exit]');
    });
  }
  if (process.platform !== 'darwin' || app.isQuitting) app.quit();
});
// Capturar excepciones globales del proceso principal y recuperar si provienen de Conf/electron-store.
process.on('uncaughtException', (err) => {
  try {
    const msg = String(err?.message || err || '');
    const stk = String(err?.stack || '');
    const related = /conf\b|electron-store/i.test(stk) || /config\.json/i.test(stk + msg);
    if (related) {
      const userData = app.getPath('userData');
      const cfg = path.join(userData, 'config.json');
      try {
        const backup = cfg + '.uncaught.' + Date.now();
        if (fs.existsSync(cfg)) fs.copyFileSync(cfg, backup);
        fs.writeFileSync(cfg, '{}', 'utf8');
        console.error('[Store] uncaughtException: repaired', cfg, 'backup:', backup);
      } catch {}
    }
  } catch {}
});
