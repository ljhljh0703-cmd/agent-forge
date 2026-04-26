import React from 'react';

/**
 * 픽셀 아트 캐릭터 스프라이트 (SVG 기반)
 * 8x10 그리드, 각 셀 = pixelSize px
 * 에이전트별 고유 색상 + 악세서리
 */

interface SpriteColors {
  hair: string;
  hairDark: string;
  skin: string;
  eye: string;
  shirt: string;
  shirtDark: string;
}

const AGENT_SPRITES: Record<string, SpriteColors> = {
  planner:   { hair: '#5B8FB9', hairDark: '#4A7A9E', skin: '#F0C8A0', eye: '#1a1a2e', shirt: '#E0E0E0', shirtDark: '#C8C8C8' },
  architect: { hair: '#6B4423', hairDark: '#5A3618', skin: '#F0C8A0', eye: '#1a1a2e', shirt: '#4A8A5A', shirtDark: '#3A7A48' },
  compiler:  { hair: '#C05040', hairDark: '#A03830', skin: '#F0C8A0', eye: '#1a1a2e', shirt: '#707880', shirtDark: '#606870' },
  worker:    { hair: '#2A2A30', hairDark: '#1A1A20', skin: '#D4A878', eye: '#1a1a2e', shirt: '#4A6FA5', shirtDark: '#3A5F90' },
  auditor:   { hair: '#D4A040', hairDark: '#C09030', skin: '#F0C8A0', eye: '#1a1a2e', shirt: '#7A4A8A', shirtDark: '#683A78' },
};

// 8 cols x 10 rows
// . = 투명, h = 머리, d = 머리(어두운), s = 피부, E = 눈, b = 셔츠, c = 셔츠(어두운), a = 팔(피부)
const BASE_SPRITE = [
  '..hhhh..',   // 0: 머리 꼭대기
  '.hhhhhh.',   // 1: 머리
  '.dssssd.',   // 2: 머리 옆 + 얼굴
  '.sEssEs.',   // 3: 눈
  '..ssss..',   // 4: 아래 얼굴
  '...ss...',   // 5: 목
  '.cbbbbc.',   // 6: 셔츠 상단 (어두운 가장자리)
  'abbbbbba',   // 7: 팔 + 몸통
  'abbbbbba',   // 8: 팔 + 몸통
  '.a....a.',   // 9: 손 (책상 위)
];

const makeColorMap = (c: SpriteColors): Record<string, string> => ({
  'h': c.hair,
  'd': c.hairDark,
  's': c.skin,
  'E': c.eye,
  'b': c.shirt,
  'c': c.shirtDark,
  'a': c.skin,
});

export const PixelSprite: React.FC<{
  agentId: string;
  pixelSize?: number;
  className?: string;
  style?: React.CSSProperties;
}> = React.memo(({ agentId, pixelSize = 5, className, style }) => {
  const colors = AGENT_SPRITES[agentId] || AGENT_SPRITES.planner;
  const cmap = makeColorMap(colors);
  const P = pixelSize;
  const W = 8 * P;
  const H = BASE_SPRITE.length * P;

  const rects: JSX.Element[] = [];
  BASE_SPRITE.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x * P} y={y * P}
          width={P} height={P}
          fill={cmap[ch]}
        />
      );
    }
  });

  return (
    <svg
      width={W} height={H}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={{ imageRendering: 'pixelated', ...style }}
    >
      {rects}
    </svg>
  );
});
