// Flowith API Client (CommonJS)
// Provides: seekKnowledgeBaseOnce (JSON), seekKnowledgeBaseStream (SSE)
// Reads FLOWITH_API_KEY from process.env (optionally via src/utils/envLoader)

const { loadEnv } = require('./envLoader');
const DEFAULT_BASE_URL = 'https://edge.flowith.net';

function getApiKey() {
  // Try to load local env file if present
  try { loadEnv(); } catch (_) {}
  const key = process.env.FLOWITH_API_KEY || process.env.FLOWITH_KEY || process.env.FLOWITH_TOKEN;
  if (!key) throw new Error('FLOWITH_API_KEY no está definido en el entorno. Configura la variable antes de usar el cliente.');
  return key;
}

function makeHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getApiKey()}`,
  };
}

/**
 * Realiza una búsqueda en Knowledge Base y espera respuesta completa JSON.
 * @param {Object} options
 * @param {string} options.message - Prompt o mensaje.
 * @param {string} [options.model='gpt-4.1-mini'] - Modelo solicitado.
 * @param {string[]} [options.kbList] - Lista de KB IDs.
 * @param {string} [options.baseUrl] - Base URL del API.
 * @returns {Promise<Object>} JSON de respuesta.
 */
async function seekKnowledgeBaseOnce({ message, model = 'gpt-4.1-mini', kbList = [], baseUrl = DEFAULT_BASE_URL } = {}) {
  if (!message || typeof message !== 'string') throw new Error('message es requerido');
  const body = {
    messages: [{ role: 'user', content: message }],
    model,
    stream: false,
  };
  if (Array.isArray(kbList) && kbList.length > 0) body.kb_list = kbList;

  const res = await fetch(`${baseUrl}/external/use/knowledge-base/seek`, {
    method: 'POST',
    headers: makeHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

/**
 * Realiza una búsqueda en Knowledge Base en modo streaming (SSE).
 * Llama a onEvent para cada chunk con { tag, delta, raw }.
 * @param {Object} options
 * @param {string} options.message
 * @param {Function} options.onEvent - (evt) => void
 * @param {string} [options.model='gpt-4.1-mini']
 * @param {string[]} [options.kbList]
 * @param {string} [options.baseUrl]
 */
async function seekKnowledgeBaseStream({ message, onEvent, model = 'gpt-4.1-mini', kbList = [], baseUrl = DEFAULT_BASE_URL } = {}) {
  if (!message || typeof message !== 'string') throw new Error('message es requerido');
  if (typeof onEvent !== 'function') throw new Error('onEvent (función) es requerido para procesar el stream');

  const body = {
    messages: [{ role: 'user', content: message }],
    model,
    stream: true,
  };
  if (Array.isArray(kbList) && kbList.length > 0) body.kb_list = kbList;

  const res = await fetch(`${baseUrl}/external/use/knowledge-base/seek`, {
    method: 'POST',
    headers: makeHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }

  // Parse SSE line-by-line
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trimEnd();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          onEvent({ tag: 'done', delta: '', raw: payload });
          return;
        }
        try {
          const json = JSON.parse(payload);
          const tag = json.tag || json.type || 'chunk';
          const delta = json.delta || json.text || '';
          onEvent({ tag, delta, raw: json });
        } catch (e) {
          onEvent({ tag: 'parse_error', delta: '', raw: payload });
        }
      }
    }
  }
}

module.exports = {
  seekKnowledgeBaseOnce,
  seekKnowledgeBaseStream,
};

