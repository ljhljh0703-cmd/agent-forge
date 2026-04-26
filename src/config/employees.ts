// 직원 설정 (나중에 이미지/SVG로 변경 가능)
// 임시 이모지 기반, 쉽게 커스터마이징 가능한 구조

export interface Employee {
  id: string;
  name: string;
  role: string;
  emoji: string;
  title: string;
  position: { x: number; y: number }; // 사무실 배치
  description: string;
  color: string;
}

export const EMPLOYEES: Record<string, Employee> = {
  planner: {
    id: 'planner',
    name: 'Alex',
    role: 'Planner',
    emoji: '🧑‍💼',
    title: '기획자',
    position: { x: 80, y: 62 },
    description: '게임 설계 및 기획을 담당합니다',
    color: '#f0c040',
  },
  architect: {
    id: 'architect',
    name: 'Sam',
    role: 'Architect',
    emoji: '🧑‍🔧',
    title: '아키텍트',
    position: { x: 80, y: 70 },
    description: '기술 명세와 구조를 설계합니다',
    color: '#e8442a',
  },
  compiler: {
    id: 'compiler',
    name: 'Jordan',
    role: 'Compiler',
    emoji: '🧑‍💻',
    title: '컴파일러',
    position: { x: 80, y: 78 },
    description: '실행 계획을 생성합니다',
    color: '#7b5dfa',
  },
  worker: {
    id: 'worker',
    name: 'Casey',
    role: 'Worker',
    emoji: '👨‍🚀',
    title: '워커',
    position: { x: 85, y: 70 },
    description: '실제 코드를 작성합니다',
    color: '#3de8e0',
  },
  auditor: {
    id: 'auditor',
    name: 'Morgan',
    role: 'Auditor',
    emoji: '🧑‍⚖️',
    title: '감시자',
    position: { x: 85, y: 78 },
    description: '품질을 검증합니다',
    color: '#3ddc84',
  },
};

/** domainConfig.employeeOverrides를 적용한 Employee 맵 반환 */
export function getEmployees(
  overrides: Record<string, { title: string; description: string }>,
): Record<string, Employee> {
  const result: Record<string, Employee> = {};
  for (const [id, emp] of Object.entries(EMPLOYEES)) {
    result[id] = overrides[id]
      ? { ...emp, title: overrides[id].title, description: overrides[id].description }
      : { ...emp };
  }
  return result;
}

export const EMPLOYEE_STATUSES = {
  idle: { icon: '😴', label: '대기 중', animation: 'none' },
  thinking: { icon: '🤔', label: '생각 중', animation: 'pulse' },
  writing: { icon: '✍️', label: '작성 중', animation: 'bounce' },
  researching: { icon: '🔍', label: '조사 중', animation: 'spin' },
  executing: { icon: '⚙️', label: '실행 중', animation: 'bounce' },
  syncing: { icon: '💾', label: '동기화 중', animation: 'pulse' },
  error: { icon: '⚠️', label: '오류 발생', animation: 'shake' },
  success: { icon: '✅', label: '완료', animation: 'none' },
};
