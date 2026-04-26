import React, { useState, useRef } from 'react';
import { useWindowContext } from '../context/WindowContext';

interface DraggableWindowProps {
  id: string;
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
}

export const DraggableWindow: React.FC<DraggableWindowProps> = ({
  id,
  title,
  children,
  onClose,
}) => {
  const positionMap: { [key: string]: { x: number; y: number } } = {
    planner: { x: 50, y: 20 },
    terminal: { x: 400, y: 20 },
    canvas: { x: 50, y: 340 },
    memo: { x: 400, y: 340 },
    history: { x: 150, y: 100 },
  };

  const sizeMap: Record<string, { w: number; h: number }> = {
    planner:        { w: 640, h: 560 },
    architect:      { w: 640, h: 560 },
    terminal:       { w: 640, h: 540 },
    canvas:         { w: 660, h: 600 },
    memo:           { w: 580, h: 640 },
    history:        { w: 620, h: 520 },
    'message-flow': { w: 640, h: 540 },
    experiment:     { w: 660, h: 580 },
    dashboard:      { w: 640, h: 600 },
    comparison:     { w: 620, h: 560 },
    'code-input':   { w: 620, h: 540 },
  };
  const size = sizeMap[id] ?? { w: 640, h: 560 };

  const [position, setPosition] = useState(positionMap[id] || { x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const { windows, focusWindow, minimizeWindow, toggleWindowVisibility } = useWindowContext();

  const windowState = windows.find(w => w.id === id);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.win-btn')) return;
    focusWindow(id);
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const W = windowRef.current?.offsetWidth ?? 0;
    const H = windowRef.current?.offsetHeight ?? 0;
    const maxX = window.innerWidth - W;
    const maxY = window.innerHeight - 48 - H;
    setPosition({
      x: Math.max(0, Math.min(e.clientX - dragOffset.x, maxX)),
      y: Math.max(0, Math.min(e.clientY - dragOffset.y, maxY)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  if (!windowState?.isVisible) {
    return null;
  }

  return (
    <div
      ref={windowRef}
      className="absolute flex flex-col"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.w}px`,
        height: `${size.h}px`,
        zIndex: windowState?.zIndex || 10,
        backgroundColor: '#FFFFFF',
        borderRadius: '8px',
        border: '1px solid #DDDDDD',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}
      onMouseDown={() => focusWindow(id)}
    >
      {/* 타이틀바 */}
      <div
        className="cursor-move select-none"
        onMouseDown={handleMouseDown}
        style={{
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#F8F8F8',
          borderBottom: '1px solid #EEEEEE',
          fontSize: '14px',
          fontWeight: 700,
          color: '#1D1C1D',
        }}
      >
        <span>{title}</span>
        <div className="flex gap-2">
          <button
            className="win-btn"
            onClick={() => minimizeWindow(id)}
            title="Minimize"
            style={{
              width: '28px', height: '28px',
              background: 'none', border: '1px solid #DDDDDD',
              borderRadius: '6px',
              cursor: 'pointer', fontSize: '14px', color: '#616061',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#EEEEEE'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            −
          </button>
          <button
            className="win-btn"
            onClick={() => toggleWindowVisibility(id)}
            title="Close"
            style={{
              width: '28px', height: '28px',
              background: 'none', border: '1px solid #DDDDDD',
              borderRadius: '6px',
              cursor: 'pointer', fontSize: '14px', color: '#616061',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#FFEBEE'; e.currentTarget.style.color = '#E01E5A'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#616061'; }}
          >
            ×
          </button>
        </div>
      </div>
      {/* 콘텐츠 */}
      <div
        className="flex-1 overflow-auto p-4 text-sm"
        style={{
          color: '#1D1C1D',
          backgroundColor: '#FFFFFF',
        }}
      >
        {children}
      </div>
    </div>
  );
};
