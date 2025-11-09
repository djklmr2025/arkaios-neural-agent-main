const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  setToken: (token) => ipcRenderer.send("set-token", token),
  getToken: () => ipcRenderer.invoke("get-token"),
  setDarkMode: (isDarkMode) => ipcRenderer.send("set-dark-mode", isDarkMode),
  isDarkMode: () => ipcRenderer.invoke("is-dark-mode"),
  deleteToken: () => ipcRenderer.send("delete-token"),
  setRefreshToken: (refreshToken) =>
    ipcRenderer.send("set-refresh-token", refreshToken),
  getRefreshToken: () => ipcRenderer.invoke("get-refresh-token"),
  deleteRefreshToken: () => ipcRenderer.send("delete-refresh-token"),
  launchAIAgent: (baseURL, threadId, backgroundMode, aiResponse) =>
    ipcRenderer.send(
      "launch-ai-agent",
      baseURL,
      threadId,
      backgroundMode,
      aiResponse
    ),
  stopAIAgent: () => ipcRenderer.send("stop-ai-agent"),
  onLogout: (callback) => ipcRenderer.on("trigger-logout", callback),
  onAIAgentExit: (callback) => ipcRenderer.on("ai-agent-exit", callback),
  onAIAgentLaunch: (callback) =>
    ipcRenderer.on(
      "ai-agent-launch",
      (_, threadId, backgroundMode, aiResponse) =>
        callback(threadId, backgroundMode, aiResponse)
    ),
  loginWithGoogle: () => ipcRenderer.invoke("login-with-google"),
  expandOverlay: (hasSuggestions) =>
    ipcRenderer.send("expand-overlay", hasSuggestions),
  minimizeOverlay: () => ipcRenderer.send("minimize-overlay"),
  onCancelAllTasksTrigger: (callback) =>
    ipcRenderer.on("trigger-cancel-all-tasks", callback),
  cancelAllTasksDone: () => ipcRenderer.send("cancel-all-tasks-done"),
  getSuggestions: (baseURL) => ipcRenderer.invoke("get-suggestions", baseURL),
  getLastBackgroundModeValue: () =>
    ipcRenderer.invoke("get-last-background-mode-value"),
  startBackgroundSetup: () => ipcRenderer.invoke("start-background-setup"),
  isBackgroundModeReady: () => ipcRenderer.invoke("check-background-ready"),
  onSetupStatus: (cb) => ipcRenderer.on("setup-status", (_, msg) => cb(msg)),
  onSetupProgress: (cb) =>
    ipcRenderer.on("setup-progress", (_, pct) => cb(pct)),
  onSetupComplete: (cb) =>
    ipcRenderer.on("setup-complete", (_, result) => cb(result)),
  testMacOSPermissions: () => ipcRenderer.invoke("test-macos-permissions"),
  hideOverlayTemporarily: (duration) =>
    ipcRenderer.send("hide-overlay-temporarily", duration),
  showOverlay: () => ipcRenderer.send("show-overlay"),
  hideOverlay: () => ipcRenderer.send("hide-overlay"),
  setOverlayClickThrough: (clickThrough) =>
    ipcRenderer.send("set-overlay-click-through", clickThrough),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  checkPermissions: () => ipcRenderer.invoke("check-permissions"),
  requestAccessibility: () => ipcRenderer.invoke("request-accessibility"),
  requestScreenRecording: () => ipcRenderer.invoke("request-screen-recording"),
  openSystemPreferences: (permission) =>
    ipcRenderer.invoke("open-system-preferences", permission),
  getAppManagementShown: () => ipcRenderer.invoke("get-app-management-shown"),
  setAppManagementShown: () => ipcRenderer.send("set-app-management-shown"),
  isMacOS: () => process.platform === "darwin",
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on("update-available", (event, info) => callback(info));
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on("update-not-available", () => callback());
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on("download-progress", (event, progress) =>
      callback(progress)
    );
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on("update-downloaded", (event, info) => callback(info));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on("update-error", (event, error) => callback(error));
  },
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners("update-available");
    ipcRenderer.removeAllListeners("update-not-available");
    ipcRenderer.removeAllListeners("download-progress");
    ipcRenderer.removeAllListeners("update-downloaded");
    ipcRenderer.removeAllListeners("update-error");
  },
});

// ---- Arkaios: asegurar token en el renderer antes de que la app React decida la ruta ----
(() => {
  try {
    const ACCESS_KEY = "_NA_ACCESS_TOK";
    const REFRESH_KEY = "_NA_REFRESH_TOK";
    ipcRenderer.invoke("get-token").then((tok) => {
      if (tok) {
        try {
          window.localStorage.setItem(ACCESS_KEY, tok);
          window.dispatchEvent(
            new CustomEvent("arkaios-token-ready", { detail: { token: tok } })
          );
        } catch {}
      }
    });
    ipcRenderer.invoke("get-refresh-token").then((rt) => {
      if (rt) {
        try {
          window.localStorage.setItem(REFRESH_KEY, rt);
        } catch {}
      }
    });
  } catch (e) {}
})();

// ---- Arkaios Monitor: eventos mínimos desde preload para asegurar señalización ----
(() => {
  // Intentar múltiples puertos para evitar desajustes cuando el servidor cambia de 3456 a otro
  const guessPorts = () => {
    // Estándar: forzar uso exclusivo del puerto 3456 para el monitor
    return [3456];
  };
  const send = (type, data = {}) => {
    try {
      const payload = JSON.stringify({ type, ts: Date.now(), ...data });
      const ports = guessPorts();
      for (const p of ports) {
        const url = `http://localhost:${p}/ingest`;
        if (navigator && navigator.sendBeacon) {
          try {
            navigator.sendBeacon(url, payload);
          } catch {}
        } else {
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
          }).catch(() => {});
        }
      }
    } catch {}
  };

  try {
    send("preload_loaded");
  } catch {}

  try {
    window.addEventListener("DOMContentLoaded", () => {
      send("dom_ready", { title: document.title || "" });
    // ARKAIOS UI hotfix: rename labels and user mention (with MutationObserver)
  (function arkaiosRenameUI(){
    function apply(){
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes){
        if (!node || !node.nodeValue) continue;
        let t = node.nodeValue;
        t = t.replace(/\bInquiry\b/g, 'ARKAIOS');
        t = t.replace(/\bUsuario\b/gi, 'Guardian');
        t = t.replace(/\bUser\b/gi, 'Guardian');
        t = t.replace(/\bSaul Gonzalez\b/gi, 'Guardian');
        node.nodeValue = t;
      }
    }
    try { apply(); } catch(e) {}
    try { new MutationObserver(() => { try { apply(); } catch(e) {} }).observe(document.body, { childList:true, subtree:true, characterData:true }); } catch(e) {}
    console.log('ARKAIOS UI hotfix applied');
  })();

    });
  } catch {}

  try {
    document.addEventListener("paste", (e) => {
      let count = 0;
      try {
        count = e.clipboardData?.items?.length ?? 0;
      } catch {}
      send("paste", { count });
    });
  } catch {}

  try {
    setInterval(() => {
      send("heartbeat", { title: document.title || "" });
    }, 5000);
  } catch {}
})();

