/* Cosmos/Gateway adapter aligned to cosmos-den gateway (plan/generate actions) */

const COSMOS_ACTIVE = (() => {
  const val = (process.env.REACT_APP_COSMOS_ACTIVE || '').toString().toLowerCase();
  return val === 'true' || val === '1';
})();

const COSMOS_BASE = process.env.REACT_APP_COSMOS_BASE || 'https://cosmos-den.vercel.app';
const API_KEY = process.env.REACT_APP_API_KEY || '';

async function getAccessToken() {
  try {
    if (window?.electronAPI?.getToken) {
      const tok = await window.electronAPI.getToken();
      if (tok) return tok;
    }
  } catch {}
  try {
    return window.localStorage.getItem('_NA_ACCESS_TOK');
  } catch {}
  return null;
}

async function makeJsonPost(path, body) {
  const token = await getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) headers['x-api-key'] = API_KEY;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch(`${COSMOS_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const err = new Error(`Cosmos POST ${path} failed: ${resp.status} ${text}`);
    err.status = resp.status;
    throw err;
  }
  return await resp.json();
}

// Direct gateway call
async function callGateway(action, params) {
  return await makeJsonPost('/api/gateway', { agent_id: 'web', action, params });
}

export async function createTask({ title, objective, attachments = [] }) {
  if (!COSMOS_ACTIVE) {
    throw new Error('Cosmos gateway inactive. Enable REACT_APP_COSMOS_ACTIVE to use createTask online.');
  }
  // Normalize stringified JSON attachments
  const normalized = Array.isArray(attachments)
    ? attachments.map(a => {
        const out = { ...a };
        if (out.content && typeof out.content !== 'string') {
          try { out.content = JSON.stringify(out.content); } catch {}
        }
        return out;
      })
    : [];
  return await callGateway('plan', { title, objective, attachments: normalized });
}

export async function sendTaskMessage({ threadId, message, attachments = [] }) {
  if (!COSMOS_ACTIVE) {
    throw new Error('Cosmos gateway inactive. Enable REACT_APP_COSMOS_ACTIVE to use sendTaskMessage online.');
  }
  const normalized = Array.isArray(attachments)
    ? attachments.map(a => {
        const out = { ...a };
        if (out.content && typeof out.content !== 'string') {
          try { out.content = JSON.stringify(out.content); } catch {}
        }
        return out;
      })
    : [];
  return await callGateway('generate', { threadId, message, attachments: normalized });
}

export async function healthPing() {
  if (!COSMOS_ACTIVE) return { active: false };
  try {
    const resp = await fetch(`${COSMOS_BASE}/health`);
    const data = await resp.json().catch(() => ({}));
    return { active: true, ok: resp.ok, status: resp.status, data };
  } catch (e) {
    return { active: true, ok: false, error: String(e) };
  }
}

export default { createTask, sendTaskMessage, healthPing };
