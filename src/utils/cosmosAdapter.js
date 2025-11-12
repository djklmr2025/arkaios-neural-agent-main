// Cosmos Adapter — integración simple con cosmos-den gateway
// Base: https://cosmos-den.vercel.app
// Endpoints:
//  - GET /health
//  - POST /api/gateway  { agent_id, action, params }
// Acciones comunes: plan (crear tarea), generate (enviar mensaje)

const COSMOS_BASE = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_COSMOS_BASE) || 'https://cosmos-den.vercel.app';
const COSMOS_ACTIVE = String(((typeof process !== 'undefined' && process.env && process.env.REACT_APP_COSMOS_ACTIVE) || 'true')).toLowerCase() === 'true';

function getAuthHeader() {
  try {
    const tok = (typeof localStorage !== 'undefined' && localStorage.getItem('access_token')) || (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_KEY);
    return tok ? `Bearer ${tok}` : null;
  } catch (_) {
    const tok = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_KEY);
    return tok ? `Bearer ${tok}` : null;
  }
}

async function healthPing() {
  const url = `${COSMOS_BASE}/health`;
  const r = await fetch(url, { method: 'GET' });
  if (!r.ok) throw new Error(`Health failed: ${r.status} ${r.statusText}`);
  return r.json();
}

function normalizeAttachments(attachments) {
  if (!attachments || !Array.isArray(attachments)) return undefined;
  // Se recomienda enviar adjuntos como JSON. Para binarios, usar content_base64 y meta.mime
  return attachments.map(a => {
    const out = { ...a };
    // Normalización sencilla de claves comunes
    if (out.content && typeof out.content !== 'string') {
      try { out.content = JSON.stringify(out.content); } catch (_) {}
    }
    return out;
  });
}

async function callGateway(action, params = {}, opts = {}) {
  const url = `${COSMOS_BASE}/api/gateway`;
  const headers = { 'Content-Type': 'application/json' };
  const auth = getAuthHeader();
  if (auth) headers['Authorization'] = auth;
  const apiKey = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_KEY);
  if (apiKey && !auth) headers['X-API-Key'] = apiKey;

  const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timeoutMs = opts.timeoutMs ?? 30000;
  let t;
  if (controller) t = setTimeout(() => controller.abort(), timeoutMs);

  const body = { agent_id: opts.agentId || 'web', action, params };
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller?.signal });
  if (t) clearTimeout(t);

  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText || 'Gateway error');
  return j.reply ?? j;
}

// createTask → action "plan"
async function createTask({ title, input, attachments } = {}) {
  const params = { title, objective: input, attachments: normalizeAttachments(attachments) };
  return callGateway('plan', params);
}

// sendTaskMessage → action "generate"
async function sendTaskMessage({ threadId, message, attachments } = {}) {
  const params = { threadId, message, attachments: normalizeAttachments(attachments) };
  return callGateway('generate', params);
}

export { COSMOS_ACTIVE, COSMOS_BASE, getAuthHeader, healthPing, callGateway, createTask, sendTaskMessage };

// Compatibilidad CommonJS
try {
  // eslint-disable-next-line no-undef
  module.exports = { COSMOS_ACTIVE, COSMOS_BASE, getAuthHeader, healthPing, callGateway, createTask, sendTaskMessage };
} catch (_) {}

