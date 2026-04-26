import React, { useEffect, useState, useRef } from 'react';
import { WindowContextProvider, useWindowContext } from './context/WindowContext';
import { DraggableWindow } from './components/DraggableWindow';
import { OfficeSetting } from './components/OfficeSetting';
import { EmployeeCard } from './components/EmployeeCard';
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
import { getEmployees } from './config/employees';

const AppContent: React.FC = () => {
  const { addLog, agents, domainConfig } = useWindowContext();
  const employees = getEmployees(domainConfig.employeeOverrides);
  const pipelineRef = useRef<any>(null);

  useEffect(() => {
    addLog('⚙️ Agent Forge OS 초기화 중...', 'info');
    addLog('✓ 5명의 에이전트 팀 준비 완료', 'success');
  }, [addLog]);

  return (
    <div className="w-full h-full flex flex-col" style={{ backgroundColor: '#FFFFFF' }}>
      {/* 메인 콘텐츠 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: 오피스 뷰 */}
        <div className="flex-1 overflow-hidden" style={{ backgroundColor: '#F8F8F8' }}>
          <OfficeSetting>
            {Object.values(employees).map((employee) => {
              const agent = agents.find((a) => a.agentId === employee.id);
              if (!agent) return null;
              return (
                <EmployeeCard
                  key={employee.id}
                  employee={employee}
                  agent={agent}
                  onClick={() => { console.log(`${employee.name} 클릭`); }}
                />
              );
            })}
          </OfficeSetting>

          {/* 윈도우 패널들 */}
          <DraggableWindow id="planner" title="📜 PLANNER">
            <PlannerWindow />
          </DraggableWindow>
          <DraggableWindow id="architect" title="🏗️ ARCHITECT">
            <ArchitectWindow />
          </DraggableWindow>
          <DraggableWindow id="terminal" title="🖥️ TERMINAL">
            <TerminalWindow />
          </DraggableWindow>
          <DraggableWindow id="canvas" title="🎮 LIVE CANVAS">
            <LiveCanvasWindow />
          </DraggableWindow>
          <DraggableWindow id="memo" title="📝 MEMO">
            <MemoWindow />
          </DraggableWindow>
          <DraggableWindow id="history" title="📚 HISTORY">
            <HistoryWindow />
          </DraggableWindow>
          <DraggableWindow id="message-flow" title="🔀 MSG FLOW">
            <MessageFlowWindow />
          </DraggableWindow>
          <DraggableWindow id="experiment" title="🧪 EXPERIMENT">
            <ExperimentWindow />
          </DraggableWindow>
          <DraggableWindow id="dashboard" title="📊 DASHBOARD">
            <DashboardWindow />
          </DraggableWindow>
          <DraggableWindow id="comparison" title="⚖️ COMPARISON">
            <ComparisonWindow />
          </DraggableWindow>
          <DraggableWindow id="code-input" title="📂 CODE INPUT">
            <CodeInputWindow />
          </DraggableWindow>
        </div>

        {/* 오른쪽: Agent Status Panel */}
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
