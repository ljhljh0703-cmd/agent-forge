import React, { useState, useEffect, useRef } from 'react';
import { Employee, EMPLOYEE_STATUSES } from '../config/employees';
import { AgentData } from '../context/WindowContext';
import { PixelSprite } from './PixelSprite';

interface EmployeeCardProps {
  employee: Employee;
  agent: AgentData;
  onClick?: () => void;
}

// 상태별 캐릭터 애니메이션
const getCharAnimClass = (status: string): string => {
  switch (status) {
    case 'writing':
    case 'executing':
      return 'animate-pixel-typing';
    case 'thinking':
    case 'researching':
      return 'animate-pixel-think';
    case 'error':
      return ''; // 에러시 빨간 글로우만
    default:
      return 'animate-pixel-float';
  }
};

// 상태별 모니터 화면 색
const getMonitorColor = (status: string): string => {
  switch (status) {
    case 'writing': return '#4ae84a';
    case 'executing': return '#4a8ae8';
    case 'researching': return '#e8c84a';
    case 'thinking': return '#c8a84e';
    case 'error': return '#e84040';
    case 'success': return '#4ae84a';
    default: return '#2a4a3a'; // idle — 어두운 초록
  }
};

/**
 * 이소메트릭 책상 유닛 — 에이전트가 책상에 앉아 일하는 모습
 *
 * 구조 (아래에서 위로):
 * [이름 라벨]
 * [책상 (상판 + 다리)]
 *   [모니터]  [키보드]  [소품]
 * [캐릭터 이모지] ← 책상 뒤에 앉아있음
 *   [상태 이모지] ← 머리 위
 * [말풍선] ← 가장 위
 */
