import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useWindowContext } from '../../context/WindowContext';
import { getAgentService } from '../../services/agent-service';
import {
  loadSavedDocuments,
  saveDocument,
  deleteDocument,
  SavedDocument,
  PipelineState,
} from '../../context/WindowContext';
import { loadExperimentRuns, ExperimentRun } from '../../config/experiments';
import { generateExperimentReport } from './ExperimentWindow';

type Tab = 'feedback' | 'document' | 'archive' | 'report';
type FeedbackMode = 'direct' | 'pipeline';
type DocType = 'skill' | 'spec' | 'handoff' | 'startercode';
type ArchiveFilter = 'all' | 'skill' | 'spec' | 'handoff' | 'startercode';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  agentLabel: string;
  agentIdx: number;
}

interface DiscussionEntry {
  agentId: string;
  agentLabel: string;
  content: string;
}

interface FeedbackResult {
  action: 'regenerate-gdd' | 'regenerate-spec' | 'regenerate-code' | 'patch-code';
  priority: 'high' | 'medium' | 'low';
  summary: string;
  revisedPrompt: string;
}

const AGENT_OPTIONS = [
  { label: 'Alex (기획자)', roleId: 'planner', swRoleId: 'planner_sw', windowId: 'planner' },
  { label: 'Sam (아키텍트)', roleId: 'architect', swRoleId: 'architect_sw', windowId: 'architect' },
  { label: 'Jordan (컴파일러)', roleId: 'compiler', swRoleId: 'compiler_sw', windowId: 'terminal' },
  { label: 'Casey (워커)', roleId: 'worker', swRoleId: 'worker_sw', windowId: null },
  { label: 'Morgan (감사자)', roleId: 'auditor', swRoleId: 'auditor_sw', windowId: null },
] as const;

const FEEDBACK_AGENTS = [
  { id: 'planner',  label: 'Alex (기획자)',  roleId: 'feedback_planner' },
  { id: 'architect',label: 'Sam (아키텍트)', roleId: 'feedback_architect' },
  { id: 'worker',   label: 'Casey (개발자)', roleId: 'feedback_worker' },
  { id: 'auditor',  label: 'Morgan (총괄)',  roleId: 'feedback_coordinator' },
] as const;

const ACTION_LABELS: Record<string, string> = {
  'regenerate-gdd':  '📝 GDD 재작성',
  'regenerate-spec': '🔧 SPEC 재작성',
  'regenerate-code': '💻 코드 재생성',
  'patch-code':      '🩹 코드 패치',
};

const PRIORITY_COLORS: Record<string, string> = {
  high:   'text-red-600',
  medium: 'text-orange-500',
  low:    'text-green-600',
};

function buildPipelineContext(pipeline: PipelineState, feedback: string): string {
  const codePreview = pipeline.generatedCode
    .slice(0, 3)
    .map(f => `[${f.path}]\n${f.content.slice(0, 400)}`)
    .join('\n\n');

  return `=== 현재 파이프라인 상태 ===
GDD: ${pipeline.gdd ? `있음 (${pipeline.gdd.length}자)` : '없음'}
SPEC: ${pipeline.spec ? `있음 (${pipeline.spec.length}자)` : '없음'}
생성 파일: ${pipeline.generatedCode.length}개
감사 점수: ${pipeline.auditResult ? `${pipeline.auditResult.score}/10 (${pipeline.auditResult.recommendation})` : '미검증'}
${pipeline.auditResult?.summary ? `감사 요약: ${pipeline.auditResult.summary}` : ''}

=== GDD/PRD (일부) ===
${pipeline.gdd.slice(0, 1200)}

=== SPEC (일부) ===
${pipeline.spec.slice(0, 1200)}

${codePreview ? `=== 현재 코드 (일부) ===\n${codePreview}\n` : ''}
=== 사용자 피드백 ===
${feedback}`;
}

