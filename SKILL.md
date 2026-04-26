# 🛠️ SKILL.md — AI Agent Pipeline 프로젝트 스킬셋

> **이 파일은 Compiler 노드가 참조하는 프로젝트 스킬/규칙 문서입니다.**

---

## 프로젝트 규칙

### 기술 제약
- **순수 브라우저 앱** — Node.js 서버 없음, 모든 로직은 클라이언트 사이드
- **ES Module** — `<script type="module">` 사용, import/export 기반
- **외부 라이브러리 없음** — Vanilla JS + CSS만 사용 (예외: Google Fonts)
- **파일 시스템 접근 불가** — 브라우저 환경이므로 `fs` 모듈 사용 불가

### 코딩 컨벤션
- 함수명: camelCase
- 클래스명: PascalCase
- 상수: UPPER_SNAKE_CASE
- 내부(private) 함수: `_` 접두사 (예: `_parseSection()`)
- 주석: 한글, 파일 상단에 역할 설명 + 입출력 명시
- export: 파일 하단이 아닌 함수/클래스 선언부에서 직접 export

### 아키텍처 패턴
- **EventBus**: 모듈 간 결합도를 낮추기 위해 이벤트 기반 통신 사용
- **StateManager**: Observer 패턴 기반 전역 상태 관리 (`get`/`set`/`subscribe`)
- **BaseNode**: 모든 파이프라인 노드는 `BaseNode`를 상속, `execute(input)` + `validate(output)` 구현

### HTML onclick 함수
```
⚠️ ES Module 스코프 때문에, HTML에서 onclick으로 호출되는 함수는
반드시 window.함수명 = function() { ... } 으로 전역 노출해야 함.
```

### 테스트 방식
- 브라우저 콘솔 수동 테스트 (자동 테스트 프레임워크 없음)
- `npx serve .` 로컬 서버 또는 `file://` 프로토콜로 확인
- Simulate Loop 버튼으로 파이프라인 E2E 시뮬레이션

---

## Claude Code 작업 시 참고

### 모델 사용 가이드
| 작업 유형 | 추천 모델 | 명령어 |
|----------|----------|--------|
| 설계/판단/아키텍처 | Opus | `/model opus` |
| 구현/분석/코드 작성 | Sonnet | `/model sonnet` |
| 파일 생성/포맷팅/정리 | Haiku | `/model haiku` |

### 파이프라인 SPEC 파싱 규칙
Compiler 노드가 SPEC.md에서 task를 추출할 때 사용하는 패턴:
- `## 6. 구현 순서` → 번호 리스트(1. 2. 3.)
- `## 3. 핵심 모듈 설계` → ### 서브헤딩
- `## 7. 완료 기준` → 체크박스(- [ ])
