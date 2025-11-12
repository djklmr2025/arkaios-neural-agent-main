// Demo script: plan + generate + binary attachment using cosmos-gateway-module
const path = require('node:path');
const fs = require('node:fs');

const moduleRoot = path.join(__dirname, '..', '..', 'cosmos-gateway-module', 'src');
const {
  initCosmosEnvironment,
  healthPing,
  createTask,
  sendTaskMessage,
  COSMOS_BASE,
} = require(moduleRoot);

(async () => {
  try {
    const envPath = path.join('c:\\Program Files\\NeuralAgent', '.env', '.env.txt');
    initCosmosEnvironment(envPath);
    console.log('[ENV] Loaded .env:', envPath);
    console.log('[BASE] COSMOS_BASE:', process.env.REACT_APP_COSMOS_BASE || COSMOS_BASE);

    const health = await healthPing();
    console.log('[HEALTH]', health);

    const plan = await createTask({ title: 'Demo Plan', input: 'Objetivo: probar envío de adjunto binario (base64) en generate.' });
    console.log('[PLAN]', plan);

    const threadId = plan?.threadId || plan?.data?.threadId || plan?.reply?.threadId;
    if (!threadId) {
      console.warn('[WARN] No threadId from plan reply. Attempting to continue anyway.');
    }

    // Pick a local image and encode as base64
    const imgPath = path.join('c:\\Program Files\\NeuralAgent', 'arkaios', 'Worldcoin-World-Chain-2048x1229.webp');
    let contentBase64 = null;
    try {
      const buf = fs.readFileSync(imgPath);
      contentBase64 = buf.toString('base64');
    } catch (e) {
      console.warn('[WARN] Could not read image for attachment:', imgPath, e.message);
    }

    const attachments = contentBase64
      ? [{ content_base64: contentBase64, meta: { mime: 'image/webp', filename: 'Worldcoin-World-Chain-2048x1229.webp' } }]
      : undefined;

    const gen = await sendTaskMessage({ threadId, message: 'Adjunto imagen de prueba en base64.', attachments });
    console.log('[GENERATE]', gen);

    console.log('\n[DEMO DONE]');
  } catch (err) {
    console.error('[ERROR]', err?.message || err);
    if (err?.response) {
      console.error('[ERROR RESPONSE]', err.response);
    }
  }
})();

