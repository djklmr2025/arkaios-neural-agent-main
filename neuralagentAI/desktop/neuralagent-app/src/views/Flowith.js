import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Button } from '../components/Elements/Button';
import constants from '../utils/constants';

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  color: #fff;
`;
const Row = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
`;
const Input = styled.input`
  flex: 1;
  padding: 8px 10px;
  border-radius: 6px;
  border: thin solid rgba(255,255,255,0.3);
  background: transparent;
  color: #fff;
`;
const TextArea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: 8px 10px;
  border-radius: 6px;
  border: thin solid rgba(255,255,255,0.3);
  background: transparent;
  color: #fff;
`;
const Output = styled.pre`
  width: 100%;
  min-height: 180px;
  padding: 12px;
  border-radius: 10px;
  border: thin solid rgba(255,255,255,0.3);
  background: rgba(0,0,0,0.25);
  color: #cdf3cd;
  white-space: pre-wrap;
`;

export default function Flowith() {
  const [message, setMessage] = useState('hola estas vivo?');
  const [kbId, setKbId] = useState('fc765190-f898-4477-a5d9-c53df73dcb47');
  const [model, setModel] = useState('gpt-4.1-mini');
  const [streamText, setStreamText] = useState('');
  const [jsonText, setJsonText] = useState('');
  const currentReq = useRef(null);

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  useEffect(() => {
    if (!isElectron) return;
    const onStart = (rid) => { currentReq.current = rid; setStreamText(''); };
    const onEvt = (data) => {
      if (!currentReq.current || data.requestId !== currentReq.current) return;
      if (data.tag === 'final' || data.tag === 'chunk') {
        const s = typeof data.delta === 'string' ? data.delta : '';
        setStreamText(prev => prev + s);
      }
    };
    const onEnd = () => { /* no-op */ };
    const onError = (data) => {
      if (!currentReq.current || data.requestId !== currentReq.current) return;
      setStreamText(prev => prev + '\n[ERROR] ' + (data.error || 'Unknown'));
    };
    window.electronAPI.onFlowithStreamStart(onStart);
    window.electronAPI.onFlowithStreamEvent(onEvt);
    window.electronAPI.onFlowithStreamEnd(onEnd);
    window.electronAPI.onFlowithStreamError(onError);
    return () => {
      // no unsubscribe util; Electron IPC will drop on unmount
    };
  }, [isElectron]);

  const startStream = () => {
    if (!isElectron) {
      setStreamText('Electron no está activo en preview. Ejecuta el Desktop App para usar streaming seguro.');
      return;
    }
    window.electronAPI.flowithSeekStream({ message, kbList: [kbId], model });
  };

  const requestOnce = async () => {
    setJsonText('');
    if (!isElectron) {
      setJsonText('Electron no está activo en preview.');
      return;
    }
    const res = await window.electronAPI.flowithSeekOnce({ message, kbList: [kbId], model });
    if (res?.ok) setJsonText(JSON.stringify(res.result, null, 2));
    else setJsonText('ERROR: ' + (res?.error || 'Unknown'));
  };

  return (
    <Container>
      <h2 style={{marginTop:0}}>Flowith Console</h2>
      {constants.BYPASS_LOGIN && (
        <div style={{marginBottom:8, color:'rgba(255,255,255,0.8)'}}>
          Modo BYPASS activo: puedes probar la consola localmente, pero el streaming seguro requiere Electron.
        </div>
      )}
      <label>Prompt</label>
      <TextArea value={message} onChange={(e) => setMessage(e.target.value)} />
      <Row>
        <Input value={kbId} onChange={(e) => setKbId(e.target.value)} placeholder="KB ID" />
        <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Modelo (gpt-4.1-mini)" />
      </Row>
      <Row>
        <Button padding='8px 14px' color={'var(--primary-color)'} dark onClick={startStream}>Stream</Button>
        <Button padding='8px 14px' color={'var(--secondary-color)'} dark onClick={requestOnce}>JSON</Button>
      </Row>
      <div style={{display:'flex', gap:12}}>
        <div style={{flex:1}}>
          <div style={{marginBottom:6}}>Streaming</div>
          <Output>{streamText || '—'}</Output>
        </div>
        <div style={{flex:1}}>
          <div style={{marginBottom:6}}>JSON</div>
          <Output>{jsonText || '—'}</Output>
        </div>
      </div>
    </Container>
  );
}

