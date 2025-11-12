import React from 'react';
import styled from 'styled-components';
import BackgroundModeFeed from '../BackgroundModeFeed';

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
    </PanelContainer>
  );
}

