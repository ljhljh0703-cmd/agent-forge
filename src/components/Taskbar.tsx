import React from 'react';
import { useWindowContext } from '../context/WindowContext';
import { DomainMode, DOMAIN_CONFIGS } from '../config/domain-mode';

const DOMAIN_ORDER: DomainMode[] = ['game', 'software', 'docs'];

const HOTKEY_MAP: Record<string, number> = {
  planner: 1, architect: 2, terminal: 3, canvas: 4, memo: 5,
  history: 6, 'message-flow': 7, experiment: 8, dashboard: 9,
};

const Ico: React.FC<{ d: string | string[]; size?: number }> = ({ d, size = 13 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const DOMAIN_ICONS: Record<DomainMode, string[]> = {
  game:     ['M6 11H4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-2', 'M12 7V5', 'M8 11v2', 'M16 11v2', 'M10 12h4'],
  software: ['M16 18l6-6-6-6', 'M8 6l-6 6 6 6'],
  docs:     ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8'],
};

const WIN_ICONS: Record<string, string[]> = {
  planner:        ['M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2', 'M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2', 'M9 14l2 2 4-4'],
  architect:      ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  terminal:       ['M8 9l3 3-3 3', 'M13 15h3'],
  canvas:         ['M5 3l14 9-14 9V3z'],
  memo:           ['M12 20h9', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'],
  history:        ['M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z', 'M12 7v5l3 3'],
  'message-flow': ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  experiment:     ['M9 3h6l1 9H8z', 'M6.5 17h11', 'M5 21h14'],
  dashboard:      ['M18 20V10', 'M12 20V4', 'M6 20v-6'],
  comparison:     ['M9 3H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z', 'M19 3h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z', 'M9 13H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z'],
  'code-input':   ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M10 13l-2 2 2 2', 'M14 13l2 2-2 2'],
};

export const Taskbar: React.FC = () => {
  const { windows, toggleWindowVisibility, domainMode, switchDomain, approvalMode, setApprovalMode } = useWindowContext();

  return (
    <div
      className="flex items-center px-4 gap-3"
      style={{
        position: 'relative',
        zIndex: 50,
        width: '100%',
        height: '48px',
        backgroundColor: 'var(--surface)',
        borderTop: '1px solid var(--line)',
        color: 'var(--ink)',
        fontSize: '13px',
      }}
    >
      {/* 도메인 스위처 */}
      <div className="flex gap-1 mr-3 pr-3" style={{ borderRight: '1px solid var(--line)' }}>
        {DOMAIN_ORDER.map(mode => {
          const cfg = DOMAIN_CONFIGS[mode];
          const active = domainMode === mode;
          return (
            <button
              key={mode}
              onClick={() => switchDomain(mode)}
              title={cfg.description}
              style={{
                padding: '4px 10px',
                backgroundColor: active ? 'var(--brand-50)' : 'transparent',
                border: active ? '1px solid var(--brand)' : '1px solid transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--brand)' : 'var(--ink-soft)',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'var(--brand-50)';
                  e.currentTarget.style.color = 'var(--brand)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--ink-soft)';
                }
              }}
            >
              <Ico d={DOMAIN_ICONS[mode]} />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* 윈도우 슬롯 */}
      <div className="flex gap-1 flex-1 overflow-x-auto items-center" style={{ scrollbarWidth: 'none' }}>
        {windows.map(win => {
          const hotkey = HOTKEY_MAP[win.id];
          const iconPaths = WIN_ICONS[win.id];
          return (
            <button
              key={win.id}
              onClick={() => toggleWindowVisibility(win.id)}
              style={{
                position: 'relative',
                padding: '4px 10px',
                backgroundColor: win.isVisible ? 'var(--brand-50)' : 'transparent',
                border: win.isVisible ? '1px solid var(--brand)' : '1px solid transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: win.isVisible ? 600 : 400,
                color: win.isVisible ? 'var(--brand)' : 'var(--ink-soft)',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              onMouseEnter={e => {
                if (!win.isVisible) {
                  e.currentTarget.style.backgroundColor = 'var(--brand-50)';
                  e.currentTarget.style.color = 'var(--brand)';
                }
              }}
              onMouseLeave={e => {
                if (!win.isVisible) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--ink-soft)';
                }
              }}
            >
              {hotkey && (
                <span style={{
                  position: 'absolute', top: '0px', left: '3px',
                  fontSize: '9px', color: 'var(--ink-soft)', opacity: 0.5, fontWeight: 500,
                }}>
                  {hotkey}
                </span>
              )}
              {iconPaths && <Ico d={iconPaths} />}
              {win.title}
            </button>
          );
        })}
      </div>

      {/* 승인 모드 토글 */}
      <div className="ml-3 pl-3 flex items-center" style={{ borderLeft: '1px solid var(--line)' }}>
        <button
          onClick={() => setApprovalMode(!approvalMode)}
          title={approvalMode ? '승인 모드 ON — GDD/SPEC 수정 후 승인 필요' : '승인 모드 OFF — 자동 진행'}
          style={{
            padding: '3px 10px',
            backgroundColor: approvalMode ? 'oklch(96% 0.025 90)' : 'transparent',
            border: approvalMode ? '1px solid var(--warn)' : '1px solid var(--line)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: approvalMode ? 600 : 400,
            color: approvalMode ? 'oklch(50% 0.16 70)' : 'var(--ink-soft)',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {approvalMode ? '승인 모드' : '자동'}
        </button>
      </div>

      {/* 시계 */}
      <div className="ml-3 pl-3 flex items-center" style={{ borderLeft: '1px solid var(--line)' }}>
        <span className="mono" style={{ fontSize: '13px', color: 'var(--ink-soft)', fontWeight: 500 }}>
          {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};