export const EmployeeCard: React.FC<EmployeeCardProps> = ({
  employee,
  agent,
  onClick,
}) => {
  const [showBubble, setShowBubble] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const status = EMPLOYEE_STATUSES[agent.status as keyof typeof EMPLOYEE_STATUSES] || EMPLOYEE_STATUSES.idle;
  const isWorking = agent.status !== 'idle' && agent.status !== 'syncing';
  const isError = agent.status === 'error';
  const charAnim = getCharAnimClass(agent.status);
  const monitorColor = getMonitorColor(agent.status);

  // 외부 클릭 시 말풍선 닫기
  useEffect(() => {
    if (!showBubble) return;
    const handleOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowBubble(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showBubble]);

  const handleClick = () => {
    setShowBubble(prev => !prev);
    onClick?.();
  };

  const deskPositions: Record<string, { x: number; y: number; scale: number }> = {
    planner:   { x: 33, y: 57, scale: 1.2 },
    architect: { x: 50, y: 53, scale: 1.15 },
    compiler:  { x: 67, y: 57, scale: 1.2 },
    worker:    { x: 38, y: 73, scale: 1.4 },
    auditor:   { x: 60, y: 75, scale: 1.4 },
  };

  const pos = deskPositions[employee.id] ?? { x: 50, y: 50, scale: 1 };

  // 말풍선 표시 여부: 클릭으로 토글 or 작업 중일 때 자동
  const bubbleVisible = showBubble || !!agent.currentTask;
  const bubbleText = agent.currentTask
    ? `${status.icon} ${agent.currentTask.slice(0, 28)}`
    : `${status.icon} ${employee.description}`;

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      className="cursor-pointer"
      style={{
        position: 'absolute',
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: `translate(-50%, -50%) scale(${pos.scale})`,
        zIndex: showBubble ? 200 : Math.round(pos.y),
        transition: 'filter 0.3s',
      }}
    >
      {/* ─── 말풍선 ─── */}
      {bubbleVisible && (
        <div
          className="animate-speech-pop"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '6px',
            padding: '8px 12px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #DDDDDD',
            borderRadius: '10px',
            color: '#1D1C1D',
            fontSize: '11px',
            lineHeight: '16px',
            minWidth: '120px',
            maxWidth: '180px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            zIndex: 100,
          }}
        >
          {/* 이름 + 역할 */}
          <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px', color: '#1264A3' }}>
            {employee.name} · {employee.title}
          </div>
          {/* 내용 */}
          <div style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: '#616061',
          }}>
            {bubbleText}
          </div>
          {/* 말풍선 꼬리 */}
          <div style={{
            position: 'absolute', bottom: '-7px', left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
            borderTop: '7px solid #DDDDDD',
          }} />
          <div style={{
            position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
            borderTop: '6px solid #FFFFFF',
          }} />
        </div>
      )}

      {/* ─── 상태 이모지 (머리 위 바운스) ─── */}
      {isWorking && (
        <div
          className="animate-status-bounce"
          style={{
            position: 'absolute',
            top: agent.currentTask ? '-8px' : '-20px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '18px',
            zIndex: 99,
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
          }}
        >
          {status.icon}
        </div>
      )}

      {/* ─── 픽셀 아트 캐릭터 (책상 뒤에 앉아있음) ─── */}
      <div
        className={charAnim}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '-16px',
          zIndex: 2,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
        }}
      >
        <PixelSprite agentId={employee.id} pixelSize={5} />
      </div>

      {/* ─── 책상 (이소메트릭 느낌) ─── */}
      <div style={{ position: 'relative', zIndex: 3 }}>
        {/* 책상 상판 */}
        <div style={{
          width: '96px',
          height: '36px',
          backgroundColor: '#A08060',
          borderTop: '2px solid #B09070',
          borderRadius: '2px',
          position: 'relative',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        }}>
          {/* 모니터 */}
          <div style={{
            position: 'absolute',
            top: '-22px',
            left: '50%',
            transform: 'translateX(-50%)',
          }}>
            {/* 모니터 화면 */}
            <div style={{
              width: '28px',
              height: '20px',
              backgroundColor: '#1a1a1a',
              border: '2px solid #444',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div
                className={isWorking ? 'animate-monitor-flicker' : ''}
                style={{
                  position: 'absolute', inset: '2px',
                  backgroundColor: monitorColor,
                  opacity: isWorking ? 0.9 : 0.3,
                  transition: 'background-color 0.5s, opacity 0.5s',
                  borderRadius: '1px',
                }}
              />
            </div>
            {/* 모니터 받침 */}
            <div style={{
              width: '8px', height: '4px', margin: '0 auto',
              backgroundColor: '#555',
            }} />
            <div style={{
              width: '16px', height: '2px', margin: '0 auto',
              backgroundColor: '#666', borderRadius: '0 0 2px 2px',
            }} />
          </div>

          {/* 키보드 */}
          <div style={{
            position: 'absolute',
            bottom: '4px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '32px',
            height: '7px',
            backgroundColor: '#E8E8E8',
            border: '1px solid #CCC',
            borderRadius: '2px',
          }}>
            <div style={{
              display: 'flex', gap: '1px', padding: '1px', justifyContent: 'center',
            }}>
              {[0,1,2,3,4,5,6].map(i => (
                <div key={i} style={{ width: '3px', height: '2px', backgroundColor: '#AAA', borderRadius: '0.5px' }} />
              ))}
            </div>
          </div>

          {/* 책상 위 소품 */}
          <div style={{
            position: 'absolute',
            top: '2px',
            right: '5px',
            fontSize: '10px',
          }}>
            {employee.id === 'planner' ? '📋' :
             employee.id === 'architect' ? '📐' :
             employee.id === 'compiler' ? '⚙️' :
             employee.id === 'worker' ? '🔧' : '📊'}
          </div>
        </div>

        {/* 책상 앞면 */}
        <div style={{
          width: '96px',
          height: '8px',
          backgroundColor: '#8A6A48',
          borderRadius: '0 0 2px 2px',
        }} />

        {/* 책상 다리 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
          <div style={{ width: '5px', height: '14px', backgroundColor: '#7A5A38', borderRadius: '0 0 1px 1px' }} />
          <div style={{ width: '5px', height: '14px', backgroundColor: '#7A5A38', borderRadius: '0 0 1px 1px' }} />
        </div>
      </div>

      {/* ─── 바닥 그림자 (타원) ─── */}
      <div style={{
        width: '80px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: isError ? 'rgba(224,30,90,0.2)' : 'rgba(0,0,0,0.08)',
        margin: '-2px auto 0',
        filter: 'blur(3px)',
      }} />

      {/* ─── 이름 라벨 ─── */}
      <div
        style={{
          textAlign: 'center',
          marginTop: '6px',
          fontSize: '11px',
          fontWeight: 700,
          color: '#1D1C1D',
          textShadow: '0 1px 2px rgba(255,255,255,0.8)',
        }}
      >
        {employee.name}
      </div>

      {/* ─── 역할/상태 배지 ─── */}
      <div
        style={{
          textAlign: 'center',
          marginTop: '3px',
          padding: '2px 8px',
          fontSize: '9px',
          fontWeight: 600,
          color: isWorking ? '#FFFFFF' : '#616061',
          backgroundColor: isWorking
            ? (isError ? '#E01E5A' : '#1264A3')
            : '#F0F0F0',
          borderRadius: '10px',
          display: 'inline-block',
        }}
      >
        {status.label}
      </div>
    </div>
  );
};
