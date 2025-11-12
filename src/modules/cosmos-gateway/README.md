# Cosmos Gateway Module

Este módulo integra el `gateway` de cosmos-den en tu proyecto y expone funciones listas para usar:

Exporta:
- `initCosmosEnvironment(filePath?)` — carga variables desde `./.env/.env.txt`.
- `healthPing()` — GET `/health`.
- `callGateway(action, params)` — POST `/api/gateway`.
- `createTask({ title, input, attachments })` — acción `plan`.
- `sendTaskMessage({ threadId, message, attachments })` — acción `generate`.
- `quickPlanAndGenerate(objective, followUpMessage?)` — utilidad para probar ambas.

Variables en `.env/.env.txt`:
```
REACT_APP_COSMOS_ACTIVE=true
REACT_APP_COSMOS_BASE=https://cosmos-den.vercel.app
REACT_APP_API_KEY=
```

Uso mínimo (Node):
```
const cosmos = require('../../modules/cosmos-gateway');
cosmos.initCosmosEnvironment();
(async () => {
  console.log('Base:', cosmos.COSMOS_BASE);
  console.log('Health:', await cosmos.healthPing());
  const { plan, gen } = await cosmos.quickPlanAndGenerate('Haz un plan breve', 'Resume el objetivo');
  console.log({ plan, gen });
})();
```

Adjuntos:
- Enviar como JSON: `{ type:'text'|'file', name, content, content_base64?, meta:{ mime } }`.
- El gateway abierto no estandariza `multipart/form-data` aún; se recomienda `base64`.

