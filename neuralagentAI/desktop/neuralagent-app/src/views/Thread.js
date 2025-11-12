import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import axios from '../utils/axios';
import cosmosAdapter from '../utils/cosmosAdapter';
import constants from '../utils/constants';
import { setLoadingDialog, setError } from '../store';
import ChatMessage from '../components/ChatMessage';
import { FlexSpacer } from '../components/Elements/SmallElements';
import NATextArea from '../components/Elements/TextAreas';
import { IconButton, Button } from '../components/Elements/Button';
import { MdEdit, MdDelete, MdImage } from 'react-icons/md';
import { FaArrowAltCircleUp, FaStopCircle } from 'react-icons/fa';
import ClipLoader from 'react-spinners/ClipLoader';
import { Text } from '../components/Elements/Typography';
import ThreadDialog from '../components/DataDialogs/ThreadDialog';
import YesNoDialog from '../components/Elements/YesNoDialog';
import { useNavigate } from 'react-router-dom';
import { MdOutlineSchedule } from 'react-icons/md';
import { GiBrain } from 'react-icons/gi';

import styled from 'styled-components';
import RightPanel from '../components/RightPanel';

const ThreadDiv = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const TwoColumn = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
`;

const ChatContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding-top: 12px;
  padding-bottom: 12px;
`;

