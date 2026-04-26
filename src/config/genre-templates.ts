export interface GenreTemplate {
  id: string;
  name: string;
  nameKo: string;
  icon: string;
  description: string;
  gddHints: string;
  specHints: string;
  mechanics: string[];
  example: string;
}

export const GENRE_TEMPLATES: GenreTemplate[] = [
  {
    id: 'survivors',
    name: 'Survivors-like',
    nameKo: '뱀서라이크',
    icon: '🧟',
    description: '자동 공격 + 웨이브 서바이벌',
    mechanics: ['자동 공격', '웨이브 스폰', '경험치/레벨업', '생존 타이머'],
    example: '슬라임이 사방에서 몰려오는 1분 서바이벌',
    gddHints: '자동 공격 주기, 적 스폰 규칙, 레벨업 보상 정의 필수',
    specHints: '엔티티 풀링, 충돌 감지 최적화 고려',
  },
  {
    id: 'platformer',
    name: 'Platformer',
    nameKo: '플랫포머',
    icon: '🏃',
    description: '점프 + 장애물 회피',
    mechanics: ['점프/중력', '장애물', '코인 수집', '스테이지 클리어'],
    example: '3단계 스테이지를 점프로 클리어하는 러너',
    gddHints: '중력 값, 점프 높이, 스테이지 구성 정의 필수',
    specHints: '물리 엔진 단순화 (중력+충돌만), 레벨 데이터 구조',
  },
  {
    id: 'puzzle',
    name: 'Puzzle',
    nameKo: '퍼즐',
    icon: '🧩',
    description: '논리 + 패턴 매칭',
    mechanics: ['그리드 시스템', '매칭 규칙', '스코어링', '제한 시간/턴'],
    example: '같은 색 블록 3개를 맞추는 매치-3 퍼즐',
    gddHints: '그리드 크기, 매칭 규칙, 콤보 시스템 정의',
    specHints: '2D 배열 상태 관리, 애니메이션 큐',
  },
  {
    id: 'shooter',
    name: 'Shooter',
    nameKo: '슈팅',
    icon: '🚀',
    description: '투사체 + 적 파괴',
    mechanics: ['투사체 발사', '적 패턴', '보스', '파워업'],
    example: '우주 전투기로 외계인을 물리치는 종스크롤 슈터',
    gddHints: '투사체 속도, 적 패턴, 보스 HP 정의',
    specHints: '오브젝트 풀링, 충돌 매트릭스',
  },
  {
    id: 'tower-defense',
    name: 'Tower Defense',
    nameKo: '타워 디펜스',
    icon: '🏰',
    description: '타워 배치 + 경로 방어',
    mechanics: ['타워 배치', '적 경로', '웨이브', '자원 관리'],
    example: '3종류 타워로 5웨이브를 방어하는 TD',
    gddHints: '타워 종류/사거리/DPS, 적 HP/속도, 웨이브 구성',
    specHints: '경로 탐색(하드코딩), 타워-적 거리 계산',
  },
];
