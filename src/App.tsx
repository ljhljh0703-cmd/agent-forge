import React, { useEffect } from 'react';
import { WindowContextProvider, useWindowContext } from './context/WindowContext';
import { DraggableWindow } from './components/DraggableWindow';
import { Taskbar } from './components/Taskbar';
import { PlannerWindow } from './components/windows/PlannerWindow';
import { TerminalWindow } from './components/windows/TerminalWindow';
import { LiveCanvasWindow } from './components/windows/LiveCanvasWindow';
import { ArchitectWindow } from './components/windows/ArchitectWindow';
import { MemoWindow } from './components/windows/MemoWindow';
import { HistoryWindow } from './components/windows/HistoryWindow';
import { MessageFlowWindow } from './components/windows/MessageFlowWindow';
import { ExperimentWindow } from './components/windows/ExperimentWindow';
import { DashboardWindow } from './components/windows/DashboardWindow';
import { ComparisonWindow } from './components/windows/ComparisonWindow';
import { CodeInputWindow } from './components/windows/CodeInputWindow';
import { AgentStatusPanel } from './components/AgentStatusPanel';
import { MainDashboard } from './components/MainDashboard';

const AppContent: React.FC = () => {
  const { addLog } = useWindowContext();

  useEffect(() => {
    addLog('Agent Forge OS 초기화 완료', 'info');
  }, [addLog]);

  return (
    <div className="w-full h-full flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: 대시보드 + 플로팅 창들 */}
        <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
          <MainDashboard />

          <DraggableWindow id="planner" title="PLANNER">
            <PlannerWindow />
          </DraggableWindow>
          <DraggableWindow id="architect" title="ARCHITECT">
            <ArchitectWindow />
          </DraggableWindow>
          <DraggableWindow id="terminal" title="TERMINAL">
            <TerminalWindow />
          </DraggableWindow>
          <DraggableWindow id="canvas" title="LIVE CANVAS">
            <LiveCanvasWindow />
          </DraggableWindow>
          <DraggableWindow id="memo" title="MEMO">
            <MemoWindow />
          </DraggableWindow>
          <DraggableWindow id="history" title="HISTORY">
            <HistoryWindow />
          </DraggableWindow>
          <DraggableWindow id="message-flow" title="MSG FLOW">
            <MessageFlowWindow />
          </DraggableWindow>
          <DraggableWindow id="experiment" title="EXPERIMENT">
            <ExperimentWindow />
          </DraggableWindow>
          <DraggableWindow id="dashboard" title="DASHBOARD">
            <DashboardWindow />
          </DraggableWindow>
          <DraggableWindow id="comparison" title="COMPARISON">
            <ComparisonWindow />
          </DraggableWindow>
          <DraggableWindow id="code-input" title="CODE INPUT">
            <CodeInputWindow />
          </DraggableWindow>
        </div>

        {/* 오른쪽: Live Studio */}
        <AgentStatusPanel />
      </div>

      {/* 하단: Taskbar (48px) */}
      <Taskbar />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <WindowContextProvider>
      <AppContent />
    </WindowContextProvider>
  );
};

export default App;
