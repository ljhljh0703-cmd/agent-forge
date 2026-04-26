import React from 'react';

interface OfficeSettingProps {
  children?: React.ReactNode;
}

/**
 * Slack-style 밝은 배경 위의 이소메트릭 오피스 룸
 * 밝은 톤 벽 + 나무 바닥 + 부드러운 그림자
 */

const B = { x: 400, y: 260 };
const L = { x: 120, y: 400 };
const R = { x: 680, y: 400 };
const F = { x: 400, y: 540 };
const WALL_H = 200;

// 나무 판자 바닥
const WoodPlanks: React.FC = () => {
  const N = 14;
  const blStepX = (L.x - B.x) / N;
  const blStepY = (L.y - B.y) / N;
  const brX = R.x - B.x;
  const brY = R.y - B.y;

  const planks: JSX.Element[] = [];
  for (let i = 0; i < N; i++) {
    const tlx = B.x + blStepX * i;
    const tly = B.y + blStepY * i;
    const trx = tlx + brX;
    const try_ = tly + brY;
    const brx = B.x + blStepX * (i + 1) + brX;
    const bry = B.y + blStepY * (i + 1) + brY;
    const blx = B.x + blStepX * (i + 1);
    const bly = B.y + blStepY * (i + 1);

    const fills = ['#DEC4A0', '#D4B890', '#DABE98', '#D0B288'];
    const fill = fills[i % fills.length];

    planks.push(
      <g key={i}>
        <polygon
          points={`${tlx},${tly} ${trx},${try_} ${brx},${bry} ${blx},${bly}`}
          fill={fill} stroke="#C8A880" strokeWidth="0.5"
        />
        {[0.3, 0.7].map((t, j) => {
          const gx1 = tlx + (blx - tlx) * t;
          const gy1 = tly + (bly - tly) * t;
          const gx2 = trx + (brx - trx) * t;
          const gy2 = try_ + (bry - try_) * t;
          return (
            <line key={j}
              x1={gx1} y1={gy1} x2={gx2} y2={gy2}
              stroke="#C0A070" strokeWidth="0.3" opacity="0.2"
            />
          );
        })}
      </g>
    );
  }
  return <>{planks}</>;
};

// 벽돌 패턴
const BrickPattern: React.FC<{ wall: 'left' | 'right' }> = ({ wall }) => {
  const to = wall === 'left' ? L : R;
  const dx = to.x - B.x;
  const dy = to.y - B.y;
  const elements: JSX.Element[] = [];

  for (let h = 20; h < WALL_H; h += 20) {
    elements.push(
      <line key={`h-${h}`}
        x1={B.x} y1={B.y - h} x2={to.x} y2={to.y - h}
        stroke={wall === 'left' ? '#D8C0A8' : '#CCAD90'}
        strokeWidth="0.6" opacity="0.3"
      />
    );
  }

  for (let h = 0; h < WALL_H; h += 20) {
    const isOdd = (h / 20) % 2 === 1;
    const joints = isOdd ? [0.15, 0.35, 0.55, 0.75, 0.95] : [0.05, 0.25, 0.45, 0.65, 0.85];
    for (const t of joints) {
      const jx = B.x + dx * t;
      const jy = B.y + dy * t;
      elements.push(
        <line key={`v-${h}-${t}`}
          x1={jx} y1={jy - h} x2={jx} y2={jy - h - 20}
          stroke={wall === 'left' ? '#D8C0A8' : '#CCAD90'}
          strokeWidth="0.4" opacity="0.15"
        />
      );
    }
  }

  return <>{elements}</>;
};

