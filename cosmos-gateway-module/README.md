# ARKAIOS Cosmos Gateway Module

Adapter y utilidades para consumir el gateway de cosmos-den desde Node/Electron o frontends.

Funciones principales:
- `initCosmosEnvironment(filePath?)`: carga variables desde `./.env/.env.txt`.
- `healthPing()`: GET `/health`.
- `callGateway(action, params)`: POST `/api/gateway`.
- `createTask({ title, input, attachments })`: acción `plan`.
- `sendTaskMessage({ threadId, message, attachments })`: acción `generate`.
- `quickPlanAndGenerate(objective, followUpMessage?)`: utilidad que encadena `plan` y `generate`.

Variables de entorno recomendadas:
```
REACT_APP_COSMOS_ACTIVE=true
REACT_APP_COSMOS_BASE=https://cosmos-den.vercel.app
REACT_APP_API_KEY=
```

Uso:
```
const cosmos = require('./src/index');
cosmos.initCosmosEnvironment();
(async () => {
  console.log('Base:', cosmos.COSMOS_BASE);
  console.log('Health:', await cosmos.healthPing());
  const { plan, gen } = await cosmos.quickPlanAndGenerate('Haz un plan breve', 'Resume el objetivo');
  console.log({ plan, gen });
})();
```