export const MemoWindow: React.FC = () => {
  const {
    addLog,
    pipeline,
    runWorker,
    runAuditor,
    toggleWindowVisibility,
    domainMode,
    updateAgent,
  } = useWindowContext();

  const [tab, setTab] = useState<Tab>('feedback');

  // ── 탭 1: 소통 ──────────────────────────────────────────
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('direct');

  // 직접 대화
  const [selectedAgent, setSelectedAgent] = useState(0);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 파이프라인 피드백
  const [pipelineFeedback, setPipelineFeedback] = useState('');
  const [discussion, setDiscussion] = useState<DiscussionEntry[]>([]);
  const [isDiscussing, setIsDiscussing] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<FeedbackResult | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const discussionEndRef = useRef<HTMLDivElement>(null);

  // ── 탭 2: 문서 요청 ─────────────────────────────────────
  const [docType, setDocType] = useState<DocType>('skill');
  const [docTitle, setDocTitle] = useState('');
  const [docPreview, setDocPreview] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [canSaveDoc, setCanSaveDoc] = useState(false);

  // ── 탭 3: 보관함 ─────────────────────────────────────────
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('all');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docs, setDocs] = useState<SavedDocument[]>(() => loadSavedDocuments());

  // ── 탭 4: 리포트 프리뷰 ──────────────────────────────────
  const [expRuns, setExpRuns] = useState<ExperimentRun[]>(() => loadExperimentRuns());
  const [selectedExpId, setSelectedExpId] = useState<string | null>(null);
  const [reportPreview, setReportPreview] = useState('');

  const refreshDocs = useCallback(() => setDocs(loadSavedDocuments()), []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    discussionEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [discussion]);

  const getEffectiveRoleId = (agentIdx: number): string => {
    const opt = AGENT_OPTIONS[agentIdx];
    return domainMode === 'software' ? opt.swRoleId : opt.roleId;
  };

  // ── 직접 대화: 메시지 전송 ───────────────────────────────
  const handleSendMessage = async () => {
    if (!message.trim() || isSending) return;

    const opt = AGENT_OPTIONS[selectedAgent];
    const roleId = getEffectiveRoleId(selectedAgent);
    const userText = message.trim();
    setMessage('');

    const userEntry: ChatMessage = {
      role: 'user',
      content: userText,
      agentLabel: 'You',
      agentIdx: selectedAgent,
    };
    setChatHistory(prev => [...prev, userEntry]);
    setIsSending(true);
    addLog(`📞 [직원 호출] ${opt.label}에게 메시지 전송`, 'info');

    const assistantEntry: ChatMessage = {
      role: 'assistant',
      content: '',
      agentLabel: opt.label,
      agentIdx: selectedAgent,
    };
    setChatHistory(prev => [...prev, assistantEntry]);

    let response = '';
    try {
      const agentService = getAgentService();
      await agentService.executeStream(roleId, userText, (chunk) => {
        response += chunk;
        setChatHistory(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...assistantEntry, content: response };
          return updated;
        });
      });
      addLog(`📞 [직원 호출] ${opt.label} 응답 완료`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`❌ [직원 호출] 오류: ${msg}`, 'error');
      setChatHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...assistantEntry, content: `오류: ${msg}` };
        return updated;
      });
    } finally {
      setIsSending(false);
    }
  };

  // ── 직접 대화: 피드백으로 재생성 ─────────────────────────
  const handleRegenerate = async (feedback: string, agentIdx: number) => {
    const opt = AGENT_OPTIONS[agentIdx];
    const baseRole = opt.roleId;

    if (baseRole === 'worker') {
      addLog(`🔄 [재생성] Casey — 피드백 반영 재생성`, 'info');
      const feedbackSpec = `${pipeline.spec}\n\n=== 피드백 ===\n${feedback}`;
      await runWorker(feedbackSpec, pipeline.gdd);
    } else if (baseRole === 'auditor') {
      addLog(`🔄 [재생성] Morgan — 피드백 반영 재검증`, 'info');
      await runAuditor(pipeline.gdd, pipeline.spec, pipeline.generatedCode);
    } else {
      addLog(`📋 [직원 호출] ${opt.label} 창 열기`, 'info');
      addLog(`💬 피드백: ${feedback.slice(0, 120)}`, 'info');
      if (opt.windowId) toggleWindowVisibility(opt.windowId);
    }
  };

  // ── 파이프라인 피드백: 에이전트 토론 ────────────────────
  const handleStartDiscussion = async () => {
    if (!pipelineFeedback.trim() || isDiscussing) return;

    const currentPipeline = pipeline; // 현재 상태 캡처
    setIsDiscussing(true);
    setDiscussion([]);
    setFeedbackResult(null);
    addLog('🔥 [에이전트 토론] 시작', 'info');

    const agentService = getAgentService();
    const opinions: Record<string, string> = {};

    for (const agent of FEEDBACK_AGENTS) {
      updateAgent(agent.id, { status: 'researching', currentTask: '피드백 분석 중...' });

      // 이전 에이전트 의견을 컨텍스트에 추가
      const prevOpinionsText = FEEDBACK_AGENTS
        .filter(a => opinions[a.id] !== undefined)
        .map(a => `=== ${a.label} 의견 ===\n${opinions[a.id]}`)
        .join('\n\n');

      const pipelineCtx = buildPipelineContext(currentPipeline, pipelineFeedback);
      const prompt = prevOpinionsText
        ? `${pipelineCtx}\n\n${prevOpinionsText}\n\n위 맥락을 바탕으로 의견을 제시하세요.`
        : pipelineCtx;

      // 스트리밍 엔트리 추가
      setDiscussion(prev => [...prev, { agentId: agent.id, agentLabel: agent.label, content: '' }]);

      let content = '';
      try {
        await agentService.executeStream(agent.roleId, prompt, (chunk) => {
          content += chunk;
          setDiscussion(prev => {
            const updated = [...prev];
            const lastIdx = updated.map(e => e.agentId).lastIndexOf(agent.id);
            if (lastIdx >= 0) updated[lastIdx] = { ...updated[lastIdx], content };
            return updated;
          });
        });
        opinions[agent.id] = content;
        addLog(`✓ [${agent.label}] 의견 제출`, 'success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        opinions[agent.id] = `(분석 실패: ${msg})`;
        addLog(`⚠️ [${agent.label}] 분석 오류`, 'warn');
        setDiscussion(prev => {
          const updated = [...prev];
          const lastIdx = updated.map(e => e.agentId).lastIndexOf(agent.id);
          if (lastIdx >= 0) updated[lastIdx] = { ...updated[lastIdx], content: `(분석 실패: ${msg})` };
          return updated;
        });
      }
      updateAgent(agent.id, { status: 'idle', currentTask: '' });
    }

    // Morgan(coordinator)의 JSON 결과 파싱
    const coordinatorContent = opinions['auditor'] ?? '';
    try {
      const jsonMatch = coordinatorContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]) as FeedbackResult;
        setFeedbackResult(result);
        addLog(`🔥 [토론 완료] 조치: ${result.action} (${result.priority} 우선순위)`, 'success');
      } else {
        addLog('⚠️ [토론] 결과 파싱 실패 — 토론 내용을 직접 확인하세요', 'warn');
      }
    } catch {
      addLog('⚠️ [토론] 결과 JSON 파싱 오류', 'warn');
    }

    setIsDiscussing(false);
  };

  // ── 파이프라인 피드백: 개선 적용 ─────────────────────────
  const handleApplyFeedback = async () => {
    if (!feedbackResult || isApplying) return;
    setIsApplying(true);

    const { action, revisedPrompt, summary } = feedbackResult;
    addLog(`🚀 [개선 적용] ${action}: ${summary}`, 'info');

    try {
      if (action === 'regenerate-code' || action === 'patch-code') {
        const combinedSpec = revisedPrompt
          ? `${pipeline.spec}\n\n=== 피드백 기반 수정 지시 ===\n${revisedPrompt}`
          : pipeline.spec;
        const newCode = await runWorker(combinedSpec, pipeline.gdd, pipeline.executionPlan ?? undefined);
        await runAuditor(pipeline.gdd, pipeline.spec, newCode);
        addLog(`✅ [개선 완료] 코드 재생성 + 감사 완료`, 'success');
      } else if (action === 'regenerate-spec') {
        addLog(`📋 [안내] SPEC 재작성 필요 → Architect 창에서 재실행하세요`, 'info');
        if (revisedPrompt) addLog(`💬 수정 지시: ${revisedPrompt.slice(0, 200)}`, 'info');
        toggleWindowVisibility('architect');
      } else {
        addLog(`📋 [안내] GDD 재작성 필요 → Planner 창에서 재실행하세요`, 'info');
        if (revisedPrompt) addLog(`💬 수정 지시: ${revisedPrompt.slice(0, 200)}`, 'info');
        toggleWindowVisibility('planner');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`❌ [개선 적용] 오류: ${msg}`, 'error');
    } finally {
      setIsApplying(false);
    }
  };

  // ── 문서 탭: 생성 ────────────────────────────────────────
  const handleGenerateDoc = async () => {
    if (docType === 'spec') {
      setDocPreview(pipeline.spec || '(SPEC 없음)');
      setCanSaveDoc(true);
      return;
    }
    if (!docTitle.trim()) return;

    setIsGenerating(true);
    setCanSaveDoc(false);
    setDocPreview('');

    const agentService = getAgentService();
    let roleId: string;
    let ctx: string;

    if (docType === 'skill') {
      roleId = 'skill_writer';
      ctx = `현재 프로젝트:\n=== GDD/PRD ===\n${pipeline.gdd.slice(0, 2000)}\n\n=== SPEC ===\n${pipeline.spec.slice(0, 2000)}\n\n위 정보를 바탕으로 "${docTitle}" SKILL 문서를 작성하세요.`;
    } else if (docType === 'handoff') {
      roleId = 'handoff_writer';
      ctx = `현재 작업 상태:\n=== GDD/PRD ===\n${pipeline.gdd.slice(0, 1500)}\n\n=== SPEC ===\n${pipeline.spec.slice(0, 1500)}\n생성 파일 수: ${pipeline.generatedCode.length}\n감사 점수: ${pipeline.auditResult?.score ?? 'N/A'}\n\n위 정보를 바탕으로 "${docTitle}" 핸드오프 문서를 작성하세요.`;
    } else {
      // startercode
      roleId = 'startercode_writer';
      const codePreview = pipeline.generatedCode
        .slice(0, 5)
        .map(f => `\`\`\`${f.path}\n${f.content.slice(0, 800)}\n\`\`\``)
        .join('\n\n');
      ctx = `현재 프로토타입 정보:
=== GDD/PRD ===
${pipeline.gdd.slice(0, 1500)}

=== SPEC ===
${pipeline.spec.slice(0, 1500)}

=== 생성된 코드 (${pipeline.generatedCode.length}개 파일 중 일부) ===
${codePreview}

감사 점수: ${pipeline.auditResult?.score ?? 'N/A'}/10

"${docTitle}" StarterCode Pack을 작성하세요.`;
    }

    let content = '';
    try {
      await agentService.executeStream(roleId, ctx, (chunk) => {
        content += chunk;
        setDocPreview(content);
      });
      setCanSaveDoc(true);
      addLog(`📄 [문서 생성] "${docTitle}" 완료`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`❌ [문서 생성] 오류: ${msg}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDoc = () => {
    if (!docPreview) return;
    const doc: SavedDocument = {
      id: String(Date.now()),
      timestamp: Date.now(),
      type: docType,
      title: docTitle || (docType === 'spec' ? 'SPEC 스냅샷' : '문서'),
      content: docPreview,
      domainMode,
    };
    saveDocument(doc);
    refreshDocs();
    addLog(`💾 [보관함] "${doc.title}" 저장 완료`, 'success');
    setCanSaveDoc(false);
    setDocPreview('');
    setDocTitle('');
  };

  // ── 보관함 탭 ────────────────────────────────────────────
  const handleDeleteDoc = (id: string) => {
    deleteDocument(id);
    refreshDocs();
    if (selectedDocId === id) setSelectedDocId(null);
  };

  const filteredDocs = docs.filter(d => archiveFilter === 'all' || d.type === archiveFilter);
  const selectedDoc = docs.find(d => d.id === selectedDocId);

  const tabLabel: Record<Tab, string> = {
    feedback: '소통',
    document: '문서',
    archive: '보관함',
    report: '리포트',
  };

  return (
    <div className="flex flex-col h-full text-xs" style={{ minHeight: 0 }}>
      {/* 탭 헤더 */}
      <div className="flex border-b border-amber-800 mb-2 flex-shrink-0">
        {(['feedback', 'document', 'archive', 'report'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 text-xs font-bold border-r border-amber-800 ${
              tab === t
                ? 'bg-amber-800 text-amber-50'
                : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
            }`}
          >
            {tabLabel[t]}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 소통 ── */}
      {tab === 'feedback' && (
        <div className="flex flex-col flex-1 gap-2 overflow-hidden">
          {/* 모드 토글 */}
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => setFeedbackMode('direct')}
              className={`flex-1 px-2 py-1 text-xs font-bold border border-amber-800 ${
                feedbackMode === 'direct'
                  ? 'bg-amber-800 text-amber-50'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
              }`}
            >
              💬 직접 대화
            </button>
            <button
              onClick={() => setFeedbackMode('pipeline')}
              className={`flex-1 px-2 py-1 text-xs font-bold border border-amber-800 ${
                feedbackMode === 'pipeline'
                  ? 'bg-amber-800 text-amber-50'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
              }`}
            >
              🔥 파이프라인 피드백
            </button>
          </div>

          {/* ─── 직접 대화 모드 ─── */}
          {feedbackMode === 'direct' && (
            <>
              <select
                value={selectedAgent}
                onChange={e => setSelectedAgent(Number(e.target.value))}
                className="win-input text-xs flex-shrink-0"
              >
                {AGENT_OPTIONS.map((opt, i) => (
                  <option key={opt.roleId} value={i}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <div className="flex-1 overflow-y-auto space-y-2 border border-amber-300 rounded p-2 bg-amber-50">
                {chatHistory.length === 0 && (
                  <div className="text-amber-400 text-center mt-4">에이전트에게 메시지를 보내세요</div>
                )}
                {chatHistory.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-amber-600 font-bold text-xs">{msg.agentLabel}</span>
                    <div
                      className={`px-2 py-1 rounded max-w-full whitespace-pre-wrap break-words ${
                        msg.role === 'user'
                          ? 'bg-amber-700 text-white'
                          : 'bg-white border border-amber-300 text-amber-900'
                      }`}
                    >
                      {msg.content || (isSending && i === chatHistory.length - 1 ? '...' : '')}
                    </div>
                    {msg.role === 'assistant' && msg.content && !isSending && (
                      <button
                        onClick={() => handleRegenerate(msg.content, msg.agentIdx)}
                        className="text-xs text-amber-600 hover:text-amber-800 underline"
                      >
                        ↺ 이 피드백으로 재생성
                      </button>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="flex gap-1 flex-shrink-0">
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 win-input text-xs resize-none"
                  rows={2}
                  placeholder="메시지 입력... (Enter: 전송, Shift+Enter: 줄바꿈)"
                  disabled={isSending}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isSending || !message.trim()}
                  className="win-button text-xs px-3"
                >
                  {isSending ? '...' : '전송'}
                </button>
              </div>
            </>
          )}

          {/* ─── 파이프라인 피드백 모드 ─── */}
          {feedbackMode === 'pipeline' && (
            <>
              {/* 파이프라인 현황 배지 */}
              <div className="flex-shrink-0 border border-amber-300 rounded p-2 bg-amber-50">
                <div className="font-bold text-amber-900 mb-1">📊 파이프라인 현황</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={pipeline.gdd ? 'text-green-700 font-bold' : 'text-gray-400'}>
                    GDD {pipeline.gdd ? '✓' : '✗'}
                  </span>
                  <span className={pipeline.spec ? 'text-green-700 font-bold' : 'text-gray-400'}>
                    SPEC {pipeline.spec ? '✓' : '✗'}
                  </span>
                  <span className={pipeline.generatedCode.length > 0 ? 'text-green-700 font-bold' : 'text-gray-400'}>
                    코드 {pipeline.generatedCode.length}개 {pipeline.generatedCode.length > 0 ? '✓' : '✗'}
                  </span>
                  {pipeline.auditResult && (
                    <span className={pipeline.auditResult.score < 5 ? 'text-green-700 font-bold' : 'text-orange-600 font-bold'}>
                      Audit {pipeline.auditResult.score}/10
                    </span>
                  )}
                </div>
                {!pipeline.gdd && (
                  <div className="text-orange-500 text-xs mt-1">⚠️ 파이프라인을 먼저 실행하세요</div>
                )}
              </div>

              {/* 피드백 입력 */}
              <textarea
                value={pipelineFeedback}
                onChange={e => setPipelineFeedback(e.target.value)}
                className="win-input text-xs resize-none flex-shrink-0"
                rows={3}
                placeholder="Live Canvas 결과물에 대한 피드백을 입력하세요...&#10;예) 캐릭터 이동이 너무 빠름, 점프 높이가 낮음, 배경색이 너무 어두움"
                disabled={isDiscussing}
              />

              <button
                onClick={handleStartDiscussion}
                disabled={isDiscussing || !pipelineFeedback.trim() || !pipeline.gdd}
                className="win-button text-xs flex-shrink-0 font-bold disabled:opacity-40"
              >
                {isDiscussing ? '🔄 토론 진행 중...' : '🔥 에이전트 토론 시작 (4명)'}
              </button>

              {/* 토론 로그 */}
              {discussion.length > 0 && (
                <div className="flex-1 overflow-y-auto border border-amber-300 rounded bg-amber-50 p-2 space-y-3 min-h-0">
                  {discussion.map((entry, i) => (
                    <div key={i} className="space-y-1">
                      <div
                        className="font-bold text-amber-900 text-xs border-b border-amber-200 pb-0.5"
                      >
                        {entry.agentLabel}
                      </div>
                      <div className="text-amber-800 whitespace-pre-wrap text-xs leading-relaxed">
                        {entry.content || (
                          isDiscussing ? (
                            <span className="text-amber-400 animate-pulse">💭 분석 중...</span>
                          ) : ''
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={discussionEndRef} />
                </div>
              )}

              {/* 토론 결과 & 적용 버튼 */}
              {feedbackResult && (
                <div className="flex-shrink-0 border-2 border-amber-600 rounded p-2 bg-amber-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-amber-900">{ACTION_LABELS[feedbackResult.action] ?? feedbackResult.action}</span>
                    <span className={`text-xs font-bold ${PRIORITY_COLORS[feedbackResult.priority] ?? ''}`}>
                      [{feedbackResult.priority}]
                    </span>
                  </div>
                  <div className="text-amber-800 text-xs mb-2 leading-relaxed">
                    {feedbackResult.summary}
                  </div>
                  <button
                    onClick={handleApplyFeedback}
                    disabled={isApplying}
                    className="win-button text-xs w-full font-bold disabled:opacity-40"
                  >
                    {isApplying ? '⚙️ 적용 중...' : '✅ 개선 적용'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 탭 2: 문서 요청 ── */}
      {tab === 'document' && (
        <div className="flex flex-col flex-1 gap-2 overflow-hidden">
          {/* 유형 토글 — 2행 */}
          <div className="flex-shrink-0 space-y-1">
            <div className="flex gap-1">
              {(['skill', 'spec'] as DocType[]).map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setDocType(t);
                    setDocPreview('');
                    setCanSaveDoc(false);
                  }}
                  className={`flex-1 px-2 py-1 text-xs font-bold border border-amber-800 ${
                    docType === t ? 'bg-amber-800 text-amber-50' : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                  }`}
                >
                  {t === 'skill' ? 'SKILL 템플릿' : 'SPEC 저장'}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {(['handoff', 'startercode'] as DocType[]).map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setDocType(t);
                    setDocPreview('');
                    setCanSaveDoc(false);
                  }}
                  className={`flex-1 px-2 py-1 text-xs font-bold border border-amber-800 ${
                    docType === t ? 'bg-amber-800 text-amber-50' : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                  }`}
                >
                  {t === 'handoff' ? '핸드오프' : '🚀 StarterCode'}
                </button>
              ))}
            </div>
          </div>

          {/* StarterCode 안내 */}
          {docType === 'startercode' && (
            <div className="flex-shrink-0 text-xs text-amber-700 border border-amber-300 rounded p-2 bg-amber-50">
              프로토타입을 다른 개발 툴로 이어받기 위한 문서를 생성합니다.<br />
              (파일 구조, 핵심 코드, 확장 포인트, 다음 단계 포함)
            </div>
          )}

          {docType !== 'spec' && (
            <input
              value={docTitle}
              onChange={e => setDocTitle(e.target.value)}
              className="win-input text-xs flex-shrink-0"
              placeholder="문서 제목"
            />
          )}

          <button
            onClick={handleGenerateDoc}
            disabled={isGenerating || (docType !== 'spec' && !docTitle.trim())}
            className="win-button text-xs flex-shrink-0 disabled:opacity-40"
          >
            {isGenerating
              ? '생성 중...'
              : docType === 'spec'
              ? '📋 SPEC 불러오기'
              : docType === 'startercode'
              ? '🚀 StarterCode 생성'
              : '✨ AI 생성'}
          </button>

          <textarea
            value={docPreview}
            onChange={e => setDocPreview(e.target.value)}
            className="flex-1 win-input font-mono text-xs resize-none"
            placeholder="생성된 문서가 여기에 표시됩니다..."
            readOnly={isGenerating}
          />

          <button
            onClick={handleSaveDoc}
            disabled={!canSaveDoc || !docPreview}
            className="win-button text-xs flex-shrink-0 disabled:opacity-40"
          >
            💾 문서 저장
          </button>
        </div>
      )}

      {/* ── 탭 3: 보관함 ── */}
      {tab === 'archive' && (
        <div className="flex flex-col flex-1 gap-2 overflow-hidden">
          {/* 필터 — 2행 */}
          <div className="flex-shrink-0 space-y-1">
            <div className="flex gap-1">
              {(['all', 'skill'] as ArchiveFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => { setArchiveFilter(f); setSelectedDocId(null); }}
                  className={`flex-1 px-1 py-1 text-xs font-bold border border-amber-800 ${
                    archiveFilter === f ? 'bg-amber-800 text-amber-50' : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                  }`}
                >
                  {f === 'all' ? '전체' : 'SKILL'}
                </button>
              ))}
              {(['spec', 'handoff', 'startercode'] as ArchiveFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => { setArchiveFilter(f); setSelectedDocId(null); }}
                  className={`flex-1 px-1 py-1 text-xs font-bold border border-amber-800 ${
                    archiveFilter === f ? 'bg-amber-800 text-amber-50' : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                  }`}
                >
                  {f === 'spec' ? 'SPEC' : f === 'handoff' ? '핸드오프' : '🚀'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-1 gap-2 overflow-hidden min-h-0">
            {/* 문서 목록 */}
            <div className="w-1/2 overflow-y-auto border border-amber-300 rounded bg-amber-50 flex-shrink-0">
              {filteredDocs.length === 0 && (
                <div className="text-amber-400 text-center mt-4 p-2">저장된 문서 없음</div>
              )}
              {filteredDocs.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`p-2 cursor-pointer border-b border-amber-200 hover:bg-amber-100 ${
                    selectedDocId === doc.id ? 'bg-amber-200' : ''
                  }`}
                >
                  <div className="font-bold truncate text-xs">{doc.title}</div>
                  <div className="text-amber-600 text-xs">
                    [{doc.type.toUpperCase()}]{' '}
                    {new Date(doc.timestamp).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              ))}
            </div>

            {/* 미리보기 */}
            <div className="flex-1 flex flex-col gap-1 overflow-hidden min-h-0">
              {selectedDoc ? (
                <>
                  <textarea
                    value={selectedDoc.content}
                    readOnly
                    className="flex-1 win-input font-mono text-xs resize-none"
                  />
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedDoc.content)}
                      className="flex-1 win-button text-xs"
                    >
                      📋 복사
                    </button>
                    <button
                      onClick={() => handleDeleteDoc(selectedDoc.id)}
                      className="flex-1 win-button text-xs"
                    >
                      🗑️ 삭제
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-amber-400 text-center mt-4">문서를 선택하세요</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 탭 4: 리포트 프리뷰 ── */}
      {tab === 'report' && (
        <div className="flex flex-col flex-1 gap-2 overflow-hidden">
          <button
            onClick={() => setExpRuns(loadExperimentRuns())}
            className="win-button text-xs flex-shrink-0"
          >
            🔄 실험 목록 새로고침
          </button>

          <div className="flex flex-1 gap-2 overflow-hidden min-h-0">
            {/* 실험 목록 */}
            <div className="w-1/3 overflow-y-auto border border-amber-300 rounded bg-amber-50">
              {expRuns.length === 0 && (
                <div className="text-amber-400 text-center mt-4 p-2">실험 이력 없음</div>
              )}
              {expRuns.filter(r => r.status === 'complete').map(run => (
                <div
                  key={run.id}
                  onClick={() => {
                    setSelectedExpId(run.id);
                    setReportPreview(generateExperimentReport(run));
                  }}
                  className={`p-2 cursor-pointer border-b border-amber-200 hover:bg-amber-100 ${
                    selectedExpId === run.id ? 'bg-amber-200' : ''
                  }`}
                >
                  <div className="font-bold truncate text-xs">{run.config.name}</div>
                  <div className="text-amber-600 text-xs">
                    {new Date(run.timestamp).toLocaleDateString('ko-KR')}
                    {run.auditScore !== null && ` | Score: ${run.auditScore}`}
                  </div>
                </div>
              ))}
            </div>

            {/* 리포트 미리보기 */}
            <div className="flex-1 flex flex-col gap-1 overflow-hidden min-h-0">
              {reportPreview ? (
                <>
                  <textarea
                    value={reportPreview}
                    readOnly
                    className="flex-1 win-input font-mono text-xs resize-none"
                  />
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => navigator.clipboard.writeText(reportPreview)}
                      className="flex-1 win-button text-xs"
                    >
                      📋 복사
                    </button>
                    <button
                      onClick={() => {
                        if (!reportPreview) return;
                        const doc: SavedDocument = {
                          id: String(Date.now()),
                          timestamp: Date.now(),
                          type: 'spec',
                          title: `실험 리포트 — ${expRuns.find(r => r.id === selectedExpId)?.config.name ?? ''}`,
                          content: reportPreview,
                          domainMode,
                        };
                        saveDocument(doc);
                        addLog(`💾 리포트를 보관함에 저장했습니다`, 'success');
                      }}
                      className="flex-1 win-button text-xs"
                    >
                      💾 보관함 저장
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-amber-400 text-center mt-4">완료된 실험을 선택하면 리포트를 미리볼 수 있습니다</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
