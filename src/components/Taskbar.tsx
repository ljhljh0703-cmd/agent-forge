import React from 'react';
import { useWindowContext } from '../context/WindowContext';
import { DomainMode, DOMAIN_CONFIGS } from '../config/domain-mode';

const DOMAIN_ORDER: DomainMode[] = ['game', 'software', 'docs'];

const HOTKEY_MAP: Record<string, number> = {
  planner: 1, architect: 2, terminal: 3, canvas: 4, memo: 5,
  history: 6, 'message-flow': 7, experiment: 8, dashboard: 9,
};

export const Taskbar: React.FC = () => {
  const { windows, toggleWindowVisibility, domainMode, switchDomain, approvalMode, setApprovalMode } = useWindowContext();

  return (
    <div
      className="flex items-center px-4 gap-3"
      style={{
        width: '100%',
        height: '48px',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #DDDDDD',
        color: '#1D1C1D',
        fontSize: '13px',
      }}
    >
      {/* 도메인 스위처 */}
      <div className="flex gap-1 mr-3 pr-3" style={{ borderRight: '1px solid #DDDDDD' }}>
        {DOMAIN_ORDER.map(mode => {
          const cfg = DOMAIN_CONFIGS[mode];
          const active = domainMode === mode;
          return (
            <button
              key={mode}
              onClick={() => switchDomain(mode)}
              title={cfg.description}
              style={{
                padding: '4px 12px',
                backgroundColor: active ? '#1264A3' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: active ? 700 : 500,
                color: active ? '#FFFFFF' : '#616061',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = '#F0F0F0'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = active ? '#1264A3' : 'transparent'; }}
            >
              {cfg.icon} {cfg.label}
            </button>
          );
        })}
      </div>

      {/* 윈도우 슬롯 */}
      <div className="flex gap-1 flex-1 overflow-x-auto items-center" style={{ scrollbarWidth: 'none' }}>
        {windows.map(win => {
          const hotkey = HOTKEY_MAP[win.id];
          return (
            <button
              key={win.id}
              onClick={() => toggleWindowVisibility(win.id)}
              style={{
                position: 'relative',
                padding: '4px 12px',
                backgroundColor: win.isVisible ? '#E8F5FA' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: win.isVisible ? 600 : 400,
                color: win.isVisible ? '#1264A3' : '#616061',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!win.isVisible) e.currentTarget.style.backgroundColor = '#F0F0F0'; }}
              onMouseLeave={e => { if (!win.isVisible) e.currentTarget.style.backgroundColor = win.isVisible ? '#E8F5FA' : 'transparent'; }}
            >
              {hotkey && (
                <span style={{
                  position: 'absolute', top: '0px', left: '3px',
                  fontSize: '9px', color: '#ABABAD', fontWeight: 500,
                }}>
                  {hotkey}
                </span>
              )}
              {win.title}
            </button>
          );
        })}
      </div>

      {/* 승인 모드 토글 */}
      <div className="ml-3 pl-3 flex items-center" style={{ borderLeft: '1px solid #DDDDDD' }}>
        <button
          onClick={() => setApprovalMode(!approvalMode)}
          title={approvalMode ? '승인 모드 ON — GDD/SPEC 수정 후 승인 필요' : '승인 모드 OFF — 자동 진행'}
          style={{
            padding: '3px 10px',
            backgroundColor: approvalMode ? '#FEF3C7' : 'transparent',
            border: approvalMode ? '1px solid #F59E0B' : '1px solid #DDDDDD',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: approvalMode ? 600 : 400,
            color: approvalMode ? '#92400E' : '#616061',
            transition: 'all 0.15s',
          }}
        >
          {approvalMode ? '🛡️ Approval' : '⚡ Auto'}
        </button>
      </div>

      {/* 시계 */}
      <div className="ml-3 pl-3 flex items-center" style={{ borderLeft: '1px solid #DDDDDD' }}>
        <span style={{ fontSize: '13px', color: '#616061', fontWeight: 500 }}>
          {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};
