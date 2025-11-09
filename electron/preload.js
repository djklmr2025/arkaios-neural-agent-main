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
      try {
        if (!tok) {
          // Sembrar token local si falta, para evitar la pantalla de login
          const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "");
          const payload = btoa(
            JSON.stringify({
              sub: "arkaios-local",
              name: "Guardian Local",
              email: "arkaios@local",
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + 315576000,
            })
          )
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "");
          tok = `${header}.${payload}.ARKAIOS`;
          try {
            ipcRenderer.send("set-token", tok);
          } catch {}
          try {
            ipcRenderer.send("set-refresh-token", "ARKAIOS_LOCAL_REFRESH");
          } catch {}
        }
        window.localStorage.setItem(ACCESS_KEY, tok);
        window.dispatchEvent(
          new CustomEvent("arkaios-token-ready", { detail: { token: tok } })
        );
      } catch {}
    });
    ipcRenderer.invoke("get-refresh-token").then((rt) => {
      if (rt) {
        try {
          window.localStorage.setItem(REFRESH_KEY, rt);
        } catch {}
      }
    });

    // Responder a eventos de Logout enviados desde el menú de la app
    try {
      ipcRenderer.on("trigger-logout", () => {
        try {
          window.localStorage.removeItem(ACCESS_KEY);
          window.localStorage.removeItem(REFRESH_KEY);
        } catch {}
        try { ipcRenderer.send("delete-token"); } catch {}
        try { ipcRenderer.send("delete-refresh-token"); } catch {}
        // Forzar recarga limpia del renderer
        try { location.reload(); } catch {}
      });
    } catch {}
  } catch (e) {}
})();