// 창문
const IsoWindow: React.FC<{
  wall: 'left' | 'right';
  tL: number; tR: number;
  hB: number; hT: number;
}> = ({ wall, tL, tR, hB, hT }) => {
  const d = wall === 'left'
    ? { x: L.x - B.x, y: L.y - B.y }
    : { x: R.x - B.x, y: R.y - B.y };

  const bl = { x: B.x + d.x * tL, y: B.y + d.y * tL - hB };
  const br = { x: B.x + d.x * tR, y: B.y + d.y * tR - hB };
  const tr = { x: B.x + d.x * tR, y: B.y + d.y * tR - hT };
  const tl = { x: B.x + d.x * tL, y: B.y + d.y * tL - hT };

  const mh1 = { x: (bl.x + tl.x) / 2, y: (bl.y + tl.y) / 2 };
  const mh2 = { x: (br.x + tr.x) / 2, y: (br.y + tr.y) / 2 };
  const mv1 = { x: (bl.x + br.x) / 2, y: (bl.y + br.y) / 2 };
  const mv2 = { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 };

  return (
    <g>
      <polygon
        points={`${bl.x},${bl.y} ${br.x},${br.y} ${tr.x},${tr.y} ${tl.x},${tl.y}`}
        fill="#B8DCF0" stroke="#A08060" strokeWidth="2.5"
      />
      <polygon
        points={`${tl.x},${tl.y} ${tr.x},${tr.y} ${mh2.x},${mh2.y} ${mh1.x},${mh1.y}`}
        fill="#D0ECF8" opacity="0.4"
      />
      <line x1={mh1.x} y1={mh1.y} x2={mh2.x} y2={mh2.y} stroke="#A08060" strokeWidth="2" />
      <line x1={mv1.x} y1={mv1.y} x2={mv2.x} y2={mv2.y} stroke="#A08060" strokeWidth="2" />
    </g>
  );
};

// 화이트보드
const Whiteboard: React.FC = () => {
  const d = { x: R.x - B.x, y: R.y - B.y };
  const bl = { x: B.x + d.x * 0.45, y: B.y + d.y * 0.45 - 85 };
  const br = { x: B.x + d.x * 0.55, y: B.y + d.y * 0.55 - 85 };
  const tr = { x: B.x + d.x * 0.55, y: B.y + d.y * 0.55 - 165 };
  const tl = { x: B.x + d.x * 0.45, y: B.y + d.y * 0.45 - 165 };

  return (
    <g>
      <polygon
        points={`${bl.x},${bl.y} ${br.x},${br.y} ${tr.x},${tr.y} ${tl.x},${tl.y}`}
        fill="#FAFAFA" stroke="#B0B0B0" strokeWidth="1.5"
      />
      {[0.25, 0.45, 0.65, 0.8].map((t, i) => {
        const colors = ['#E01E5A', '#1264A3', '#007A5A', '#ECB22E'];
        const widths = [0.7, 0.5, 0.85, 0.4];
        const y = tl.y + (bl.y - tl.y) * (0.2 + t * 0.6);
        const x1 = tl.x + (bl.x - tl.x) * (0.2 + t * 0.6) + 4;
        const x2 = x1 + (tr.x - tl.x) * widths[i];
        return (
          <line key={i}
            x1={x1} y1={y + (tr.y - tl.y) * t * 0.6}
            x2={x2} y2={y + (tr.y - tl.y) * t * 0.6}
            stroke={colors[i]} strokeWidth="2.5" strokeLinecap="round"
          />
        );
      })}
    </g>
  );
};

// 선반 + 책
const WallShelf: React.FC = () => {
  const d = { x: L.x - B.x, y: L.y - B.y };
  const bl = { x: B.x + d.x * 0.42, y: B.y + d.y * 0.42 - 55 };
  const br = { x: B.x + d.x * 0.58, y: B.y + d.y * 0.58 - 55 };
  const tr = { x: B.x + d.x * 0.58, y: B.y + d.y * 0.58 - 62 };
  const tl = { x: B.x + d.x * 0.42, y: B.y + d.y * 0.42 - 62 };

  return (
    <g>
      <polygon
        points={`${bl.x},${bl.y} ${br.x},${br.y} ${tr.x},${tr.y} ${tl.x},${tl.y}`}
        fill="#A08060" stroke="#8A6A48" strokeWidth="1"
      />
      <polygon
        points={`${bl.x},${bl.y} ${br.x},${br.y} ${br.x},${br.y + 5} ${bl.x},${bl.y + 5}`}
        fill="#8A6A48"
      />
      {[0, 1, 2, 3].map(i => {
        const t = 0.44 + i * 0.035;
        const bx = B.x + d.x * t;
        const by = B.y + d.y * t - 62;
        const colors = ['#E01E5A', '#1264A3', '#ECB22E', '#007A5A'];
        return (
          <rect key={i}
            x={bx - 3} y={by - 16} width={7} height={16}
            fill={colors[i]} rx="0.5"
          />
        );
      })}
    </g>
  );
};

