// Defaults: local backend
const PROTOCOL = process.env.REACT_APP_PROTOCOL || 'http';
const WS_PROTOCOL = process.env.REACT_APP_WEBSOCKET_PROTOCOL || 'ws';
const DNS = process.env.REACT_APP_DNS || '127.0.0.1:8000';

// ARKAIOS/COSMOS overrides (if provided via env)
const COSMOS_BASE = process.env.REACT_APP_COSMOS_BASE || '';
// Prefer explicit API base if provided; otherwise fall back to legacy ARKAIOS_* envs
const API_BASE =
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_ARKAIOS_GATEWAY_URL ||
  process.env.REACT_APP_ARKAIOS_API_URL ||
  process.env.REACT_APP_ARKAIOS_CORE_API_URL || '';
const ARKAIOS_WS_BASE = process.env.REACT_APP_ARKAIOS_WS_URL || '';

const SERVER_DNS = PROTOCOL + '://' + DNS;
const WEBSOCKET_DNS = WS_PROTOCOL + '://' + DNS;

// Decide which base to use for general API calls: prefer API_BASE (backend), not COSMOS
// COSMOS_BASE is reserved for gateway-specific features via cosmosAdapter
const BASE_HTTP = API_BASE ? API_BASE : (SERVER_DNS + '/apps');
const BASE_WS = ARKAIOS_WS_BASE ? ARKAIOS_WS_BASE : WEBSOCKET_DNS + '/apps';

// Bypass login flag (used to enter directly to the interface)
const BYPASS_LOGIN =
  process.env.REACT_APP_ARKAIOS_BYPASS_LOGIN === '1' ||
  process.env.REACT_APP_ARKAIOS_BYPASS_LOGIN === 'true' ||
  process.env.REACT_APP_BYPASS_LOGIN === '1' ||
  process.env.REACT_APP_BYPASS_LOGIN === 'true' ||
  process.env.REACT_APP_ARKAIOS_LOCAL_MODE === '1' ||
  process.env.REACT_APP_ARKAIOS_LOCAL_MODE === 'true';

const constants = {
  BASE_URL: BASE_HTTP,
  WEBSOCKET_URL: BASE_WS,
  COSMOS_BASE,
  // Cosmos active flag: requires explicit opt-in via env AND a base URL configured
  COSMOS_ACTIVE: (
    (process.env.REACT_APP_COSMOS_ACTIVE === '1' || process.env.REACT_APP_COSMOS_ACTIVE === 'true')
  ) && !!COSMOS_BASE,
  // API key may be required by some endpoints; keep empty if not configured
  API_KEY: process.env.REACT_APP_API_KEY || '',
  AUTH_HEADER: process.env.REACT_APP_AUTH_HEADER || 'Authorization',
  AUTH_SCHEME: process.env.REACT_APP_AUTH_SCHEME || 'Api-Key',
  APP_NAME: 'GOD ARKAIOS AI',
  NEURALAGENT_LINK: 'https://www.getneuralagent.com',
  GENERAL_ERROR: 'Something wrong happened, please try again.',
  status: {
    INTERNAL_SERVER_ERROR: 500,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    BAD_REQUEST: 400
  },
  BYPASS_LOGIN,
};

export default constants;
