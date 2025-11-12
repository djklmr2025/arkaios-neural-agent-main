import constants from './constants';
import moment from 'moment';
// import 'moment/locale/ar';
import axios, { API_KEY_HEADER } from './axios';
import { setLoadingDialog } from '../store';

// Electron/web safe stub: ensures functions exist in web preview
const electronAPI = (typeof window !== 'undefined' && window.electronAPI) ? window.electronAPI : {
  getToken: async () => {
    try { return window.localStorage.getItem('_NA_ACCESS_TOK') || null; } catch { return null; }
  },
  setToken: (tok) => {
    try { window.localStorage.setItem('_NA_ACCESS_TOK', tok); } catch {}
  },
  deleteToken: () => {
    try { window.localStorage.removeItem('_NA_ACCESS_TOK'); } catch {}
  },
  getRefreshToken: async () => {
    try { return window.localStorage.getItem('_NA_REFRESH_TOK') || null; } catch { return null; }
  },
  setRefreshToken: (tok) => {
    try { window.localStorage.setItem('_NA_REFRESH_TOK', tok); } catch {}
  },
  deleteRefreshToken: () => {
    try { window.localStorage.removeItem('_NA_REFRESH_TOK'); } catch {}
  },
};

export function openInNewTab(url) {
  var win = window.open(url, '_blank')
  win.focus()
}

export const logoutUserLocally = (removeCookie) => {
  try {
    electronAPI.deleteToken();
    electronAPI.deleteRefreshToken();
  } catch {
    // fallback already handled in stub
  }
  window.location.reload();
};

export const logoutUser = (accessToken, dispatch) => {
  console.log(accessToken);
  dispatch(setLoadingDialog(true));
  axios.post('/auth/logout', {access_token: accessToken}, API_KEY_HEADER)
    .then((response) => {
      dispatch(setLoadingDialog(false));
      logoutUserLocally();
    })
    .catch((error) => {
      dispatch(setLoadingDialog(false));
      const status = error?.response?.status;
      if (status === constants.status.UNAUTHORIZED) {
        logoutUserLocally();
      }
    });
}

export const refreshToken = async () => {
  // En modo bypass/desarrollo web, no intentamos refrescar y forzamos logout local
  if (constants.BYPASS_LOGIN) {
    logoutUserLocally();
    return;
  }
  const rTok = electronAPI?.getRefreshToken ? await electronAPI.getRefreshToken() : null;
  if (!rTok) {
    logoutUserLocally();
    return;
  }
  axios.post('/auth/refresh_token', { refresh_token: rTok }, API_KEY_HEADER)
    .then((response) => {
      const data = response.data;
      try {
        electronAPI.setToken(data.new_token);
        if (data.new_refresh !== null) {
          electronAPI.setRefreshToken(data.new_refresh);
        }
      } catch {}
      window.location.reload();
    }).catch((error) => {
      if (error?.response?.status === constants.status.UNAUTHORIZED) {
        logoutUserLocally();
      }
    });
};

export const getBadRequestErrorMessage = (data) => {

  if (data === null || data.message === undefined) {
    return constants.GENERAL_ERROR;
  }

  if (data.message === 'Limited_2_Projects') {
    return 'You are currently limited to two projects';
  }

  return constants.GENERAL_ERROR;
};

export const formatDateTime = (date_str, lang = 'en', format = 'LLLL') => {
  moment.locale(lang);
  let date = moment(date_str);
  return date.format(format);
};

export const localDateTimeToUtc = (time) => {
  moment.locale('en');
  let date = new moment(time, 'YYYY-MM-DDTHH:mm').utc();
  return date.format('YYYY-MM-DDTHH:mm');
};

export const utcDateTimeToLocal = (time) => {
  moment.locale('en');
  let date = moment.utc(time, 'YYYY-MM-DDTHH:mm').local();
  return date.format('YYYY-MM-DDTHH:mm');
};

export const formatTime = (time, format, lang = 'en') => {
  moment.locale(lang);
  let date = moment(time, 'HH:mm:ss');
  return date.format(format);
};

export const formatDate = (date_str, format) => {
  moment.locale('en');
  let date = moment(date_str);
  return date.format(format);
};

export const localTimeToUtc = (time) => {
  moment.locale('en');
  let date = new moment(time, 'HH:mm:ss').utc();
  return date.format('HH:mm:ss');
};

export const utcToLocalTime = (time) => {
  moment.locale('en');
  let date = moment.utc(time, 'HH:mm:ss').local();
  return date.format('HH:mm:ss');
};

export const isLessThanNow = (date) => {
  let current_time = moment();
  let shown_at = moment(utcDateTimeToLocal(date));
  let dif = current_time.diff(shown_at);
  return dif > 0;
};
