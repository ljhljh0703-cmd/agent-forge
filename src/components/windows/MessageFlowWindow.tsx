import React, { useState, useEffect, useCallback } from 'react';
import { getMetricsCollector, AgentMetric } from '../../services/metrics-collector';
import { formatTokens } from '../../services/cost-calculator';

interface FlowNode {
  id: string;
  label: string;
  initials: string;
  x: number;
  y: number;
}

interface FlowEdge {
  from: string;
  to: string;
  label: string;
  dataSize: string;
  isLoopback: boolean;
  count: number;
}

const NODES: FlowNode[] = [
  { id: 'planner',  label: 'Alex',   initials: 'AL', x: 110, y: 55  },
  { id: 'architect',label: 'Sam',    initials: 'SA', x: 110, y: 145 },
  { id: 'compiler', label: 'Jordan', initials: 'JO', x: 110, y: 235 },
  { id: 'worker',   label: 'Casey',  initials: 'CA', x: 110, y: 325 },
  { id: 'auditor',  label: 'Morgan', initials: 'MO', x: 110, y: 415 },
];

const CONTENT_TYPE_LABELS: Record<string, string> = {
  gdd: 'GDD',
  spec: 'SPEC',
  task: 'Tasks',
  code: 'Code',
  feedback: 'Feedback',
};

const SVG_W = 260;
const SVG_H = 490;
const NODE_R = 30;

function buildEdges(passes: AgentMetric[]): FlowEdge[] {
  const edgeMap: Record<string, FlowEdge> = {};
  for (const m of passes) {
    if (!m.messagePass) continue;
    const key = `${m.messagePass.from}->${m.messagePass.to}`;
    if (!edgeMap[key]) {
      edgeMap[key] = {
        from: m.messagePass.from,
        to: m.messagePass.to,
        label: CONTENT_TYPE_LABELS[m.messagePass.contentType] ?? m.messagePass.contentType,
        dataSize: formatTokens(m.messagePass.contentSize),
        isLoopback: m.messagePass.from === 'auditor' && m.messagePass.to === 'worker',
        count: 0,
      };
    }
    edgeMap[key].count++;
    edgeMap[key].dataSize = formatTokens(m.messagePass.contentSize);
    edgeMap[key].label = CONTENT_TYPE_LABELS[m.messagePass.contentType] ?? m.messagePass.contentType;
  }
  return Object.values(edgeMap);
}

function nodeById(id: string): FlowNode | undefined {
  return NODES.find(n => n.id === id);
}

interface ArrowProps {
  from: FlowNode;
  to: FlowNode;
  edge: FlowEdge;
}

const StraightArrow: React.FC<ArrowProps> = ({ from, to, edge }) => {
  const x1 = from.x, y1 = from.y + NODE_R;
  const x2 = to.x,   y2 = to.y - NODE_R;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const color = edge.isLoopback ? '#e53e3e' : '#8b6f47';
  return (
    <g>
      <defs>
        <marker id={`arrow-${edge.from}-${edge.to}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L9,3 z" fill={color} />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2"
        markerEnd={`url(#arrow-${edge.from}-${edge.to})`} />
      <text x={mx + 6} y={my} fontSize="9" fill={color} fontWeight="600">
        {edge.label}
      </text>
      <text x={mx + 6} y={my + 10} fontSize="8" fill="#5a3a1a">
        {edge.dataSize}{edge.count > 1 ? ` ×${edge.count}` : ''}
      </text>
    </g>
  );
};

const LoopbackArrow: React.FC<{ from: FlowNode; to: FlowNode; edge: FlowEdge }> = ({ from, to, edge }) => {
  // 오른쪽으로 곡선을 그려 feedback 표시
  const x1 = from.x + NODE_R, y1 = from.y;
  const x2 = to.x + NODE_R,   y2 = to.y;
  const cx = from.x + NODE_R + 55;
  const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  return (
    <g>
      <defs>
        <marker id="arrow-loop" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L9,3 z" fill="#e53e3e" />
        </marker>
      </defs>
      <path d={d} fill="none" stroke="#e53e3e" strokeWidth="2" strokeDasharray="4,2"
        markerEnd="url(#arrow-loop)" />
      <text x={cx + 4} y={(y1 + y2) / 2} fontSize="9" fill="#e53e3e" fontWeight="600">
        {edge.label}
      </text>
      <text x={cx + 4} y={(y1 + y2) / 2 + 10} fontSize="8" fill="#c53030">
        ×{edge.count}
      </text>
    </g>
  );
};

export const MessageFlowWindow: React.FC = () => {
  const [passes, setPasses] = useState<AgentMetric[]>(() =>
    getMetricsCollector().getAll().filter(m => m.type === 'message-pass'),
  );
  const [apiMetrics, setApiMetrics] = useState<AgentMetric[]>(() =>
    getMetricsCollector().getAll().filter(m => m.type === 'api-call'),
  );

  const refresh = useCallback(() => {
    const all = getMetricsCollector().getAll();
    setPasses(all.filter(m => m.type === 'message-pass'));
    setApiMetrics(all.filter(m => m.type === 'api-call'));
  }, []);

  useEffect(() => {
    const unsub = getMetricsCollector().subscribe('all', refresh);
    return unsub;
  }, [refresh]);

  const edges = buildEdges(passes);
  const totalData = passes.reduce((s, m) => s + (m.messagePass?.contentSize ?? 0), 0);

  return (
    <div className="flex flex-col h-full text-xs" style={{ minHeight: 0 }}>
      {/* SVG 그래프 */}
      <div className="flex-1 overflow-auto">
        <svg width={SVG_W} height={SVG_H} style={{ minWidth: SVG_W }}>
          {/* 엣지 렌더링 */}
          {edges.map(edge => {
            const from = nodeById(edge.from);
            const to = nodeById(edge.to);
            if (!from || !to) return null;
            if (edge.isLoopback) {
              return <LoopbackArrow key={`${edge.from}-${edge.to}`} from={from} to={to} edge={edge} />;
            }
            return <StraightArrow key={`${edge.from}-${edge.to}`} from={from} to={to} edge={edge} />;
          })}

          {/* 노드 렌더링 */}
          {NODES.map(node => {
            const isActive = apiMetrics.some(m => m.agentId === node.id);
            const hasPass = passes.some(m =>
              m.messagePass?.from === node.id || m.messagePass?.to === node.id,
            );
            return (
              <g key={node.id}>
                <circle
                  cx={node.x} cy={node.y} r={NODE_R}
                  fill={isActive ? '#fef3c7' : '#faf8f3'}
                  stroke={hasPass ? '#8b6f47' : '#c9a87c'}
                  strokeWidth={hasPass ? 2.5 : 1.5}
                />
                <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="11" fill="var(--brand)" fontWeight="700">
                  {node.initials}
                </text>
                <text x={node.x} y={node.y + 17} textAnchor="middle" fontSize="9" fill="#2d1810" fontWeight="600">
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 하단 통계 */}
      <div
        className="flex-shrink-0 px-3 py-2 border-t text-xs"
        style={{ borderColor: '#c9a87c', backgroundColor: '#faf4ec', color: '#5a3a1a' }}
      >
        <div className="flex justify-between">
          <span>메시지: {passes.length}건</span>
          <span>데이터: {formatTokens(totalData)}자</span>
          <span>API: {apiMetrics.length}건</span>
        </div>
        {passes.length === 0 && (
          <div className="text-center mt-1 text-amber-500">파이프라인을 실행하면 흐름이 표시됩니다</div>
        )}
      </div>
    </div>
  );
};
