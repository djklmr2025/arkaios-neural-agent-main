import React, { useCallback, useState } from 'react';
import styled from 'styled-components';
import BackgroundModeFeed from './BackgroundModeFeed';
import { healthPing, createTask, sendTaskMessage } from '../utils/cosmosAdapter';

const PanelContainer = styled.div`
  width: 320px;
  min-width: 320px;
  max-width: 360px;
  border-left: thin solid rgba(255, 255, 255, 0.3);
  padding: 12px;
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Section = styled.div`
  border: thin solid rgba(255,255,255,0.3);
  border-radius: 12px;
  padding: 10px;
`;

const SectionTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #fff;
`;

const TaskList = styled.ol`
  margin: 0;
  padding-left: 18px;
  font-size: 13.5px;
`;

export default function RightPanel({ showLiveFeed = false, tasks = [] }) {
  const [health, setHealth] = useState(null);
  const [objective, setObjective] = useState('Probar flujo Plan/Generate desde RightPanel');
  const [planReply, setPlanReply] = useState(null);
  const [threadId, setThreadId] = useState('');
  const [message, setMessage] = useState('Ok, continúa.');
  const [attachments, setAttachments] = useState([]);
  const [busy, setBusy] = useState(false);

  const handlePing = useCallback(async () => {
    setBusy(true);
    try {
      const h = await healthPing();
      setHealth(h);
    } catch (e) {
      setHealth({ error: String(e) });
    } finally {
      setBusy(false);
    }
  }, []);

  const handlePlan = useCallback(async () => {
    setBusy(true);
    try {
      const plan = await createTask({ title: 'UI Plan', objective, attachments });
      setPlanReply(plan);
      const tid = plan?.threadId || plan?.data?.threadId || plan?.reply?.threadId;
      if (tid) setThreadId(tid);
    } catch (e) {
      setPlanReply({ error: String(e) });
    } finally {
      setBusy(false);
    }
  }, [objective, attachments]);

  const handleGenerate = useCallback(async () => {
    setBusy(true);
    try {
      const gen = await sendTaskMessage({ threadId, message, attachments });
      setPlanReply(gen);
    } catch (e) {
      setPlanReply({ error: String(e) });
    } finally {
      setBusy(false);
    }
  }, [threadId, message, attachments]);

  const handleFile = useCallback(async (evt) => {
    const file = evt?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // data:<mime>;base64,<data>
      try {
        const parts = String(result).split(',');
        const base64 = parts[1] || '';
        const meta = { mime: file.type || 'application/octet-stream', filename: file.name };
        setAttachments([{ content_base64: base64, meta }]);
      } catch (e) {
        console.warn('Base64 parse error', e);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  return (
    <PanelContainer>
      {showLiveFeed && (
        <Section>
          <SectionTitle>Live Agent View</SectionTitle>
          <BackgroundModeFeed />
        </Section>
      )}
      <Section>
        <SectionTitle>Tasks</SectionTitle>
        {Array.isArray(tasks) && tasks.length > 0 ? (
          <TaskList>
            {tasks.map((t, idx) => (
              <li key={`task-${idx}`}>{typeof t === 'string' ? t : JSON.stringify(t)}</li>
            ))}
          </TaskList>
        ) : (
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
            No tasks yet. Start a conversation to see planned steps here.
          </div>
        )}
      </Section>
      <Section>
        <SectionTitle>Cosmos Gateway Test</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handlePing} disabled={busy}>Ping</button>
            <button onClick={handlePlan} disabled={busy}>Plan</button>
            <button onClick={handleGenerate} disabled={busy || !threadId}>Generate</button>
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Objective</div>
            <input type="text" value={objective} onChange={e => setObjective(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Message</div>
            <input type="text" value={message} onChange={e => setMessage(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Attachment</div>
            <input type="file" onChange={handleFile} />
            {attachments?.length > 0 && (
              <div style={{ fontSize: 12, marginTop: 6 }}>Attached: {attachments[0]?.meta?.filename}</div>
            )}
          </div>
          <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
            <div>ThreadId: {threadId || '(none yet)'}</div>
            <div>Health: {health ? JSON.stringify(health) : '(not pinged)'}</div>
            <div>Reply: {planReply ? JSON.stringify(planReply) : '(no reply yet)'}</div>
          </div>
        </div>
      </Section>
    </PanelContainer>
  );
}