// ---- Arkaios: modo local y kill-switch de paywall/login en el renderer ----
(() => {
  try {
    // 1) Interceptar fetch para endpoints de login/profile y devolver sesión local
    const OG_fetch = window.fetch;
    const isAuth = (u) => /login|\/me|profile|users\/(me|profile)/i.test(u || "");
    const isPricing = (u) =>
      /pricing|plans|plan|billing|stripe|checkout|payment|subscribe|subscription|limits|usage|quota|tier/i.test(
        u || ""
      );
    const isRemoteAPI = (u) =>
      /getneuralagent\.com|neuralagent\.|guardian\.|arkaios\-service|arkaios\-core/i.test(
        u || ""
      );
    const PRO_RESP = {
      plan: "pro",
      tier: "pro",
      usage: { tokens: 0, tasks: 0 },
      limits: {
        daily_tokens: 9007199254740991,
        monthly_tokens: 9007199254740991,
        tasks: 9007199254740991,
      },
      status: "ok",
      source: "arkaios-preload",
    };
    window.fetch = async function (input, init) {
      try {
        const url = typeof input === "string" ? input : input?.url || "";
        const u = url.toString();
        if (isAuth(u)) {
          const body = {
            accessToken: window.localStorage.getItem("_NA_ACCESS_TOK") || "ARKAIOS_LOCAL",
            refreshToken: window.localStorage.getItem("_NA_REFRESH_TOK") || "ARKAIOS_LOCAL_REFRESH",
            user: { id: "arkaios-local", name: "Guardian Local", email: "arkaios@local" },
          };
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (isPricing(u) || isRemoteAPI(u)) {
          return new Response(JSON.stringify(PRO_RESP), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch {}
      return OG_fetch(input, init);
    };

    // 2) Interceptar XMLHttpRequest igualmente
    try {
      const OG_XHR = window.XMLHttpRequest;
      function ArkXHR() {
        const xhr = new OG_XHR();
        const OG_open = xhr.open;
        xhr.open = function (method, url) {
          try {
            if (isAuth(url)) {
              setTimeout(() => {
                try {
                  xhr.readyState = 4;
                  xhr.status = 200;
                  xhr.responseText = JSON.stringify({
                    accessToken:
                      window.localStorage.getItem("_NA_ACCESS_TOK") || "ARKAIOS_LOCAL",
                    refreshToken:
                      window.localStorage.getItem("_NA_REFRESH_TOK") || "ARKAIOS_LOCAL_REFRESH",
                    user: { id: "arkaios-local", name: "Guardian Local" },
                  });
                  xhr.onreadystatechange && xhr.onreadystatechange();
                  xhr.onload && xhr.onload();
                } catch {}
              }, 0);
              return;
            }
            if (isPricing(url) || isRemoteAPI(url)) {
              setTimeout(() => {
                try {
                  xhr.readyState = 4;
                  xhr.status = 200;
                  xhr.responseText = JSON.stringify(PRO_RESP);
                  xhr.onreadystatechange && xhr.onreadystatechange();
                  xhr.onload && xhr.onload();
                } catch {}
              }, 0);
              return;
            }
          } catch {}
          return OG_open.apply(xhr, arguments);
        };
        return xhr;
      }
      window.XMLHttpRequest = ArkXHR;
    } catch {}

    // 3) Remover visualmente pantallas/modales de login y upgrade
    function removeLoginAndUpgrade() {
      try {
        const selectors = [
          'div[role="dialog"]',
          '.mantine-Modal-root',
          '.chakra-modal__content',
          '.modal',
          '.mantine-Modal-content',
          '.mantine-Paper-root',
          '.cl-signIn',
          '.cl-userButton',
        ];
        document.querySelectorAll(selectors.join(',')).forEach((el) => {
          const txt = (el.innerText || '').toLowerCase();
          if (
            txt.includes('upgrade required') ||
            txt.includes('upgrade to pro') ||
            txt.includes('continue to payment') ||
            txt.includes('login')
          ) {
            try { el.style.display = 'none'; } catch {}
            try { el.remove(); } catch {}
          }
        });
        // Ocultar botones de upgrade/pricing/payment
        Array.from(document.querySelectorAll('button,a')).forEach((b) => {
          try {
            const t = (b.innerText || '').toLowerCase();
            if (t.includes('upgrade') || t.includes('pricing') || t.includes('payment')) {
              b.style.display = 'none';
              b.remove();
            }
          } catch {}
        });
      } catch {}
    }
    document.addEventListener('DOMContentLoaded', removeLoginAndUpgrade, true);
    try { new MutationObserver(() => { try { removeLoginAndUpgrade(); } catch {} }).observe(document.documentElement, { childList: true, subtree: true }); } catch {}

    // 4) Sembrar claves de plan/límites para evitar chequeos client-side
    try {
      const seeds = {
        NA_PLAN: 'pro',
        GUARDIAN_PLAN: 'pro',
        guardian_plan: 'pro',
        guardian_tier: 'pro',
        daily_token_limit: String(Number.MAX_SAFE_INTEGER),
        daily_token_used: '0',
        monthly_token_limit: String(Number.MAX_SAFE_INTEGER),
        monthly_token_used: '0',
      };
      Object.keys(seeds).forEach((k) => {
        try { localStorage.setItem(k, seeds[k]); } catch {}
      });
    } catch {}

    // 5) Forzar ruta fuera de login si la SPA insiste
    function forceHomeRoute(){
      try {
        if (location.hash && /login/i.test(location.hash)) { location.hash = '#/'; }
        // Para BrowserRouter sin hash
        try { history.replaceState({}, '', '/'); } catch {}
      } catch {}
    }
    document.addEventListener('DOMContentLoaded', forceHomeRoute, true);
    setInterval(forceHomeRoute, 1000);

    // 6) Limpiar correctamente en logout
    try {
      ipcRenderer.on('trigger-logout', () => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {}
        try { ipcRenderer.send('delete-token'); } catch {}
        try { ipcRenderer.send('delete-refresh-token'); } catch {}
        try { location.reload(); } catch {}
      });
    } catch {}
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
        // Rebrand visible strings
        t = t.replace(/\bInquiry\b/g, 'ARKAIOS');
        t = t.replace(/\bNeuralAgent\b/g, 'ARKAIOS NEURAL AGENT');
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

// ---- Arkaios Offline Mode: bloquear conexiones externas y suprimir modal de upgrade ----
(() => {
  try {
    // Interceptar fetch para devolver plan PRO y evitar mensajes de límite
    const originalFetch = window.fetch?.bind(window);
    const isHttp = (u) => /^(https?:)?\/\//i.test(u);
    const looksLikeLimitEndpoint = (u) =>
      /(limits|quota|usage|subscription|billing|plan|upgrade|token-limit|daily-token|pricing)/i.test(u);

    async function buildProResponse(seed = {}) {
      const payload = {
        status: "ok",
        plan: "pro",
        tier: "pro",
        limits: {
          tokens_per_day: Number.MAX_SAFE_INTEGER,
          tasks_per_day: Number.MAX_SAFE_INTEGER,
        },
        usage: {
          tokens_used_today: 0,
          tasks_used_today: 0,
        },
        upgradeRequired: false,
        ...seed,
      };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (originalFetch) {
      window.fetch = async (input, init) => {
        try {
          const urlStr = typeof input === "string" ? input : String(input?.url || input);

          // Para endpoints de límites/plan, devolver PRO directamente
          if (isHttp(urlStr) && looksLikeLimitEndpoint(urlStr)) {
            return buildProResponse();
          }

          // Para el resto, intentar la solicitud normal y corregir respuestas que obliguen upgrade
          const res = await originalFetch(input, init).catch(async () => {
            // Si falla la red (por ejemplo, servidor remoto), devolver una respuesta PRO por defecto
            return buildProResponse();
          });

          try {
            const ct = res.headers?.get("content-type") || "";
            if (ct.includes("application/json")) {
              const data = await res.clone().json().catch(() => null);
              if (
                data &&
                (data.upgradeRequired === true ||
                  /free/i.test(String(data.plan || "")) ||
                  data.daily_limit_reached === true ||
                  data.status === "limit_reached" ||
                  (data.limits && (data.limits.blocked || data.limits.reached)))
              ) {
                return buildProResponse(data);
              }
            }
          } catch {}

          return res;
        } catch (e) {
          // Si algo sale mal, nunca bloquear la UI: responder PRO
          return buildProResponse();
        }
      };
    }

    // Desactivar conexiones WebSocket que pudieran forzar estado remoto
    try {
      const OriginalWS = window.WebSocket;
      class DummyWS {
        constructor() {
          this.readyState = 3; // CLOSED
          setTimeout(() => {
            try {
              this.onclose && this.onclose({ code: 1000, reason: "Arkaios offline mode" });
            } catch {}
          }, 0);
        }
        close() {}
        send() {}
        addEventListener() {}
        removeEventListener() {}
      }
      // Solo reemplazar si el destino parece externo
      window.WebSocket = new Proxy(OriginalWS, {
        construct(target, args) {
          try {
            const url = args?.[0] || "";
            if (isHttp(String(url))) {
              return new DummyWS();
            }
          } catch {}
          return new target(...args);
        },
      });
    } catch {}

    // Desactivar EventSource externos (SSE)
    try {
      const OriginalES = window.EventSource;
      window.EventSource = new Proxy(OriginalES, {
        construct(target, args) {
          try {
            const url = args?.[0] || "";
            if (isHttp(String(url))) {
              return { close() {} };
            }
          } catch {}
          return new target(...args);
        },
      });
    } catch {}

    // Suprimir cualquier modal de "Upgrade Required" que aparezca en la UI
    const suppressUpgradeModal = () => {
      try {
        const candidates = document.querySelectorAll('[role="dialog"], .modal, .MuiDialog-root, .chakra-modal__content-container');
        for (const el of candidates) {
          const txt = (el.textContent || "").trim();
          if (/upgrade required/i.test(txt) || /daily token limit reached/i.test(txt)) {
            try { el.remove(); } catch {}
            try { document.querySelectorAll(".MuiBackdrop-root,.modal-backdrop,.chakra-modal__overlay").forEach((b)=>b.remove()); } catch {}
          }
        }
      } catch {}
    };
    try {
      window.addEventListener("DOMContentLoaded", () => {
        suppressUpgradeModal();
        try {
          new MutationObserver(() => suppressUpgradeModal()).observe(document.body, { childList: true, subtree: true });
        } catch {}
      });
    } catch {}
  } catch (e) {
    console.warn("Arkaios offline mode preload error", e);
  }
})();
