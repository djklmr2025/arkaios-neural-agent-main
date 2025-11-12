[![ARKAIOS Agent](docs/images/neuralagent_github_cover.jpg)](https://www.getneuralagent.com)

**ARKAIOS Agent** es tu asistente personal de IA que realmente *hace las cosas*. Vive en tu escritorio, escribe, hace clic, navega por el navegador, completa formularios, envía correos electrónicos y realiza tareas automáticamente usando **ARKAIOS**, tu IA maestra de última generación, todo impulsado por una arquitectura rápida, extensible y abierta. ARKAIOS Agent usa tu computadora tanto en primer plano como en segundo plano.

> Productividad real. No solo conversación. **Completamente gratis, sin costos por tokens o acciones.**

---

[![Star ARKAIOS Agent](https://img.shields.io/github/stars/withneural/neuralagent?style=social)](https://github.com/withneural/neuralagent/stargazers)

> ⭐️ ¡Si ARKAIOS Agent te inspira o ayuda, dale una estrella!

---

En esta demostración, ARKAIOS Agent recibió el siguiente comando:

"¡Encuentra 5 repositorios de GitHub en tendencia, luego escribe sobre ellos en el Bloc de notas y guárdalo en mi escritorio!"

¡ARKAIOS se encargó del resto!

![Demo](docs/images/demo.gif)

---

## 🌎 Sitio Web y Comunidad

- 🌐 **Sitio Web**: [https://www.getneuralagent.com](https://www.getneuralagent.com)
- 💬 **Discord**: [Únete al Discord de ARKAIOS Agent](https://discord.gg/eGyW3kPcUs)

---

## 🚀 Características

- ✅ Automatización de escritorio con `pyautogui`
- ✅ Automatización en segundo plano (Solo Windows por ahora) vía WSL (solo navegador)
- ✅ Impulsado por **ARKAIOS**, tu IA maestra
- ✅ **100% Gratuito - Sin costos por uso de tokens o acciones**
- ✅ Agentes modulares: Planificador, Clasificador, Sugeridor, Título y más
- ✅ Multimodal (texto + visión)
- ✅ Backend FastAPI + Electron + Frontend React

---

## 🖥️ Estructura del Proyecto

```
arkaios-agent/
├── backend/              # Backend FastAPI + Postgres
├── desktop/              # Aplicación de escritorio ElectronJS
│   ├── neuralagent-app/  # Frontend React dentro de Electron
│   └── aiagent/          # Código Python (pyautogui)
└── README.md
```

---

## ⚙️ Instrucciones de Configuración

> 🧪 Abre **dos ventanas de terminal** - una para `backend` y otra para `desktop`.

---

### 🔧 Configuración del Backend

1. **Crea y activa un entorno virtual (opcional pero recomendado):**

```bash
cd backend
python -m venv venv
# Activar:
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows
```

2. **Instala los requisitos:**

```bash
pip install -r requirements.txt
```

3. **Crea una base de datos local de Postgres.**

4. **Copia `.env.example` a `.env` y completa:**

```env
DB_HOST=
DB_PORT=
DB_DATABASE=
DB_USERNAME=
DB_PASSWORD=

# No necesario, déjalo vacío
DB_CONNECTION_STRING=

JWT_ISS=ARKAIOSAgentBackend
# Genera una cadena aleatoria para JWT_SECRET
JWT_SECRET=

# Déjalo vacío por ahora
REDIS_CONNECTION=

# Configuración de ARKAIOS (IA Maestra)
# ARKAIOS es completamente gratuito - sin costos por tokens o acciones
ARKAIOS_ENABLED=true
ARKAIOS_ENDPOINT=
ARKAIOS_API_KEY=

# Opcional: Para otros proveedores (si deseas usarlos en lugar de ARKAIOS)
# Nota: ARKAIOS es gratuito, estos proveedores pueden tener costos
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
BEDROCK_REGION=us-west-2

AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
OPENAI_API_VERSION=2024-12-01-preview

OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Configuración del modelo por agente
# Usa 'arkaios' como tipo de modelo para servicio gratuito
CLASSIFIER_AGENT_MODEL_TYPE=arkaios
CLASSIFIER_AGENT_MODEL_ID=arkaios-master

TITLE_AGENT_MODEL_TYPE=arkaios
TITLE_AGENT_MODEL_ID=arkaios-master

SUGGESTOR_AGENT_MODEL_TYPE=arkaios
SUGGESTOR_AGENT_MODEL_ID=arkaios-master

PLANNER_AGENT_MODEL_TYPE=arkaios
PLANNER_AGENT_MODEL_ID=arkaios-master

COMPUTER_USE_AGENT_MODEL_TYPE=arkaios
COMPUTER_USE_AGENT_MODEL_ID=arkaios-master

# Uso interno solamente para registro opcional de capturas de pantalla durante el entrenamiento (desactivado por defecto)
# Esto no es usado por la aplicación de código abierto o contribuidores
ENABLE_SCREENSHOT_LOGGING_FOR_TRAINING=false
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=

# Para rastreo, mantén false si no necesitas rastreo de langsmith
LANGCHAIN_TRACING_V2=false
LANGCHAIN_ENDPOINT=
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=

# Opcional para inicio de sesión con Google
GOOGLE_LOGIN_CLIENT_ID=
GOOGLE_LOGIN_CLIENT_SECRET=
GOOGLE_LOGIN_DESKTOP_REDIRECT_URI=http://127.0.0.1:36478
```

5. **Ejecuta las migraciones de la base de datos:**

```bash
alembic upgrade head
```

6. **Inicia el servidor backend:**

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

### 🖥️ Configuración del Frontend (Desktop + Electron)

1. **Instala las dependencias en la raíz de Electron:**

```bash
cd desktop
npm install
```

2. **Navega a la aplicación React:**

```bash
cd neuralagent-app
npm install
```

3. **Copia `.env.example` a `.env` y completa:**

```env
REACT_APP_PROTOCOL=http
REACT_APP_WEBSOCKET_PROTOCOL=ws
REACT_APP_DNS=127.0.0.1:8000
REACT_APP_API_KEY=
```

4. **Regresa a la raíz del desktop:**

```bash
cd ..
```

5. **Configura el daemon del agente de IA local (servicio Python):**
```bash
cd aiagent
python -m venv venv
source venv/bin/activate  # O usa `venv\Scripts\activate` en Windows
pip install -r requirements.txt
deactivate
```

6. **Inicia la aplicación de escritorio Electron:**

```bash
cd ..
npm start
```

---

## 🤖 Agentes e IA Maestra ARKAIOS

**ARKAIOS Agent** utiliza **ARKAIOS** como tu IA maestra principal, proporcionando capacidades avanzadas de automatización **completamente gratis, sin costos por tokens o acciones**.

También puedes configurar diferentes proveedores de modelos (`OpenAI`, `Azure OpenAI`, `Anthropic`, `Bedrock`) por agente en `.env` si lo prefieres, aunque estos pueden tener costos asociados.

Los tipos de agentes incluyen:

- `PLANNER_AGENT` - Planifica y organiza tareas complejas
- `CLASSIFIER_AGENT` - Clasifica y categoriza acciones
- `TITLE_AGENT` - Genera títulos descriptivos
- `SUGGESTOR_AGENT` - Sugiere próximos pasos
- `COMPUTER_USE_AGENT` - Ejecuta acciones en tu computadora

**Todos los agentes pueden usar ARKAIOS de forma gratuita e ilimitada.**

---

## 💰 Modelo de Precios

### ✨ **ARKAIOS - Completamente Gratuito**
- ❌ **Sin costos por tokens**
- ❌ **Sin costos por acciones**
- ❌ **Sin límites de uso**
- ✅ **100% Gratuito para siempre**

ARKAIOS Agent está diseñado para ser accesible para todos. No hay tarifas ocultas, no hay límites de uso, no hay cargos por API. Solo productividad pura impulsada por IA.

---

## 📣 Contribuciones

¡Damos la bienvenida a pull requests y contribuciones de la comunidad!

---

## 🛡️ Licencia

Licencia MIT.  
Úsalo bajo tu propio riesgo. Esta herramienta mueve tu mouse y escribe en tu nombre, ¡pruébala responsablemente!

---

## 💬 ¿Preguntas?

Siéntete libre de abrir un issue o iniciar una discusión.

---

**Hecho con ❤️ por la comunidad ARKAIOS**
