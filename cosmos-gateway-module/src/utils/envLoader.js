const path = require('node:path');
const fs = require('node:fs');

function parseEnvText(text) {
  const out = {};
  const lines = (text || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnv(customFilePath) {
  try {
    const envPath = customFilePath || path.join(process.cwd(), '.env', '.env.txt');
    if (!fs.existsSync(envPath)) return false;
    const text = fs.readFileSync(envPath, 'utf8');
    const vars = parseEnvText(text);
    for (const [k, v] of Object.entries(vars)) {
      if (typeof process.env[k] === 'undefined') process.env[k] = v;
    }
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { loadEnv };

