export type DomainMode = 'game' | 'software' | 'docs';

/** agent-service.ts의 AGENT_ROLES 키를 참조 */
export interface AgentRoleRef {
  roleId: string;
}

export interface DomainConfig {
  mode: DomainMode;
  label: string;
  icon: string;
  description: string;

  /** 각 에이전트가 사용할 role ID (agent-service.ts 참조) */
  roles: {
    planner: AgentRoleRef;
    architect: AgentRoleRef;
    worker: AgentRoleRef;
    auditor: AgentRoleRef;
  };

  /** 도메인 전환 시 employees의 title/description 덮어쓰기 */
  employeeOverrides: {
    [agentId: string]: { title: string; description: string };
  };

  /** Live Canvas 렌더러 타입 */
  canvasType: 'iframe-game' | 'mermaid-diagram' | 'markdown-preview';

  /** 도메인별 입력 템플릿 */
  templates: DomainTemplate[];
}

export interface DomainTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  hints: { planner: string; architect: string };
  keywords: string[];
  example: string;
}

// ──── 게임 도메인 ────────────────────────────────────────────
export const GAME_DOMAIN: DomainConfig = {
  mode: 'game',
  label: 'Game Dev',
  icon: '🎮',
  description: '게임 기획 → 코드 자동 생성',
  roles: {
    planner:  { roleId: 'planner' },
    architect: { roleId: 'architect' },
    worker:   { roleId: 'worker' },
    auditor:  { roleId: 'auditor' },
  },
  employeeOverrides: {
    planner:  { title: '기획자',   description: '게임 설계 및 기획을 담당합니다' },
    architect: { title: '아키텍트', description: '기술 명세와 구조를 설계합니다' },
    compiler: { title: '컴파일러', description: '실행 계획을 생성합니다' },
    worker:   { title: '워커',     description: '실제 코드를 작성합니다' },
    auditor:  { title: '감시자',   description: '품질을 검증합니다' },
  },
  canvasType: 'iframe-game',
  templates: [
    {
      id: 'survivors',
      name: 'Survivors-like',
      icon: '🧟',
      description: '자동 공격 + 웨이브 서바이벌',
      hints: {
        planner: '자동 공격 주기, 적 스폰 규칙, 레벨업 보상 정의 필수',
        architect: '엔티티 풀링, 충돌 감지 최적화 고려',
      },
      keywords: ['서바이벌', '웨이브', '자동공격', '레벨업'],
      example: '슬라임이 사방에서 몰려오는 1분 서바이벌',
    },
    {
      id: 'platformer',
      name: 'Platformer',
      icon: '🏃',
      description: '점프 + 장애물 회피',
      hints: {
        planner: '중력 값, 점프 높이, 스테이지 구성 정의 필수',
        architect: '물리 엔진 단순화 (중력+충돌만), 레벨 데이터 구조',
      },
      keywords: ['점프', '플랫폼', '스테이지', '장애물'],
      example: '3단계 스테이지를 점프로 클리어하는 러너',
    },
    {
      id: 'puzzle',
      name: 'Puzzle',
      icon: '🧩',
      description: '논리 + 패턴 매칭',
      hints: {
        planner: '그리드 크기, 매칭 규칙, 콤보 시스템 정의',
        architect: '2D 배열 상태 관리, 애니메이션 큐',
      },
      keywords: ['퍼즐', '매칭', '그리드', '점수'],
      example: '같은 색 블록 3개를 맞추는 매치-3 퍼즐',
    },
    {
      id: 'shooter',
      name: 'Shooter',
      icon: '🚀',
      description: '투사체 + 적 파괴',
      hints: {
        planner: '투사체 속도, 적 패턴, 보스 HP 정의',
        architect: '오브젝트 풀링, 충돌 매트릭스',
      },
      keywords: ['슈팅', '투사체', '보스', '파워업'],
      example: '우주 전투기로 외계인을 물리치는 종스크롤 슈터',
    },
    {
      id: 'tower-defense',
      name: 'Tower Defense',
      icon: '🏰',
      description: '타워 배치 + 경로 방어',
      hints: {
        planner: '타워 종류/사거리/DPS, 적 HP/속도, 웨이브 구성',
        architect: '경로 탐색(하드코딩), 타워-적 거리 계산',
      },
      keywords: ['타워', '디펜스', '웨이브', '자원'],
      example: '3종류 타워로 5웨이브를 방어하는 TD',
    },
  ],
};

