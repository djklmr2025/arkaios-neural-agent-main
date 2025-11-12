#!/usr/bin/env node
// CLI: Respuesta JSON (no streaming) desde Flowith Knowledge Base
// Uso:
//   node src/scripts/flowithSeekOnce.js "tu mensaje" fc765190-f898-4477-a5d9-c53df73dcb47

const { seekKnowledgeBaseOnce } = require('../utils/flowithClient');

async function main() {
  const [, , messageArg, ...kbArgs] = process.argv;
  if (!messageArg) {
    console.error('Error: Debes pasar un mensaje. Ej: node src/scripts/flowithSeekOnce.js "hola" <KB_ID>');
    process.exit(1);
  }
  const kbList = kbArgs.length > 0 ? kbArgs : ['fc765190-f898-4477-a5d9-c53df73dcb47'];
  try {
    const json = await seekKnowledgeBaseOnce({ message: messageArg, kbList, model: 'gpt-4.1-mini' });
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Fallo en request:', err.message || err);
    process.exit(2);
  }
}

main();

