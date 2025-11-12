import React, { useState, useEffect, useRef } from 'react';
import { FlexSpacer } from '../components/Elements/SmallElements';
import { IconButton } from '../components/Elements/Button';
import { FaArrowAltCircleUp } from 'react-icons/fa';
import { useDispatch, useSelector } from 'react-redux';
import axios from '../utils/axios';
import cosmosAdapter from '../utils/cosmosAdapter';
import { setLoadingDialog, setError } from '../store';
import constants from '../utils/constants';
import { Text } from '../components/Elements/Typography';
import NATextArea from '../components/Elements/TextAreas';
import { useNavigate } from 'react-router-dom';
import { MdOutlineSchedule, MdImage } from 'react-icons/md';
import { GiBrain } from 'react-icons/gi';

import styled from 'styled-components';

const HomeDiv = styled.div`
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const Card = styled.div`
  border: thin solid rgba(255,255,255,0.3);
  border-radius: 20px;
  padding: 15px;
  width: 100%;
  max-width: 600px;
`;

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--secondary-color);
`;

const ModeToggle = styled.button.withConfig({
  shouldForwardProp: (prop) => prop !== 'active'
})`
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: ${({ active }) => (active ? 'rgba(255,255,255,0.1)' : 'transparent')};
  color: #fff;
  border: thin solid rgba(255,255,255,0.3);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  transition: background-color 0.2s ease;
  cursor: pointer;

  &:hover {
    background-color: rgba(255,255,255,0.1);
  }
`;


