import React, { useState, useEffect } from 'react';
import './App.css';
import {
  HashRouter as Router, // BrowserRouter
  Routes,
  Route
} from "react-router-dom";
import { useSelector, useDispatch } from 'react-redux';
import LoadingDialog from './components/LoadingDialog';
import FullLoading from './components/FullLoading';
import constants from './utils/constants';
import MessageBar from './components/Elements/MessageBar';
import { setAppLoading, setUser, setAccessToken, setLoadingDialog } from './store';
import RedirectTo from './components/RedirectTo';
import axios from './utils/axios';
import { API_KEY_HEADER } from './utils/axios';
import { logoutUser, refreshToken } from './utils/helpers';
import { AppMainContainer, OverlayContainer } from './layouts/Containers';
import Sidebar from './layouts/Sidebar';
import { useLocation } from 'react-router-dom';

import Login from './views/Login';
import SignUp from './views/SignUp';
import Home from './views/Home';
import Thread from './views/Thread';
import Overlay from './views/Overlay';
import BackgroundAuth from './views/BackgroundAuth';
import BackgroundTask from './views/BackgroundTask';
import BackgroundSetup from './views/BackgroundSetup';
import Flowith from './views/Flowith';

function AppRoutes() {
  const location = useLocation();
  const isOverlayRoute = location.pathname === '/overlay';
  const isBackgroundModeRoutes = location.pathname === '/background-auth' || location.pathname === '/background-task' || location.pathname === '/background-setup';

  const accessToken = useSelector(state => state.accessToken);
  const isError = useSelector(state => state.isError);
  const errorMessage = useSelector(state => state.errorMessage);
  const isSuccess = useSelector(state => state.isSuccess);
  const successMsg = useSelector(state => state.successMsg);

  // En modo BYPASS, evitamos mostrar el banner de error genérico que se activa cuando
  // el backend/gateway no está disponible durante el preview.
  const suppressGenericError = constants.BYPASS_LOGIN && (errorMessage === constants.GENERAL_ERROR || !errorMessage);
  const showErrorBar = isError && !suppressGenericError;

  return (
    <>
      {showErrorBar && <MessageBar message={errorMessage} backgroundColor='var(--danger-color)' />}
      {isSuccess && <MessageBar message={successMsg} backgroundColor='var(--success-color)' />}

      {(accessToken !== null || constants.BYPASS_LOGIN) ? (
        isOverlayRoute || isBackgroundModeRoutes ? (
          isOverlayRoute ? (
            <OverlayContainer>
              <Routes>
                <Route path="/overlay" element={<Overlay />} />
              </Routes>
            </OverlayContainer>
          ) : (
            <Routes>
              <Route path="/background-auth" element={<BackgroundAuth />} />
              <Route path="/background-task" element={<BackgroundTask />} />
              <Route path="/background-setup" element={<BackgroundSetup />} />
            </Routes>
          )
        ) : (
          <AppMainContainer>
            <Sidebar />
            <Routes>
              <Route path='/' element={<Home />} />
              <Route path='/threads/:tid' element={<Thread />} />
              <Route path='/flowith' element={<Flowith />} />
              <Route path="*" element={<RedirectTo linkType="router" to="/" redirectType="replace" />} />
            </Routes>
          </AppMainContainer>
        )
      ) : (
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="*" element={<RedirectTo linkType="router" to="/login" redirectType="replace" />} />
        </Routes>
      )}
    </>
  );
}


