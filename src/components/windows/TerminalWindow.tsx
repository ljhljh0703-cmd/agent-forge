import React from 'react';
import { useWindowContext } from '../../context/WindowContext';

export const TerminalWindow: React.FC = () => {
  const { logs, agents } = useWindowContext();

  const statusIcons: Record<string, string> = {
    idle: '⏸️',
    writing: '✍️',
    researching: '🔍',
    executing: '⚙️',
    error: '⚠️',
    syncing: '💾',
  };

  return (
    <div className="space-y-2 h-full flex flex-col">
      <div className="border border-win-dark bg-black p-1 flex-1 overflow-auto">
        <div className="font-mono text-xs text-green-300">
          {logs.map(log => (
            <div key={log.id} className="mb-1">
              <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              {' '}
              {log.message}
            </div>
          ))}
        </div>
      </div>

      <div className="border border-win-dark bg-win-white p-1">
        <label className="text-xs font-bold block mb-1">🤖 Agent Status</label>
        <div className="space-y-0.5">
          {agents.map(agent => (
            <div key={agent.agentId} className="text-xs flex justify-between items-center">
              <span className="font-mono">{agent.agentId}</span>
              <span>{statusIcons[agent.status]}</span>
              <span className="text-gray-600">{agent.status}</span>
              {agent.currentTask && <span className="text-gray-500 truncate ml-2">{agent.currentTask}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