export default function Home() {
  const [messageText, setMessageText] = useState('');
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [healthStatus, setHealthStatus] = useState('');
  // Adjuntos (imagen en nueva tarea)
  const [attachedImage, setAttachedImage] = useState(null); // { name, dataUrl }
  const fileInputRef = useRef(null);

  const accessToken = useSelector(state => state.accessToken);

  const dispatch = useDispatch();

  const navigate = useNavigate();

  const cancelRunningTask = (tid) => {
    dispatch(setLoadingDialog(true));
    axios.post(`/threads/${tid}/cancel_task`, {}, {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      }
    }).then((response) => {
      dispatch(setLoadingDialog(false));
      window.electronAPI.stopAIAgent();
    }).catch((error) => {
      dispatch(setLoadingDialog(false));
      const status = error?.response?.status;
      if (status === constants.status.BAD_REQUEST) {
        dispatch(setError(true, constants.GENERAL_ERROR));
      } else {
        dispatch(setError(true, constants.GENERAL_ERROR));
      }
      setTimeout(() => {
        dispatch(setError(false, ''));
      }, 3000);
    });
  };

  const createThread = async () => {
    if (messageText.length === 0) {
      return;
    }
    // En modo BYPASS_LOGIN (offline/gateway caído), evitamos llamadas a la API
    // EXCEPTO cuando hay COSMOS_ACTIVE (backend online configurado)
    if (constants.BYPASS_LOGIN && !constants.COSMOS_ACTIVE) {
      // No activar spinner; sólo mostrar una nota breve
      dispatch(setError(true, 'Gateway/Proxy offline (modo BYPASS).'));
      setTimeout(() => {
        dispatch(setError(false, ''));
      }, 2000);
      return;
    }
    const data = {task: messageText, background_mode: backgroundMode, extended_thinking_mode: thinkingMode};
    setMessageText('');
    dispatch(setLoadingDialog(true));
    const sendRequest = async () => {
      if (constants.COSMOS_ACTIVE) {
        // Usar cosmos-den online
        const res = await cosmosAdapter.createTask(data);
        return { data: res };
      }
      // Usar backend local tradicional
      return await axios.post('/threads', data, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
    };
    sendRequest().then(async (response) => {
      dispatch(setLoadingDialog(false));
      if (response.data.type === 'desktop_task') {
        if (!backgroundMode && response.data.is_background_mode_requested) {
          let ready = true;
          try {
            if (window.electronAPI?.isBackgroundModeReady) {
              ready = await window.electronAPI.isBackgroundModeReady();
            }
          } catch {}
          if (!ready) {
            cancelRunningTask();
            return;
          }
        }
        setBackgroundMode(backgroundMode || response.data.is_background_mode_requested);
        setThinkingMode(thinkingMode || response.data.is_extended_thinking_mode_requested);
        try { window.electronAPI?.setLastThinkingModeValue?.((thinkingMode || response.data.is_extended_thinking_mode_requested).toString()); } catch {}
        try {
          if (window.electronAPI?.launchAIAgent) {
            window.electronAPI.launchAIAgent(
              process.env.REACT_APP_PROTOCOL + '://' + process.env.REACT_APP_DNS,
              response.data.thread_id,
              backgroundMode || response.data.is_background_mode_requested
            );
          }
        } catch {}
      }
      // Persistir adjunto para recuperarlo en la vista de Thread
      try {
        if (attachedImage) {
          window.sessionStorage.setItem(`attach::${response.data.thread_id}`,
            JSON.stringify(attachedImage));
          // limpiar en Home
          setAttachedImage(null);
        }
      } catch {}
      navigate('/threads/' + response.data.thread_id);
      // Evitar reloads en entorno web; la navegación es suficiente
    }).catch((error) => {
      dispatch(setLoadingDialog(false));
      const status = error?.response?.status;
      if (status === constants.status.BAD_REQUEST) {
        if (error?.response?.data?.message === 'Not_Browser_Task_BG_Mode') {
          dispatch(setError(true, 'Background Mode only supports browser tasks.'));
        } else {
          dispatch(setError(true, constants.GENERAL_ERROR));
        }
      } else {
        dispatch(setError(true, constants.GENERAL_ERROR));
      }
      setTimeout(() => {
        dispatch(setError(false, ''));
      }, 3000);
    });
  };

  const handleTextEnterKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      createThread();
    }
  };

  const runHealthCheck = async () => {
    setHealthStatus('');
    dispatch(setLoadingDialog(true));
    try {
      if (constants.COSMOS_ACTIVE) {
        const res = await cosmosAdapter.healthPing();
        setHealthStatus('Gateway OK: ' + (res.status || 'online'));
      } else {
        // Backend local: intentar /health si existe
        await axios.get('/health').catch(() => axios.get('/'));
        setHealthStatus('Backend local OK');
      }
    } catch (e) {
      setHealthStatus('Gateway/Backend no responde');
    } finally {
      dispatch(setLoadingDialog(false));
      setTimeout(() => setHealthStatus(''), 5000);
    }
  };

  const onBGModeToggleChange = async (value) => {
    // En entorno web (sin Electron), simplemente actualizar el estado
    if (!window.electronAPI?.isBackgroundModeReady) {
      setBackgroundMode(value);
      try { window.localStorage.setItem('backgroundMode', value ? 'true' : 'false'); } catch {}
      return;
    }
    if (value) {
      const ready = await window.electronAPI.isBackgroundModeReady();
      if (!ready) {
        // Si no está listo, iniciar el flujo de configuración en desktop
        try { window.electronAPI.startBackgroundSetup?.(); } catch {}
        return;
      }
    }
    setBackgroundMode(value);
    try {
      window.electronAPI.setLastBackgroundModeValue?.(value.toString());
    } catch {}
  };

  useEffect(() => {
    // Evitar bucles de recarga en web: si no hay electronAPI, no nos suscribimos
    if (window.electronAPI?.onAIAgentLaunch) {
      window.electronAPI.onAIAgentLaunch((threadId) => {
        navigate('/threads/' + threadId);
        // No recargar la página: navigate ya actualiza la vista
      });
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onAIAgentExit) {
      window.electronAPI.onAIAgentExit(() => {
        // Evitar recarga que puede crear bucles en web
        // Podemos forzar un estado si fuese necesario
      });
    }
  }, []);

  // Simplísimo UI: añadir el botón de Health Check en la tarjeta

  useEffect(() => {
    const asyncTask = async () => {
      const getLastBackgroundModeValue = async () => {
        if (window.electronAPI?.getLastBackgroundModeValue) {
          return await window.electronAPI.getLastBackgroundModeValue();
        }
        return window.localStorage.getItem('backgroundMode') ?? 'false';
      };
      const lastBackgroundModeValue = await getLastBackgroundModeValue();
      setBackgroundMode(lastBackgroundModeValue === 'true');
    };
    asyncTask();
  }, []);

  useEffect(() => {
    const asyncTask = async () => {
      const getLastThinkingModeValue = async () => {
        if (window.electronAPI?.getLastThinkingModeValue) {
          return await window.electronAPI.getLastThinkingModeValue();
        }
        return window.localStorage.getItem('thinkingMode') ?? 'false';
      };
      const lastThinkingModeValue = await getLastThinkingModeValue();
      setThinkingMode(lastThinkingModeValue === 'true');
    };
    asyncTask();
  }, []);

  return (
    <HomeDiv>
      <Text fontWeight='600' fontSize='23px' color='#fff'>
        Start a New Task
      </Text>
      <Card style={{marginTop: '15px'}}>
        <NATextArea
          background='transparent'
          isDarkMode
          padding='10px 4px'
          placeholder="What do you want NeuralAgent to do?"
          rows='3'
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={handleTextEnterKey}
          onPaste={(e) => {
            if (!e.clipboardData) return;
            const items = e.clipboardData.items || [];
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (item && item.type && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                if (blob) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    setAttachedImage({ name: `pasted_${Date.now()}.png`, dataUrl: reader.result });
                  };
                  reader.readAsDataURL(blob);
                  e.preventDefault();
                }
                break;
              }
            }
          }}
        />
        {/* Vista previa de imagen adjunta */}
        {attachedImage && (
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={attachedImage.dataUrl}
              alt={attachedImage.name}
              style={{ maxHeight: '80px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)' }}
            />
            <button
              onClick={() => setAttachedImage(null)}
              style={{
                background: 'transparent',
                border: 'thin solid rgba(255,255,255,0.3)',
                color: '#fff',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer'
              }}
            >
              Quitar adjunto
            </button>
          </div>
        )}
        <div style={{marginTop: '10px', display: 'flex', alignItems: 'center'}}>
          <ToggleContainer>
            <ModeToggle
              active={backgroundMode}
              onClick={() => onBGModeToggleChange(!backgroundMode)}
            >
              <MdOutlineSchedule style={{fontSize: '19px'}} />
              Background
            </ModeToggle>
          </ToggleContainer>
          <div style={{width: '10px'}} />
          <ToggleContainer>
            <ModeToggle
              active={thinkingMode}
              onClick={() => setThinkingMode(!thinkingMode)}
            >
              <GiBrain style={{fontSize: '19px'}} />
              Thinking
            </ModeToggle>
          </ToggleContainer>
          <div style={{width: '10px'}} />
          <ToggleContainer>
            <ModeToggle
              active={false}
              onClick={runHealthCheck}
            >
              Health Check
            </ModeToggle>
          </ToggleContainer>
          {/* Botón Adjuntar Imagen + input oculto */}
          <div style={{ width: '10px' }} />
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                setAttachedImage({ name: file.name, dataUrl: reader.result });
              };
              reader.readAsDataURL(file);
              try { e.target.value = ''; } catch {}
            }}
          />
          <IconButton
            iconSize='30px'
            color={'#fff'}
            onClick={() => fileInputRef.current?.click()}
            title='Adjuntar imagen'
          >
            <MdImage />
          </IconButton>
          <FlexSpacer isRTL={false} />
          <IconButton
            iconSize='35px'
            color='#fff'
            disabled={messageText.length === 0}
            onClick={() => createThread()}
            onKeyDown={handleTextEnterKey}>
            <FaArrowAltCircleUp />
          </IconButton>
        </div>
        {healthStatus && (
          <div style={{marginTop: '8px', color: '#9ae6b4', fontSize: '13px'}}>
            {healthStatus}
          </div>
        )}
      </Card>
    </HomeDiv>
  );
}