function App() {

  const isAppLoading = useSelector(state => state.isAppLoading);
  const isFullLoading = useSelector(state => state.isFullLoading);
  const isLoadingDialog = useSelector(state => state.isLoadingDialog);

  const dispatch = useDispatch();
  const [_windowDims, setWindowDims] = useState();

  const [isMobileBarOpen, setMobileBarOpen] = useState(false);

  const handleResize = () => {
    setWindowDims({
      height: window.innerHeight,
      width: window.innerWidth
    });
  }

  useEffect(() => {
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    // Robust stub for web preview without Electron: provides safe fallbacks
    const electronAPI = (typeof window !== 'undefined' && window.electronAPI) ? window.electronAPI : {
      getToken: async () => {
        try { return window.localStorage.getItem('_NA_ACCESS_TOK') || null; } catch { return null; }
      },
      onLogout: (cb) => { /* no-op in web */ },
      onCancelAllTasksTrigger: (cb) => { /* no-op in web */ },
      stopAIAgent: () => {},
      cancelAllTasksDone: () => {},
    };
    const asyncTask = async () => {
      // Safety: ensure loading dialog is OFF at app start so UI doesn't appear stuck
      // Some environments may retain state between hot reloads; this guarantees a clean slate.
      dispatch(setLoadingDialog(false));
      // En modo BYPASS, intentar autologin con credenciales precargadas si están disponibles
      if (constants.BYPASS_LOGIN) {
        const AUTO_EMAIL = process.env.REACT_APP_AUTOLOGIN_EMAIL || '';
        const AUTO_PASS = process.env.REACT_APP_AUTOLOGIN_PASSWORD || '';
        let didSetToken = false;
        if (AUTO_EMAIL && AUTO_PASS) {
          try {
            const res = await axios.post('/auth/login', {
              email: AUTO_EMAIL,
              password: AUTO_PASS,
            }, API_KEY_HEADER);
            const { token, refresh_token } = res.data || {};
            // Guardar token en electron o localStorage (fallback web)
            try { window.electronAPI?.setToken?.(token); } catch {}
            try { window.electronAPI?.setRefreshToken?.(refresh_token); } catch {}
            try { window.localStorage.setItem('_NA_ACCESS_TOK', token || 'ARKAIOS_LOCAL'); } catch {}
            dispatch(setAccessToken(token || 'ARKAIOS_LOCAL'));
            didSetToken = true;
            // Intentar cargar user_info si tenemos token
            if (token) {
              getUserInfo(token);
            }
          } catch (e) {
            // Si falla el login, seguimos en bypass puro
          }
        }
        if (!didSetToken) {
          const localTok = (function () {
            try { return window.localStorage.getItem('_NA_ACCESS_TOK') || 'ARKAIOS_LOCAL'; } catch { return 'ARKAIOS_LOCAL'; }
          })();
          dispatch(setAccessToken(localTok));
        }
        dispatch(setAppLoading(false));
      } else {
        const storedAccessToken = electronAPI?.getToken ? await electronAPI.getToken() : null;
        console.log(storedAccessToken);
        if (storedAccessToken !== undefined && storedAccessToken !== null) {
          dispatch(setAccessToken(storedAccessToken));
          getUserInfo(storedAccessToken);
        }
        dispatch(setAppLoading(false));
      }
    }
    asyncTask();
  }, []);

  const getUserInfo = (accessToken) => {
    dispatch(setAppLoading(true));
    axios.get('/auth/user_info', {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      }
    }).then((response) => {
      dispatch(setUser(response.data));
      dispatch(setAppLoading(false));
    }).catch((error) => {
      const status = error?.response?.status;
      if (status === constants.status.UNAUTHORIZED) {
        refreshToken();
      } else {
        // Errores de red: simplemente desactivar loading y continuar en modo invitado
        dispatch(setAppLoading(false));
      }
    });
  };

  useEffect(() => {
    // Usar stub seguro para entorno web
    const electronAPI = (typeof window !== 'undefined' && window.electronAPI) ? window.electronAPI : {
      getToken: async () => {
        try { return window.localStorage.getItem('_NA_ACCESS_TOK') || null; } catch { return null; }
      },
      onLogout: (cb) => { /* no-op in web */ },
    };
    if (electronAPI?.onLogout) {
      electronAPI.onLogout(async () => {
        const token = await electronAPI.getToken();
        logoutUser(token, dispatch);
      });
    }
  }, []);

  const cancelAllRunningTasks = async () => {
    const electronAPI = (typeof window !== 'undefined' && window.electronAPI) ? window.electronAPI : {
      getToken: async () => {
        try { return window.localStorage.getItem('_NA_ACCESS_TOK') || null; } catch { return null; }
      },
      stopAIAgent: () => {},
      cancelAllTasksDone: () => {},
    };
    const token = await electronAPI.getToken();
    if (token === null) {
      return;
    }
    dispatch(setLoadingDialog(true));
    try {
      await axios.post(`/threads/cancel_all_running_tasks`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      electronAPI.stopAIAgent();
    } catch (error) {
    } finally {
      dispatch(setLoadingDialog(false));
    }
  };

  useEffect(() => {
    const electronAPI = (typeof window !== 'undefined' && window.electronAPI) ? window.electronAPI : {
      onCancelAllTasksTrigger: (cb) => { /* no-op */ },
      cancelAllTasksDone: () => {},
    };
    if (electronAPI?.onCancelAllTasksTrigger) {
      electronAPI.onCancelAllTasksTrigger(async () => {
        await cancelAllRunningTasks();
        electronAPI.cancelAllTasksDone();
      });
    }
  }, []);

  return (
    <>
      {
        isFullLoading ? <FullLoading /> : <></>
      }
      {
        isLoadingDialog ? <LoadingDialog /> : <></>
      }
      {
        isAppLoading ? <FullLoading /> :
        <Router>
          <AppRoutes />
        </Router>
      }
    </>
  );
}


export default App;
