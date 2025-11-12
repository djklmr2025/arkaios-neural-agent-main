// Prueba rápida del Cosmos Adapter
// Ejecuta: node src/scripts/cosmosHealthTest.js

const { loadEnv } = require('../utils/envLoader.js');
loadEnv();
const adapter = require('../utils/cosmosAdapter.js');

(async () => {
  try {
    console.log('COSMOS_BASE:', adapter.COSMOS_BASE);
    const h = await adapter.healthPing();
    console.log('Health OK:', h);

    const plan = await adapter.createTask({
      title: 'Prueba rápida',
      input: 'Genera un plan breve para integrar gateway en frontend',
    });
    console.log('Plan reply:', plan);

    const gen = await adapter.sendTaskMessage({
      threadId: plan?.threadId || undefined,
      message: 'Resume el objetivo en una sola frase',
    });
    console.log('Generate reply:', gen);
  } catch (e) {
    console.error('Test error:', e && e.message ? e.message : e);
  }
})();