// God Rays
const GodRays: React.FC = () => (
  <g>
    <polygon points="344,238 288,266 350,400 410,370" fill="url(#godRayGrad)" opacity="0.08" />
    <polygon points="246,287 190,315 260,450 320,420" fill="url(#godRayGrad)" opacity="0.06" />
    <polygon points="456,245 512,273 450,400 390,370" fill="url(#godRayGrad)" opacity="0.08" />
    <polygon points="570,290 626,318 560,450 500,420" fill="url(#godRayGrad)" opacity="0.06" />
  </g>
);

export const OfficeSetting: React.FC<OfficeSettingProps> = ({ children }) => {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#F4F0EC' }}>
      <svg
        viewBox="0 0 800 600"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <linearGradient id="godRayGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF8E0" stopOpacity="1" />
            <stop offset="100%" stopColor="#FFF8E0" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 왼쪽 벽 (밝은 면) */}
        <polygon
          points={`${B.x},${B.y} ${L.x},${L.y} ${L.x},${L.y - WALL_H} ${B.x},${B.y - WALL_H}`}
          fill="#ECD8C0"
        />
        <BrickPattern wall="left" />

        {/* 오른쪽 벽 (살짝 어두운 면) */}
        <polygon
          points={`${B.x},${B.y} ${R.x},${R.y} ${R.x},${R.y - WALL_H} ${B.x},${B.y - WALL_H}`}
          fill="#E0C8A8"
        />
        <BrickPattern wall="right" />

        {/* 벽 외곽선 */}
        <line x1={B.x} y1={B.y - WALL_H} x2={B.x} y2={B.y} stroke="#B09070" strokeWidth="2.5" />
        <line x1={L.x} y1={L.y - WALL_H} x2={L.x} y2={L.y} stroke="#B09070" strokeWidth="1.5" />
        <line x1={R.x} y1={R.y - WALL_H} x2={R.x} y2={R.y} stroke="#B09070" strokeWidth="1.5" />
        <line x1={B.x} y1={B.y - WALL_H} x2={L.x} y2={L.y - WALL_H} stroke="#B09070" strokeWidth="1.5" />
        <line x1={B.x} y1={B.y - WALL_H} x2={R.x} y2={R.y - WALL_H} stroke="#B09070" strokeWidth="1.5" />

        {/* 창문 */}
        <IsoWindow wall="left" tL={0.15} tR={0.35} hB={50} hT={155} />
        <IsoWindow wall="left" tL={0.55} tR={0.75} hB={50} hT={155} />
        <IsoWindow wall="right" tL={0.18} tR={0.38} hB={50} hT={155} />
        <IsoWindow wall="right" tL={0.62} tR={0.82} hB={50} hT={155} />

        {/* 벽 장식 */}
        <Whiteboard />
        <WallShelf />
        <text
          x={B.x + (L.x - B.x) * 0.45}
          y={B.y + (L.y - B.y) * 0.45 - 155}
          fontSize="22" textAnchor="middle"
        >🕐</text>

        {/* 바닥 */}
        <WoodPlanks />
        <polygon
          points={`${B.x},${B.y} ${R.x},${R.y} ${F.x},${F.y} ${L.x},${L.y}`}
          fill="none" stroke="#B09070" strokeWidth="1.5"
        />

        {/* 벽-바닥 몰딩 */}
        <line x1={B.x} y1={B.y} x2={L.x} y2={L.y} stroke="#A08060" strokeWidth="3" />
        <line x1={B.x} y1={B.y} x2={R.x} y2={R.y} stroke="#A08060" strokeWidth="3" />

        <GodRays />

        {/* 장식 */}
        <text x={145} y={388} fontSize="28">🪴</text>
        <text x={650} y={388} fontSize="24">🌿</text>
        <text x={555} y={500} fontSize="22">☕</text>
      </svg>

      {/* 직원 카드 레이어 */}
      <div className="absolute inset-0" style={{ pointerEvents: 'none', zIndex: 10 }}>
        <div style={{ pointerEvents: 'auto' }}>{children}</div>
      </div>

      {/* 부드러운 비네팅 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(200,180,160,0.2) 100%)',
          zIndex: 15,
        }}
      />
    </div>
  );
};
