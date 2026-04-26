# 🤖 Claude Code 브리핑 — 현재 작업 상황

> **최종 갱신**: 2026-02-20 22:30 KST
> **이 파일을 먼저 읽고** 작업을 시작하세요.
>
> 📌 **핸드오프 문서**: [HANDOFF.md](file:///Users/godju/Downloads/AI%20AGENT/Game%20Planning-Agent/docs/HANDOFF.md) — 완료된 작업, 실패한 시도, 아키텍처 맵, 함정 모음
> 📌 **프로젝트 규칙**: [SKILL.md](file:///Users/godju/Downloads/AI%20AGENT/Game%20Planning-Agent/SKILL.md) — 코딩 컨벤션, 기술 제약, 파싱 룰

---

## 📍 현재 위치

**Phase 5 — 완료**. Phase 6 작업 준비 완료 (아래 프롬프트 순서대로 진행).

---

## 🤖 모델 전환 규칙

> [!IMPORTANT]
> **반드시 각 작업 전에 `/model` 명령어로 모델을 전환하세요.**

| 계층 | 모델 | 명령어 | 비용 | 언제 |
|------|------|--------|------|------|
| 🏆 리더 | Opus | `/model opus` | 💰💰💰 | 설계 판단, 아키텍처 |
| ⚔️ 팀원 | Sonnet | `/model sonnet` | 💰💰 | 구현, 분석, 디버깅 |
| ⚡ 하청 | Haiku | `/model haiku` | 💰 | 포맷팅, 파일 생성, 정리 |

---

## 📋 Phase 6 — 복붙 프롬프트 (순서대로)

> [!TIP]
> 한 대화에서 **Step 1개만** 진행하세요. 완료 후 이 파일의 체크포인트를 갱신하고 대화를 종료.

---

### 🧪 Step 6-A: E2E 테스트 (샘플 GDD/SPEC 사용)

```
/model haiku
```
```
docs/CLAUDE_BRIEFING.md와 docs/HANDOFF.md를 읽어.
이제 로컬 서버를 띄우고 (npx serve . 또는 python3 -m http.server) 
브라우저에서 index.html을 열어서 다음을 확인해:

1. docs/GDD.md와 docs/SPEC.md (샘플 데이터가 들어있음)의 내용을 
   File Loader에 복사 붙여넣기
2. ▶ Run Pipeline 클릭
3. Compiler가 task를 정상 생성하는지 확인
4. Worker 프롬프트 카드가 표시되는지 확인
5. 각 step ✅ 완료 후 Auditor 체크리스트 표시 확인
6. 콘솔 에러 보고

버그 발견 시 수정하고, 결과를 보고해.
```

---

### ⚔️ Step 6-B: Compiler 파싱 강화

```
/model sonnet
```
```
docs/HANDOFF.md를 읽고 현재 상태를 파악해.

src/nodes/compiler.js의 파싱 로직을 강화해줘:

현재 문제:
- ## 헤더 번호가 다르면 파싱 실패 (예: "## 5. 구현 순서" vs "## 6. 구현 순서")
- 영문 SPEC은 파싱 불가 (### Implementation Order 등)

수정 방향:
1. _extractSection()에서 헤더 번호를 유연하게 매칭
   예: /^##\s*\d*\.?\s*구현\s*순서/m 또는 /^##\s*\d*\.?\s*implementation\s*order/im
2. "핵심 모듈 설계" 외에 "모듈 설계", "Module Design" 등도 매칭
3. "완료 기준" 외에 "Acceptance Criteria", "Done Criteria" 등도 매칭
4. 섹션이 발견되지 않을 때 폴백 전략: 전체 번호 리스트 수집

테스트: docs/SPEC.md로 파싱 결과 확인 (콘솔 출력 추가해서).
수정 후 docs/CLAUDE_BRIEFING.md 체크포인트 6-B를 [x]로 갱신.
```

---

### ⚔️ Step 6-C: Worker 프롬프트 품질 개선

```
/model sonnet
```
```
docs/HANDOFF.md를 읽고 현재 상태를 파악해.

src/nodes/compiler.js의 _buildPrompt() 함수를 개선해줘:

현재: [컨텍스트] + [제약 조건] + [작업 지시] 단순 결합
개선:
1. 프롬프트 앞에 `/model {추천 모델}` 명령어 포함
2. 작업 지시에 구체적 파일 경로 포함 (SPEC의 폴더 구조에서 추출)
3. 작업 완료 기준 명시 ("이 step이 끝나면 X 파일이 존재해야 함")
4. 이전 step 결과 참고 지시 추가 (의존성 있는 경우)

대상 파일: src/nodes/compiler.js (_buildPrompt 함수)
수정 후 체크포인트 6-C를 [x]로 갱신.
```

---

### ⚔️ Step 6-D: Auditor 자동 검증 로직 추가

```
/model sonnet
```
```
docs/HANDOFF.md를 읽고 현재 상태를 파악해.

src/nodes/auditor.js에 자동 검증 로직을 추가해줘:

현재: 수동 체크리스트만 존재
추가:
1. Worker 결과에서 filesCreated 배열 확인
2. SPEC의 폴더 구조와 대조하여 누락 파일 자동 탐지
3. 자동 채점 (자동 검증 항목)과 수동 확인 (체크리스트)을 분리
4. Debt Score 산출에 자동 검증 결과 반영

Debt Score 공식 수정:
  autoScore = (누락 파일 수 / 전체 예상 파일 수) × 5
  manualScore = (미체크 항목 / 전체 항목) × 5
  totalScore = autoScore + manualScore

수정 후 체크포인트 6-D를 [x]로 갱신.
```

---

### ⚡ Step 6-E: 정리 + 반응형 CSS

```
/model haiku
```
```
docs/HANDOFF.md를 읽고 현재 상태를 파악해.

1. 전체 코드에서 사용하지 않는 import 제거
2. 모든 JS 파일 상단 주석에 "입력/출력" 표기 통일
3. styles/main.css에 모바일 반응형 추가:
   - @media (max-width: 768px) — 노드 그리드 세로 배치
   - @media (max-width: 480px) — 폰트 크기 축소, 패딩 축소
4. 체크포인트 최종 갱신
```

---

## ✅ 체크포인트

### Phase 1~5: 완료 ✅
- [x] 스캐폴딩, 리네임, 코어 로직, UI 연동
- [x] GDD/SPEC 입력 UI + Compiler 실전화
- [x] Worker 프롬프트 카드 + Auditor 체크리스트
- [x] 통합

### Phase 6: 강화 & 테스트 🔲
- [x] **6-A** E2E 테스트 (샘플 GDD/SPEC 사용)
- [x] **6-B** Compiler 파싱 강화 (유연한 헤더 매칭)
- [x] **6-C** Worker 프롬프트 품질 개선 (_buildPrompt 고도화)
- [x] **6-D** Auditor 자동 검증 로직 추가
- [x] **6-E** 정리 + 반응형 CSS

---

## 🗂️ 핵심 파일 맵

```
Game Planning-Agent/
├── SKILL.md                ← 프로젝트 규칙/컨벤션 (NEW)
├── index.html              ← 엔트리 HTML (204줄)
├── docs/
│   ├── HANDOFF.md          ← 핸드오프 문서 (NEW)
│   ├── CLAUDE_BRIEFING.md  ← 이 문서
│   ├── GDD.md              ← 샘플: Chicken Rush 기획서
│   └── SPEC.md             ← 샘플: Chicken Rush 기술명세
├── src/
│   ├── app.js              ← 엔트리 + 이벤트 바인딩 (300줄)
│   ├── pipeline.js         ← PipelineEngine (148줄)
│   ├── config.js           ← NODES, NODE_ORDER (75줄)
│   ├── nodes/
│   │   ├── compiler.js     ← ★ SPEC 파싱 → plan 생성 (229줄)
│   │   ├── worker.js       ← ★ 프롬프트 카드 연동 (89줄)
│   │   └── auditor.js      ← ★ 체크리스트 + Debt Score (128줄)
│   ├── ui/
│   │   ├── file-loader.js  ← GDD/SPEC 입력 (97줄)
│   │   ├── prompt-display.js ← Worker 카드 UI (184줄)
│   │   └── checklist-display.js ← Auditor 체크리스트 (107줄)
│   └── utils/
│       ├── event-bus.js    ← on/emit/off
│       └── state-manager.js ← get/set/subscribe
└── templates/
    ├── gdd-template.md
    └── spec-template.md
```

---

## ⚠️ 주의 (반드시 읽기)

1. **window 전역 노출** — HTML `onclick`에서 호출되는 함수는 `window.함수명 = function() {...}` 필수
2. **Compiler 파싱** — `## 6. 구현 순서`, `## 3. 핵심 모듈 설계`, `## 7. 완료 기준` 패턴만 인식
3. **순수 브라우저 앱** — Node.js 없음, subprocess 불가, 클라이언트 사이드 전용
4. **simulateLoop()** — Worker/Auditor를 런타임 패치함. 건드리지 말 것
5. **agents/ 스텁** — `src/agents/` 3개 파일은 미구현 스텁
6. **WORK_SPEC.md 31KB** — 통째로 읽지 말 것. 이 문서 + HANDOFF.md로 충분