const SendingContainer = styled.div`
  border: thin solid rgba(255,255,255,0.3);
  padding: 10px;
  border-radius: 20px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  padding: 20px;
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

export default function Thread() {
  
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setSendingMessage] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  // Adjuntos (imagen)
  const [attachedImage, setAttachedImage] = useState(null); // { name, dataUrl }
  const fileInputRef = useRef(null);

  const [isThreadDialogOpen, setThreadDialogOpen] = useState(false);
  const [isDeleteThreadDialogOpen, setDeleteThreadDialogOpen] = useState(false);

  const accessToken = useSelector(state => state.accessToken);

  const { tid } = useParams();

  const bottomRef = useRef(null);

  const navigate = useNavigate();

  const dispatch = useDispatch();

  // Cargar adjunto persistido desde Home (si el usuario creó el hilo con una imagen adjunta)
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(`attach::${tid}`);
      if (raw) {
        const att = JSON.parse(raw);
        if (att && att.dataUrl) {
          setAttachedImage(att);
        }
        window.sessionStorage.removeItem(`attach::${tid}`);
      }
    } catch {}
  }, [tid]);

  const derivedTasks = React.useMemo(() => {
    const lastAssistant = [...messages].reverse().find(m => m.thread_chat_from === 'from_ai');
    if (!lastAssistant) return [];
    try {
      const parsed = JSON.parse(lastAssistant.text);
      if (parsed?.subtasks && Array.isArray(parsed.subtasks)) {
        return parsed.subtasks.map(s => s.subtask || JSON.stringify(s));
      }
      if (parsed?.actions && Array.isArray(parsed.actions)) {
        return parsed.actions.map(a => a.action || JSON.stringify(a));
      }
      if (parsed?.action) {
        return [parsed.action];
      }
    } catch {}
    return [];
  }, [messages]);

  const getThread = () => {
    // Guard: avoid hitting API if tid is undefined
    if (!tid) {
      return;
    }
    dispatch(setLoadingDialog(true));
    axios.get(`/threads/${tid}`, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    }).then(response => {
      setThread(response.data);
      dispatch(setLoadingDialog(false));
    }).catch(error => {
      dispatch(setLoadingDialog(false));
      if (error.response?.status === constants.status.UNAUTHORIZED) {
        window.location.reload();
      }
    });
  };

  const getThreadMessages = () => {
    // Guard: avoid hitting API if tid is undefined
    if (!tid) {
      return;
    }
    dispatch(setLoadingDialog(true));
    axios.get(`/threads/${tid}/thread_messages`, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    }).then(response => {
      setMessages(response.data);
      dispatch(setLoadingDialog(false));
    }).catch(error => {
      dispatch(setLoadingDialog(false));
      if (error.response?.status === constants.status.UNAUTHORIZED) {
        window.location.reload();
      }
    });
  };

  const sendMessage = () => {
    // Guard: evitar envíos si no hay threadId (tid)
    if (!tid) {
      dispatch(setError(true, 'Debes crear o seleccionar un hilo antes de enviar. Ve a Home y pulsa "New Task" para crear uno.'));
      setTimeout(() => { dispatch(setError(false, '')); }, 3500);
      return;
    }
    if (messageText.length === 0 || isSendingMessage || thread.status === 'working') {
      return;
    }

    const data = {text: messageText.trim(), background_mode: backgroundMode, extended_thinking_mode: thinkingMode};
    setMessageText('');
    setSendingMessage(true);
    dispatch(setLoadingDialog(true));
    const sendRequest = async () => {
      if (constants.COSMOS_ACTIVE) {
        const res = await cosmosAdapter.sendTaskMessage({
          threadId: tid,
          text: data.text,
          background_mode: backgroundMode,
          extended_thinking_mode: thinkingMode,
          attachments: attachedImage ? [{ type: 'image', name: attachedImage.name, dataUrl: attachedImage.dataUrl }] : [],
        });
        return { data: res };
      }
      return await axios.post(`/threads/${tid}/send_message`, data, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
    };
    sendRequest().then(async (response) => {
      dispatch(setLoadingDialog(false));
      setSendingMessage(false);
      // limpiar adjunto después de enviar
      setAttachedImage(null);
      if (response.data.type === 'desktop_task') {
        // En entorno web (sin Electron) evitar llamadas a electronAPI
        if (!window.electronAPI?.isBackgroundModeReady) {
          setBackgroundMode(backgroundMode || response.data.is_background_mode_requested);
          setThinkingMode(thinkingMode || response.data.is_extended_thinking_mode_requested);
          try {
            window.localStorage.setItem('thinkingMode', (thinkingMode || response.data.is_extended_thinking_mode_requested).toString());
            window.localStorage.setItem('backgroundMode', (backgroundMode || response.data.is_background_mode_requested).toString());
          } catch {}
        } else {
          if (!backgroundMode && response.data.is_background_mode_requested) {
            const ready = await window.electronAPI.isBackgroundModeReady();
            if (!ready) {
              cancelRunningTask();
              return;
            }
          }
          setBackgroundMode(backgroundMode || response.data.is_background_mode_requested);
          setThinkingMode(thinkingMode || response.data.is_extended_thinking_mode_requested);
          try { window.electronAPI.setLastThinkingModeValue?.((thinkingMode || response.data.is_extended_thinking_mode_requested).toString()); } catch {}
          try {
            window.electronAPI.launchAIAgent(
              process.env.REACT_APP_PROTOCOL + '://' + process.env.REACT_APP_DNS,
              tid,
              backgroundMode || response.data.is_background_mode_requested
            );
          } catch {}
        }
      }
      // Cuando usamos cosmos online, actualizamos el chat localmente
      if (constants.COSMOS_ACTIVE) {
        const userMsg = {
          thread_chat_from: 'from_user',
          thread_chat_type: 'normal_message',
          text: data.text,
          attachments: attachedImage ? [{ type: 'image', name: attachedImage.name, dataUrl: attachedImage.dataUrl }] : undefined,
        };
        // Intentar extraer texto de la respuesta del gateway
        const res = response.data || {};
        const assistantText =
          res.response || res.output || res.message || res.text ||
          (typeof res === 'string' ? res : JSON.stringify(res));
        const aiMsg = {
          thread_chat_from: 'from_ai',
          thread_chat_type: 'normal_message',
          text: assistantText,
        };
        setMessages(prev => [...prev, userMsg, aiMsg]);
        try { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); } catch {}
      } else {
        // Backend local: refrescar desde API
        getThread();
        getThreadMessages();
      }
    }).catch((error) => {
      dispatch(setLoadingDialog(false));
      setSendingMessage(false);
      const status = error?.response?.status;
      if (status === constants.status.BAD_REQUEST) {
        if (error?.response?.data?.message === 'Not_Browser_Task_BG_Mode') {
          dispatch(setError(true, 'Background Mode only supports browser tasks.'));
        } else {
          dispatch(setError(true, 'Something Wrong Happened, Please try again.'));
        }
      } else {
        dispatch(setError(true, constants.GENERAL_ERROR));
        // Si estamos en modo COSMOS y el gateway no responde/404, imprimir un mensaje local para que el chat "responda"
        if (constants.COSMOS_ACTIVE) {
          const userMsg = {
            thread_chat_from: 'from_user',
            thread_chat_type: 'normal_message',
            text: data.text,
            attachments: attachedImage ? [{ type: 'image', name: attachedImage.name, dataUrl: attachedImage.dataUrl }] : undefined,
          };
          const code = (status ?? error?.response?.status ?? -1);
          const reason = (error?.response?.error || error?.message || 'timeout/404');
          const aiMsg = {
            thread_chat_from: 'from_ai',
            thread_chat_type: 'normal_message',
            text: `No se pudo obtener respuesta del Gateway (código ${code}).\nMotivo: ${reason}.\n\nEl host está vivo (usa Health Check), pero no expone endpoints de chat. Configura REACT_APP_COSMOS_BASE apuntando a un servicio con /api/chat o usa el backend local (BYPASS_LOGIN=false, COSMOS_ACTIVE=false).`,
          };
          setMessages(prev => [...prev, userMsg, aiMsg]);
          try { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); } catch {}
        }
      }
      setTimeout(() => {
        dispatch(setError(false, ''));
      }, 3000);
    });
  };

  // Crear hilo directamente desde la vista Thread cuando el id es undefined
  const createThreadHere = async () => {
    if (messageText.length === 0) {
      return;
    }
    if (constants.BYPASS_LOGIN && !constants.COSMOS_ACTIVE) {
      dispatch(setError(true, 'Gateway/Proxy offline (modo BYPASS).'));
      setTimeout(() => { dispatch(setError(false, '')); }, 2000);
      return;
    }

    const data = { task: messageText.trim(), background_mode: backgroundMode, extended_thinking_mode: thinkingMode };
    setMessageText('');
    setSendingMessage(true);
    dispatch(setLoadingDialog(true));

    const sendRequest = async () => {
      if (constants.COSMOS_ACTIVE) {
        const res = await cosmosAdapter.createTask({
          task: data.task,
          background_mode: backgroundMode,
          extended_thinking_mode: thinkingMode,
          attachments: attachedImage ? [{ type: 'image', name: attachedImage.name, dataUrl: attachedImage.dataUrl }] : [],
        });
        return { data: res };
      }
      return await axios.post('/threads', data, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
    };

    sendRequest().then(async (response) => {
      dispatch(setLoadingDialog(false));
      setSendingMessage(false);
      try { if (attachedImage) setAttachedImage(null); } catch {}

      if (response.data.type === 'desktop_task') {
        if (!window.electronAPI?.isBackgroundModeReady) {
          setBackgroundMode(backgroundMode || response.data.is_background_mode_requested);
          setThinkingMode(thinkingMode || response.data.is_extended_thinking_mode_requested);
          try {
            window.localStorage.setItem('thinkingMode', (thinkingMode || response.data.is_extended_thinking_mode_requested).toString());
            window.localStorage.setItem('backgroundMode', (backgroundMode || response.data.is_background_mode_requested).toString());
          } catch {}
        } else {
          if (!backgroundMode && response.data.is_background_mode_requested) {
            let ready = true;
            try { ready = await window.electronAPI.isBackgroundModeReady(); } catch {}
            if (!ready) {
              try {
                await axios.post(`/threads/${response.data.thread_id}/cancel_task`, {}, {
                  headers: { 'Authorization': 'Bearer ' + accessToken }
                });
              } catch {}
              dispatch(setError(true, 'Background Mode no está listo.'));
              setTimeout(() => { dispatch(setError(false, '')); }, 2500);
            }
          }
          setBackgroundMode(backgroundMode || response.data.is_background_mode_requested);
          setThinkingMode(thinkingMode || response.data.is_extended_thinking_mode_requested);
          try { window.electronAPI.setLastThinkingModeValue?.((thinkingMode || response.data.is_extended_thinking_mode_requested).toString()); } catch {}
          try {
            window.electronAPI.launchAIAgent(
              process.env.REACT_APP_PROTOCOL + '://' + process.env.REACT_APP_DNS,
              response.data.thread_id,
              backgroundMode || response.data.is_background_mode_requested
            );
          } catch {}
        }
      }

      try { navigate('/threads/' + response.data.thread_id); } catch {}
    }).catch((error) => {
      dispatch(setLoadingDialog(false));
      setSendingMessage(false);
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
      setTimeout(() => { dispatch(setError(false, '')); }, 3000);
    });
  };

  const deleteThread = () => {
    dispatch(setLoadingDialog(true));
    axios.delete('/threads/' + tid, {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      }
    }).then((response) => {
      dispatch(setLoadingDialog(false));
      navigate('/');
      // Evitar reload en web preview
    }).catch((error) => {
      dispatch(setLoadingDialog(false));
      const status = error?.response?.status;
      if (status === constants.status.UNAUTHORIZED) {
        // En lugar de recargar, navegar a login si aplica
        try { navigate('/login'); } catch {}
      } else {
        dispatch(setError(true, constants.GENERAL_ERROR));
        setTimeout(() => {
          dispatch(setError(false, ''));
        }, 3000);
      }
    });
  }

  const cancelRunningTask = () => {
    if (thread.status !== 'working') {
      return;
    }

    dispatch(setLoadingDialog(true));
    axios.post(`/threads/${tid}/cancel_task`, {}, {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      }
    }).then((response) => {
      dispatch(setLoadingDialog(false));
      try { window.electronAPI?.stopAIAgent?.(); } catch {}
      // TODO Remove
      getThreadMessages();
      getThread();
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

  const handleTextEnterKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const onBGModeToggleChange = async (value) => {
    // Si no hay Electron (web preview), solamente persistimos el estado
    if (!window.electronAPI?.isBackgroundModeReady) {
      setBackgroundMode(value);
      try { window.localStorage.setItem('backgroundMode', value ? 'true' : 'false'); } catch {}
      return;
    }
    if (value) {
      const ready = await window.electronAPI.isBackgroundModeReady();
      if (!ready) {
        try { window.electronAPI.startBackgroundSetup?.(); } catch {}
        return;
      }
    }
    setBackgroundMode(value);
    try { window.electronAPI.setLastBackgroundModeValue?.(value.toString()); } catch {}
  };

  useEffect(() => {
    if (tid) {
      getThread();
      getThreadMessages();
    }
  }, [tid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (window.electronAPI?.onAIAgentLaunch) {
      window.electronAPI.onAIAgentLaunch(() => {
        // Evitar recarga que puede provocar bucles en web
      });
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onAIAgentExit) {
      window.electronAPI.onAIAgentExit(() => {
        getThread();
        getThreadMessages();
      });
    }
  }, []);

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

  // Si no hay tid, mostrar formulario para crear hilo
  if (!tid) {
    return (
      <TwoColumn>
        <ThreadDiv>
          <Header>
            <Text fontSize='20px' fontWeight='600' color={'#fff'}>
              New Task
            </Text>
            <FlexSpacer />
          </Header>
          {/* Callout superior con CTA y estado del Gateway */}
          <div style={{ padding: '0 15px' }}>
            <div style={{
              border: 'thin solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <Text fontSize='14px' color={'#fff'}>
                You currently have no threads
              </Text>
              <Text fontSize='12px' color={'var(--secondary-color)'}>
                Gateway: {constants.COSMOS_ACTIVE ? 'Activo' : 'Inactivo'}
              </Text>
              <FlexSpacer />
              <Button padding='6px 12px' color={'var(--primary-color)'} borderRadius={6} fontSize='14px' dark
                onClick={() => navigate('/')}
                title='Ir a Home'>
                Ir a Home
              </Button>
              <Button padding='6px 12px' color={'var(--primary-color)'} borderRadius={6} fontSize='14px' dark
                onClick={() => createThreadHere()}
                title='Crear hilo'>
                Crear hilo
              </Button>
            </div>
          </div>
          <div style={{ padding: '15px' }}>
            <SendingContainer>
              <Text fontSize='14px' color={'rgba(255,255,255,0.7)'} style={{ marginBottom: '8px', display: 'block' }}>
                No has seleccionado ningún hilo. Escribe tu tarea y pulsa “Crear hilo”.
              </Text>
              <NATextArea
                background='transparent'
                placeholder={'What do you want NeuralAgent to do?'}
                value={messageText}
                isDarkMode
                rows='3'
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); createThreadHere(); } }}
                onChange={(e) => setMessageText(e.target.value)}
                onPaste={(e) => {
                  if (!e.clipboardData) return;
                  const items = e.clipboardData.items || [];
                  for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item && item.type && item.type.startsWith('image/')) {
                      const blob = item.getAsFile();
                      if (blob) {
                        const reader = new FileReader();
                        reader.onload = () => { setAttachedImage({ name: `pasted_${Date.now()}.png`, dataUrl: reader.result }); };
                        reader.readAsDataURL(blob);
                        e.preventDefault();
                      }
                      break;
                    }
                  }
                }}
              />
              {attachedImage && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={attachedImage.dataUrl} alt={attachedImage.name} style={{ maxHeight: '80px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)' }} />
                  <button
                    onClick={() => setAttachedImage(null)}
                    style={{ background: 'transparent', border: 'thin solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                  >
                    Quitar adjunto
                  </button>
                </div>
              )}
              <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center' }}>
                <ToggleContainer>
                  <ModeToggle active={backgroundMode} onClick={() => onBGModeToggleChange(!backgroundMode)}>
                    <MdOutlineSchedule style={{fontSize: '19px'}} />
                    Background
                  </ModeToggle>
                </ToggleContainer>
                <div style={{width: '10px'}} />
                <ToggleContainer>
                  <ModeToggle active={thinkingMode} onClick={() => setThinkingMode(!thinkingMode)}>
                    <GiBrain style={{fontSize: '19px'}} />
                    Thinking
                  </ModeToggle>
                </ToggleContainer>
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
                    reader.onload = () => { setAttachedImage({ name: file.name, dataUrl: reader.result }); };
                    reader.readAsDataURL(file);
                    try { e.target.value = ''; } catch {}
                  }}
                />
                <IconButton iconSize='30px' color={'#fff'} onClick={() => fileInputRef.current?.click()} title='Adjuntar imagen'>
                  <MdImage />
                </IconButton>
                <FlexSpacer />
                {isSendingMessage ? (
                  <ClipLoader color={'#fff'} size={40} />
                ) : (
                  <IconButton iconSize='35px' color={'#fff'} disabled={messageText.length === 0} onClick={() => createThreadHere()}>
                    <FaArrowAltCircleUp />
                  </IconButton>
                )}
              </div>
            </SendingContainer>
          </div>
        </ThreadDiv>
        <RightPanel showLiveFeed tasks={[]} />
      </TwoColumn>
    );
  }

  return thread !== null ? (
    <>
      <ThreadDialog
        isOpen={isThreadDialogOpen}
        setOpen={setThreadDialogOpen}
        threadObj={Object.assign({}, thread)}
        onSuccess={() => window.location.reload()}
      />
      <YesNoDialog
        isOpen={isDeleteThreadDialogOpen}
        setOpen={setDeleteThreadDialogOpen}
        title='Delete Thread'
        text='Are you sure that you want to delete this thread?'
        onYesClicked={deleteThread}
        isDarkMode={true}
      />
      <TwoColumn>
        <ThreadDiv>
        <Header>
          <Text fontSize='20px' fontWeight='600' color={'#fff'}>
            {thread.title}
          </Text>
          <FlexSpacer />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <IconButton iconSize='27px' color='#fff' style={{ margin: '0 5px' }} dark
              onClick={() => setThreadDialogOpen(true)}>
              <MdEdit />
            </IconButton>
            <IconButton iconSize='27px' color='#fff' style={{ margin: '0 5px' }} dark
              onClick={() => setDeleteThreadDialogOpen(true)}>
              <MdDelete />
            </IconButton>
          </div>
        </Header>
        <ChatContainer>
          {messages.map((msg) => (
            <ChatMessage key={'thread_message__' + msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </ChatContainer>
        <div style={{ padding: '15px' }}>
          <SendingContainer>
            <NATextArea
              background='transparent'
              placeholder={'What do you want NeuralAgent to do?'}
              value={messageText}
              isDarkMode
              rows='2'
              onKeyDown={handleTextEnterKey}
              onChange={(e) => setMessageText(e.target.value)}
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
                      // evitamos que el navegador pegue la imagen como texto
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
            <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center' }}>
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
                  // limpiar selección para permitir re-seleccionar el mismo archivo
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
              <FlexSpacer />
              {isSendingMessage ? (
                <ClipLoader color={'#fff'} size={40} />
              ) : (
                thread.status === 'working' ? (
                  <IconButton
                    iconSize='35px'
                    color={'#fff'}
                    onClick={() => cancelRunningTask()}>
                    <FaStopCircle />
                  </IconButton>
                ) : (
                  <IconButton
                    iconSize='35px'
                    color={'#fff'}
                    disabled={messageText.length === 0}
                    onClick={() => sendMessage()}>
                    <FaArrowAltCircleUp />
                  </IconButton>
                )
              )}
            </div>
          </SendingContainer>
        </div>
        </ThreadDiv>
        <RightPanel showLiveFeed tasks={derivedTasks} />
      </TwoColumn>
    </>
  ) : <></>;
}
