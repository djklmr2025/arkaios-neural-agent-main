#!/usr/bin/env node
// CLI: Streaming SSE desde Flowith Knowledge Base
// Uso:
//   node src/scripts/flowithSeekStream.js "tu mensaje" fc765190-f898-4477-a5d9-c53df73dcb47
//   node src/scripts/flowithSeekStream.js "tu mensaje" KB_ID_1 KB_ID_2

const { seekKnowledgeBaseStream } = require('../utils/flowithClient');

async function main() {
  const [, , messageArg, ...kbArgs] = process.argv;
  if (!messageArg) {
    console.error('Error: Debes pasar un mensaje. Ej: node src/scripts/flowithSeekStream.js "hola" <KB_ID>');
    process.exit(1);
  }

  const kbList = kbArgs.length > 0 ? kbArgs : ['fc765190-f898-4477-a5d9-c53df73dcb47'];

  let fullText = '';
  console.log('> Streaming desde Flowith...');
  try {
    await seekKnowledgeBaseStream({
      message: messageArg,
      kbList,
      model: 'gpt-4.1-mini',
      onEvent: (evt) => {
        if (evt.tag === 'final' || evt.tag === 'chunk') {
          const s = typeof evt.delta === 'string' ? evt.delta : '';
          fullText += s;
          process.stdout.write(s);
        } else if (evt.tag === 'done') {
          console.log('\n\n[DONE]');
        } else if (evt.tag === 'parse_error') {
          console.error('\n[ParseError]', evt.raw);
        }
      },
    });
  } catch (err) {
    console.error('Fallo en streaming:', err.message || err);
    process.exit(2);
  }
}

main();