// ──── 소프트웨어 도메인 ─────────────────────────────────────
export const SOFTWARE_DOMAIN: DomainConfig = {
  mode: 'software',
  label: 'SW Architect',
  icon: '🏗️',
  description: '소프트웨어 요구사항 → 아키텍처 자동 설계',
  roles: {
    planner:  { roleId: 'planner_sw' },
    architect: { roleId: 'architect_sw' },
    worker:   { roleId: 'worker_sw' },
    auditor:  { roleId: 'auditor_sw' },
  },
  employeeOverrides: {
    planner:  { title: '요구분석가',    description: '비즈니스 요구사항을 분석합니다' },
    architect: { title: '시스템 설계자', description: '기술 아키텍처를 설계합니다' },
    compiler: { title: '태스크 분해기', description: '구현 계획을 수립합니다' },
    worker:   { title: '코드 생성기',   description: '보일러플레이트와 문서를 생성합니다' },
    auditor:  { title: '아키텍처 리뷰어', description: '설계 품질을 검증합니다' },
  },
  canvasType: 'mermaid-diagram',
  templates: [
    {
      id: 'web-app',
      name: 'Web Application',
      icon: '🌐',
      description: 'React/Next.js 기반 웹 애플리케이션',
      hints: {
        planner: '사용자 인증, CRUD, 대시보드 등 핵심 기능 정의',
        architect: 'SPA/SSR 결정, API 라우트, 상태 관리 패턴',
      },
      keywords: ['React', 'Next.js', 'SPA', 'SSR', 'dashboard'],
      example: '사내 프로젝트 관리 대시보드, 팀원 10명',
    },
    {
      id: 'rest-api',
      name: 'REST API Server',
      icon: '🔌',
      description: 'Node.js/Express 기반 백엔드 API',
      hints: {
        planner: '엔드포인트 목록, 인증 방식, 데이터 모델 정의',
        architect: 'DB 선택, ORM, 미들웨어 구조, 에러 핸들링',
      },
      keywords: ['Express', 'Fastify', 'REST', 'CRUD', 'middleware'],
      example: 'e-커머스 상품 관리 API, 1만 DAU',
    },
    {
      id: 'realtime',
      name: 'Realtime Application',
      icon: '⚡',
      description: 'WebSocket/SSE 기반 실시간 서비스',
      hints: {
        planner: '실시간 이벤트 유형, 동시접속 목표, 메시징 패턴',
        architect: 'WebSocket vs SSE, 메시지 브로커, 상태 동기화',
      },
      keywords: ['WebSocket', 'Socket.io', 'SSE', 'realtime', 'chat'],
      example: '실시간 채팅 앱, 1만 동시접속',
    },
    {
      id: 'cli-tool',
      name: 'CLI Tool',
      icon: '💻',
      description: 'Node.js 기반 명령줄 도구',
      hints: {
        planner: '명령어 목록, 입출력 형식, 설정 파일 구조',
        architect: '파서 선택, 플러그인 구조, 에러 처리',
      },
      keywords: ['CLI', 'commander', 'yargs', 'terminal'],
      example: '마크다운 → HTML 변환 CLI 도구',
    },
    {
      id: 'mobile-bff',
      name: 'Mobile BFF',
      icon: '📱',
      description: '모바일 앱 전용 Backend-for-Frontend',
      hints: {
        planner: '모바일 화면별 API 요구사항, 오프라인 지원 범위',
        architect: 'BFF 패턴, GraphQL vs REST, 캐싱 전략',
      },
      keywords: ['BFF', 'GraphQL', 'mobile', 'caching'],
      example: '배달 앱 BFF, 주문/배달 실시간 추적',
    },
  ],
};

