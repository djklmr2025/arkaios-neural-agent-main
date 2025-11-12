const adapter = require('./adapter/cosmosAdapter.js');
const { loadEnv } = require('./utils/envLoader.js');

function initCosmosEnvironment(filePath) {
  return loadEnv(filePath);
}

async function quickPlanAndGenerate(objective, followUpMessage) {
  const plan = await adapter.createTask({ title: 'Quick Plan', input: objective });
  const gen = await adapter.sendTaskMessage({ threadId: plan?.threadId, message: followUpMessage || 'Ok' });
  return { plan, gen };
}

module.exports = {
  initCosmosEnvironment,
  quickPlanAndGenerate,
  COSMOS_ACTIVE: adapter.COSMOS_ACTIVE,
  COSMOS_BASE: adapter.COSMOS_BASE,
  healthPing: adapter.healthPing,
  callGateway: adapter.callGateway,
  createTask: adapter.createTask,
  sendTaskMessage: adapter.sendTaskMessage,
};

