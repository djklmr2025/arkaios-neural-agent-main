// Flowith API helpers (ESM)
// NOTE: This runs in Electron main process. It uses process.env.FLOWITH_API_KEY.

const DEFAULT_BASE_URL = 'https://edge.flowith.net';

function getApiKey() {
  const key = process.env.FLOWITH_API_KEY || process.env.FLOWITH_KEY || process.env.FLOWITH_TOKEN;
  if (!key) throw new Error('FLOWITH_API_KEY no está definido en el entorno del proceso principal.');
  return key;
}

function makeHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getApiKey()}`,
  };
}

export async function flowithSeekOnce({ message, model = 'gpt-4.1-mini', kbList = [], baseUrl = DEFAULT_BASE_URL } = {}) {
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

export async function flowithSeekStream({ message, onEvent, model = 'gpt-4.1-mini', kbList = [], baseUrl = DEFAULT_BASE_URL } = {}) {
  if (!message || typeof message !== 'string') throw new Error('message es requerido');
  if (typeof onEvent !== 'function') throw new Error('onEvent (función) es requerido');

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