// ──── 문서 자동 생성 도메인 ──────────────────────────────────
export const DOCS_DOMAIN: DomainConfig = {
  mode: 'docs',
  label: 'Auto Docs',
  icon: '📄',
  description: '코드베이스 → 기술 문서 자동 생성',
  roles: {
    planner:   { roleId: 'planner_docs' },
    architect: { roleId: 'architect_docs' },
    worker:    { roleId: 'worker_docs' },
    auditor:   { roleId: 'auditor_docs' },
  },
  employeeOverrides: {
    planner:   { title: '문서 기획자',   description: '문서 스코프와 구조를 정의합니다' },
    architect: { title: '코드 분석가',   description: '코드베이스를 분석하고 핵심 구조를 파악합니다' },
    compiler:  { title: '문서 플래너',   description: '문서 작성 계획을 수립합니다' },
    worker:    { title: '문서 작성기',   description: '마크다운 기술 문서를 생성합니다' },
    auditor:   { title: '문서 리뷰어',   description: '문서 품질과 정확성을 검증합니다' },
  },
  canvasType: 'markdown-preview',
  templates: [
    {
      id: 'api-reference',
      name: 'API Reference',
      icon: '🔌',
      description: 'REST/GraphQL API 엔드포인트 레퍼런스',
      hints: {
        planner: '엔드포인트 목록, 요청/응답 스키마, 인증 방식 정의',
        architect: '라우트 구조, 미들웨어 체인, 에러 코드 분석',
      },
      keywords: ['API', 'endpoint', 'REST', 'GraphQL'],
      example: 'Express.js REST API의 전체 엔드포인트 레퍼런스',
    },
    {
      id: 'architecture-doc',
      name: 'Architecture Doc',
      icon: '🏗️',
      description: '시스템 아키텍처 문서 (다이어그램 포함)',
      hints: {
        planner: '시스템 구성요소, 데이터 흐름, 배포 구조 정의',
        architect: '모듈 의존성, 레이어 분리, 통신 패턴 분석',
      },
      keywords: ['architecture', '아키텍처', 'system design', 'diagram'],
      example: 'Next.js + Prisma 풀스택 앱의 아키텍처 문서',
    },
    {
      id: 'onboarding-guide',
      name: 'Onboarding Guide',
      icon: '🚀',
      description: '신규 개발자 온보딩 가이드',
      hints: {
        planner: '설치 방법, 개발 환경 설정, 핵심 컨셉 정의',
        architect: '프로젝트 구조, 주요 진입점, 개발 워크플로우 분석',
      },
      keywords: ['onboarding', 'setup', 'getting started', 'guide'],
      example: 'React + TypeScript 프로젝트 신규 개발자 가이드',
    },
    {
      id: 'code-walkthrough',
      name: 'Code Walkthrough',
      icon: '🔍',
      description: '코드 구조 분석 및 핵심 로직 설명',
      hints: {
        planner: '핵심 모듈, 데이터 흐름, 주요 알고리즘 정의',
        architect: '호출 그래프, 상태 관리, 에러 핸들링 패턴 분석',
      },
      keywords: ['walkthrough', 'code review', '코드 분석'],
      example: '게임 엔진의 렌더링 파이프라인 코드 워크스루',
    },
    {
      id: 'changelog',
      name: 'Changelog / Release Notes',
      icon: '📋',
      description: '변경 이력 및 릴리스 노트 생성',
      hints: {
        planner: '버전 범위, 변경 카테고리, 마이그레이션 가이드 정의',
        architect: 'git diff 분석, 브레이킹 체인지 감지',
      },
      keywords: ['changelog', 'release', 'version', '릴리스'],
      example: 'v1.x → v2.0 마이그레이션 가이드 포함 릴리스 노트',
    },
    {
      id: 'readme',
      name: 'README.md',
      icon: '📖',
      description: '프로젝트 README 자동 생성',
      hints: {
        planner: '프로젝트 소개, 설치 방법, 사용 예제, 기여 가이드 정의',
        architect: '기술 스택, 디렉토리 구조, CI/CD 파이프라인 분석',
      },
      keywords: ['README', 'documentation', '문서'],
      example: 'OSS 프로젝트의 완전한 README.md 생성',
    },
  ],
};

export const DOMAIN_CONFIGS: Record<DomainMode, DomainConfig> = {
  game: GAME_DOMAIN,
  software: SOFTWARE_DOMAIN,
  docs: DOCS_DOMAIN,
};
