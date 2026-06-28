import React, { useState, useRef, useEffect } from 'react';
import { useWindowContext } from '../../context/WindowContext';
import { getAgentService } from '../../services/agent-service';
import type { ExecutionPlan, CompilerTask, GeneratedFile, AuditResult } from '../../context/WindowContext';

type ApprovalPhase = 'spec' | 'plan-review' | 'code-review' | 'audit-review';

export const ArchitectWindow: React.FC = () => {
  const {
    addLog,
    updateAgent,
    setPipeline,
    pipeline,
    toggleWindowVisibility,
    runCompiler,
    runWorker,
    runAuditor,
    domainMode,
    approvalMode,
  } = useWindowContext();

  const [preview, setPreview] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const abortRef = useRef(false);
  const generatingRef = useRef(false);

  // 승인 모드 체크포인트 상태
  const [approvalPhase, setApprovalPhase] = useState<ApprovalPhase>('spec');
  const [localPlan, setLocalPlan] = useState<ExecutionPlan | null>(null);
  const [editedTasks, setEditedTasks] = useState<CompilerTask[]>([]);
  const [localCode, setLocalCode] = useState<GeneratedFile[]>([]);
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // audit-review 상태
  const [localAudit, setLocalAudit] = useState<AuditResult | null>(null);
  const [editedFixPrompt, setEditedFixPrompt] = useState('');
  const [auditLoopCount, setAuditLoopCount] = useState(0);

  const [errorMsg, setErrorMsg] = useState('');

  const isSW = domainMode === 'software';
  const roleId = isSW ? 'architect_sw' : 'architect';
  const docLabel = isSW ? '아키텍처 문서' : 'SPEC';

  // Planner 결과가 오면 자동 생성 트리거 (승인 모드에서는 수동)
  useEffect(() => {
    if (pipeline.gdd && !generatingRef.current && !isDone && !approvalMode) {
      handleGenerate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.gdd]);

  const handleGenerate = async () => {
    if (generatingRef.current || isGenerating || !pipeline.gdd) return;
    generatingRef.current = true;

    setIsGenerating(true);
    setIsDone(false);
    setPreview('');
    setErrorMsg('');
    setApprovalPhase('spec');
    abortRef.current = false;

    const agentStatus = isSW ? 'researching' : 'researching';
    updateAgent('architect', { status: agentStatus, currentTask: `${docLabel} 생성 중...` });
    addLog(`[Sam] ${docLabel} 자동 생성 시작...`, 'info');

    const inputLabel = isSW ? 'PRD' : 'GDD';
    const prompt = `다음 ${inputLabel}를 기반으로 ${isSW ? '시스템 아키텍처 문서' : '기술 명세서(SPEC)'}를 생성하세요:\n\n${pipeline.gdd}`;

    try {
      const agentService = getAgentService();
      let fullContent = '';

      const response = await agentService.executeStream(roleId, prompt, (chunk) => {
        if (abortRef.current) return;
        fullContent += chunk;
        setPreview(fullContent);
      });

      setPipeline({ spec: response.content });
      addLog(
        `[Sam] ${docLabel} 생성 완료 (${response.content.length}자, ${response.usage.outputTokens} tokens)`,
        'success',
      );
      updateAgent('architect', { status: 'idle', currentTask: '' });
      setIsDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      addLog(`[Sam] ${docLabel} 생성 실패: ${msg}`, 'error');
      updateAgent('architect', { status: 'error', currentTask: msg });
    } finally {
      setIsGenerating(false);
      generatingRef.current = false;
    }
  };

  const handleStartEdit = () => {
    setEditContent(preview);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  // ──── 비승인 모드: 기존 동작 (한번에 실행) ────
  const handleAcceptNonApproval = async () => {
    if (!pipeline.spec || !pipeline.gdd) return;

    addLog(`${docLabel} 승인 → Worker 코드 생성 시작`, 'success');
    toggleWindowVisibility('architect');
    toggleWindowVisibility('terminal');
    toggleWindowVisibility('canvas');

    try {
      setErrorMsg('');
      const plan = await runCompiler(pipeline.gdd, pipeline.spec);
      let code = await runWorker(pipeline.spec, pipeline.gdd, plan);

      let loopCount = 0;
      const MAX_LOOPS = 3;

      while (loopCount < MAX_LOOPS) {
        const audit = await runAuditor(pipeline.gdd, pipeline.spec, code);
        loopCount++;
        setPipeline({ loopCount });

        if (audit.recommendation === 'pass') {
          addLog('모든 검증 통과! 결과물이 Live Canvas에 로드됩니다.', 'success');
          setPipeline({ status: 'complete' });
          break;
        }

        if (loopCount >= MAX_LOOPS) {
          addLog(`최대 루프(${MAX_LOOPS}회) 도달. 현재 결과물로 진행합니다.`, 'warn');
          setPipeline({ status: 'complete' });
          break;
        }

        addLog(`[Morgan→Casey] 수정 요청 (${loopCount}/${MAX_LOOPS}) — ${audit.recommendation}`, 'warn');
        code = await runWorker(pipeline.spec, pipeline.gdd, plan);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      addLog(`파이프라인 실행 실패: ${msg}`, 'error');
      setPipeline({ status: 'error' });
    }
  };

  // ──── 승인 모드: SPEC 승인 → Compiler만 실행 ────
  const handleApproveSpec = async () => {
    if (!pipeline.spec || !pipeline.gdd) return;

    // 편집 내용 반영
    if (isEditing && editContent.trim()) {
      setPipeline({ spec: editContent });
      addLog(`${docLabel} 수정 사항 반영됨`, 'info');
    }
    setIsEditing(false);
    setIsRunning(true);

    addLog(`${docLabel} 승인 → 실행 계획(Execution Plan) 생성 시작`, 'success');
    toggleWindowVisibility('terminal');

    try {
      const spec = isEditing && editContent.trim() ? editContent : pipeline.spec;
      const plan = await runCompiler(pipeline.gdd, spec);
      setLocalPlan(plan);
      setEditedTasks(plan.tasks.map(t => ({ ...t })));
      setApprovalPhase('plan-review');
      addLog(`실행 계획 생성 완료 — ${plan.tasks.length}개 태스크. 검토 후 승인하세요.`, 'info');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      addLog(`실행 계획 생성 실패: ${msg}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  // ──── 승인 모드: 플랜 승인 → Worker 실행 ────
  const handleApprovePlan = async () => {
    if (!pipeline.spec || !pipeline.gdd || !localPlan) return;

    setIsRunning(true);

    // 수정된 태스크 반영
    const updatedPlan: ExecutionPlan = {
      ...localPlan,
      tasks: editedTasks,
    };
    setLocalPlan(updatedPlan);
    setPipeline({ executionPlan: updatedPlan });

    addLog(`실행 계획 승인 → 코드 생성 시작 (${updatedPlan.tasks.length}개 태스크)`, 'success');
    toggleWindowVisibility('canvas');

    try {
      const code = await runWorker(pipeline.spec, pipeline.gdd, updatedPlan);
      setLocalCode(code);
      setSelectedFileIdx(0);
      setApprovalPhase('code-review');
      addLog(`코드 생성 완료 — ${code.length}개 파일. 검토 후 승인하세요.`, 'info');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      addLog(`코드 생성 실패: ${msg}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  // ──── 승인 모드: 코드 승인 → Auditor 1회 실행 → non-pass면 audit-review ────
  const handleApproveCode = async () => {
    if (!pipeline.spec || !pipeline.gdd) return;

    setIsRunning(true);
    setAuditLoopCount(0);
    addLog(`코드 승인 → QA 검증 시작`, 'success');

    try {
      const audit = await runAuditor(pipeline.gdd, pipeline.spec, localCode);
      const newLoop = 1;
      setAuditLoopCount(newLoop);
      setPipeline({ loopCount: newLoop });

      if (audit.recommendation === 'pass') {
        addLog('모든 검증 통과! 결과물이 Live Canvas에 로드됩니다.', 'success');
        setPipeline({ status: 'complete' });
        toggleWindowVisibility('architect');
      } else {
        // audit-review 페이즈로 전환
        setLocalAudit(audit);
        setEditedFixPrompt(audit.fixPrompt);
        setApprovalPhase('audit-review');
        addLog(`감사 결과 검토 필요 — Debt Score: ${audit.score}/10`, 'warn');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      addLog(`QA 검증 실패: ${msg}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const MAX_AUDIT_LOOPS = 3;

  // ──── audit-review: 자동 수정 ────
  const handleAutoFix = async () => {
    if (!pipeline.spec || !pipeline.gdd || !localAudit) return;

    setIsRunning(true);
    const newLoop = auditLoopCount + 1;

    if (newLoop > MAX_AUDIT_LOOPS) {
      addLog(`최대 루프(${MAX_AUDIT_LOOPS}회) 도달. 현재 결과물로 진행합니다.`, 'warn');
      setPipeline({ status: 'complete' });
      toggleWindowVisibility('architect');
      setIsRunning(false);
      return;
    }

    addLog(`자동 수정 시작 (${newLoop}/${MAX_AUDIT_LOOPS}) — fixPrompt 사용`, 'info');

    try {
      const code = await runWorker(pipeline.spec, pipeline.gdd, localPlan ?? undefined);
      setLocalCode(code);

      const audit = await runAuditor(pipeline.gdd, pipeline.spec, code);
      setAuditLoopCount(newLoop);
      setPipeline({ loopCount: newLoop });

      if (audit.recommendation === 'pass') {
        addLog('자동 수정 후 검증 통과!', 'success');
        setPipeline({ status: 'complete' });
        toggleWindowVisibility('architect');
      } else {
        setLocalAudit(audit);
        setEditedFixPrompt(audit.fixPrompt);
        addLog(`자동 수정 후에도 문제 존재 — Debt Score: ${audit.score}/10`, 'warn');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      addLog(`자동 수정 실패: ${msg}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  // ──── audit-review: 사용자 지시로 수정 ────
  const handleFixWithInput = async () => {
    if (!pipeline.spec || !pipeline.gdd) return;

    setIsRunning(true);
    const newLoop = auditLoopCount + 1;

    if (newLoop > MAX_AUDIT_LOOPS) {
      addLog(`최대 루프(${MAX_AUDIT_LOOPS}회) 도달. 현재 결과물로 진행합니다.`, 'warn');
      setPipeline({ status: 'complete' });
      toggleWindowVisibility('architect');
      setIsRunning(false);
      return;
    }

    // 편집된 fixPrompt를 spec에 추가하여 Worker 재실행
    const augmentedSpec = `${pipeline.spec}\n\n=== 사용자 수정 지시 ===\n${editedFixPrompt}`;
    addLog(`사용자 수정 지시 반영 → Worker 재실행 (${newLoop}/${MAX_AUDIT_LOOPS})`, 'info');

    try {
      const code = await runWorker(augmentedSpec, pipeline.gdd, localPlan ?? undefined);
      setLocalCode(code);

      const audit = await runAuditor(pipeline.gdd, pipeline.spec, code);
      setAuditLoopCount(newLoop);
      setPipeline({ loopCount: newLoop });

      if (audit.recommendation === 'pass') {
        addLog('사용자 지시 반영 후 검증 통과!', 'success');
        setPipeline({ status: 'complete' });
        toggleWindowVisibility('architect');
      } else {
        setLocalAudit(audit);
        setEditedFixPrompt(audit.fixPrompt);
        addLog(`수정 후에도 문제 존재 — Debt Score: ${audit.score}/10`, 'warn');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      addLog(`수정 실패: ${msg}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  // ──── audit-review: 현재 결과 그대로 수락 ────
  const handleAcceptAsIs = () => {
    addLog('현재 결과물 그대로 수락', 'info');
    setPipeline({ status: 'complete' });
    toggleWindowVisibility('architect');
  };

  // ──── 통합 Accept 핸들러 ────
  const handleAccept = async () => {
    if (!pipeline.spec || !pipeline.gdd) return;

    if (!approvalMode) {
      await handleAcceptNonApproval();
      return;
    }

    // 승인 모드: phase별 분기
    if (approvalPhase === 'spec') {
      await handleApproveSpec();
    }
  };

  // 태스크 프롬프트 수정 핸들러
  const handleTaskPromptChange = (taskIdx: number, newPrompt: string) => {
    setEditedTasks(prev => prev.map((t, i) => i === taskIdx ? { ...t, prompt: newPrompt } : t));
  };

  const difficultyColor = (d: string) => {
    switch (d) {
      case 'HIGH': return 'bg-red-100 text-red-700 border-red-300';
      case 'MID': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'LOW': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  // ──── Plan Review UI ────
  const renderPlanReview = () => {
    if (!localPlan) return null;

    return (
      <div className="space-y-2">
        <div className="text-xs text-blue-600 bg-blue-50 border border-blue-300 rounded px-2 py-1">
          승인 모드 — 실행 계획을 검토하세요. 태스크 프롬프트를 수정할 수 있습니다.
        </div>

        {/* 프로젝트 요약 */}
        <div className="border border-win-dark bg-win-light p-2">
          <div className="text-xs font-bold">{localPlan.projectName}</div>
          <div className="text-xs text-gray-500">총 {localPlan.totalTasks}개 태스크</div>
        </div>

        {/* 태스크 목록 */}
        <div className="space-y-1 max-h-64 overflow-auto">
          {editedTasks.map((task, idx) => (
            <div key={task.id} className="border border-win-dark bg-win-white p-1.5">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs font-bold text-gray-500">#{task.id}</span>
                <span className="text-xs font-bold flex-1 truncate">{task.title}</span>
                <span className={`text-[10px] px-1 border rounded ${difficultyColor(task.difficulty)}`}>
                  {task.difficulty}
                </span>
              </div>
              <div className="text-[10px] text-gray-400 mb-1">
                {task.targetFiles.join(', ')}
              </div>
              <textarea
                value={task.prompt}
                onChange={e => handleTaskPromptChange(idx, e.target.value)}
                className="w-full h-16 p-1 border border-gray-300 font-mono text-[11px] resize-none bg-gray-50 focus:border-blue-400 focus:bg-blue-50"
                style={{ outline: 'none' }}
              />
            </div>
          ))}
        </div>

        {/* 플랜 승인 버튼 */}
        <button
          onClick={handleApprovePlan}
          disabled={isRunning}
          className="win-button w-full text-xs font-bold"
          style={{ backgroundColor: '#ccffcc' }}
        >
          {isRunning ? '코드 생성 중...' : `플랜 승인 & ${isSW ? 'Boilerplate' : '코드'} 생성`}
        </button>
      </div>
    );
  };

  // ──── Code Review UI ────
  const renderCodeReview = () => {
    if (localCode.length === 0) return null;

    const selectedFile = localCode[selectedFileIdx];
    const lineCount = (f: GeneratedFile) => f.content.split('\n').length;

    return (
      <div className="space-y-2">
        <div className="text-xs text-purple-600 bg-purple-50 border border-purple-300 rounded px-2 py-1">
          승인 모드 — 생성된 코드를 검토하세요. 승인하면 QA 검증이 시작됩니다.
        </div>

        {/* 파일 리스트 */}
        <div className="border border-win-dark bg-win-light p-1">
          <div className="text-xs font-bold mb-1">생성된 파일 ({localCode.length})</div>
          <div className="space-y-0.5 max-h-24 overflow-auto">
            {localCode.map((file, idx) => (
              <button
                key={file.path}
                onClick={() => setSelectedFileIdx(idx)}
                className={`w-full text-left text-[11px] px-1 py-0.5 rounded flex justify-between items-center ${
                  idx === selectedFileIdx
                    ? 'bg-win-blue text-win-white font-bold'
                    : 'hover:bg-gray-200'
                }`}
              >
                <span className="truncate">{file.path}</span>
                <span className="text-[10px] text-gray-400 ml-1 shrink-0">
                  {lineCount(file)}줄
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 코드 프리뷰 */}
        {selectedFile && (
          <div className="border border-win-dark bg-win-white p-1">
            <div className="text-xs font-bold mb-1 text-gray-600">
              {selectedFile.path}
            </div>
            <pre className="h-48 overflow-auto font-mono text-[11px] whitespace-pre-wrap bg-gray-50 p-1 border border-gray-200">
              {selectedFile.content}
            </pre>
          </div>
        )}

        {/* 코드 승인 버튼 */}
        <button
          onClick={handleApproveCode}
          disabled={isRunning}
          className="win-button w-full text-xs font-bold"
          style={{ backgroundColor: '#ccffcc' }}
        >
          {isRunning ? 'QA 검증 중...' : '코드 승인 & QA 검증'}
        </button>
      </div>
    );
  };

  // ──── Audit Review UI ────
  const renderAuditReview = () => {
    if (!localAudit) return null;

    const passedCount = localAudit.checks.filter(c => c.passed).length;
    const failedCount = localAudit.checks.filter(c => !c.passed).length;

    return (
      <div className="space-y-2">
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-300 rounded px-2 py-1">
          승인 모드 — 감사 결과 검토 ({auditLoopCount}/{MAX_AUDIT_LOOPS})
        </div>

        {/* Debt Score */}
        <div className="border border-win-dark bg-win-light p-2">
          <div className="flex items-start gap-3">
            <div style={{
              width: '56px', height: '56px', borderRadius: '8px',
              backgroundColor: localAudit.score <= 3 ? '#dcfce7' : localAudit.score <= 6 ? '#fef9c3' : '#fee2e2',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: '22px', fontWeight: 800,
                color: localAudit.score <= 3 ? '#15803d' : localAudit.score <= 6 ? '#a16207' : '#dc2626',
              }}>
                {localAudit.score}
              </span>
              <span style={{ fontSize: '9px', color: '#6b7280' }}>/10</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold mb-1">Debt Score</div>
              <div className="text-[11px] text-gray-600 leading-tight">{localAudit.summary}</div>
              <div className="text-[10px] mt-1 text-gray-400">
                {passedCount} 통과 / {failedCount} 실패
              </div>
            </div>
          </div>
        </div>

        {/* 검증 항목 */}
        <div className="border border-win-dark bg-win-white p-2">
          <div className="text-xs font-bold mb-1">검증 항목</div>
          <div className="space-y-0.5 max-h-32 overflow-auto">
            {localAudit.checks.map((check, idx) => (
              <div key={idx} className="flex items-start gap-1 text-[11px]">
                <span className="shrink-0 font-bold" style={{ color: check.passed ? 'var(--ok)' : '#E01E5A' }}>{check.passed ? 'ok' : 'no'}</span>
                <span className="text-gray-400 shrink-0">[{check.category}]</span>
                <span className={check.passed ? 'text-gray-600' : 'text-red-600 font-medium'}>
                  {check.item}
                  {!check.passed && check.detail && (
                    <span className="text-gray-400"> — {check.detail}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 수정 지시 (편집 가능) */}
        {localAudit.fixPrompt && (
          <div className="border border-win-dark bg-win-white p-2">
            <div className="text-xs font-bold mb-1">수정 지시 (편집 가능)</div>
            <textarea
              value={editedFixPrompt}
              onChange={e => setEditedFixPrompt(e.target.value)}
              className="w-full h-20 p-1.5 border border-gray-300 font-mono text-[11px] resize-none bg-gray-50 focus:border-blue-400 focus:bg-blue-50"
              style={{ outline: 'none' }}
            />
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-1">
          <button
            onClick={handleAutoFix}
            disabled={isRunning}
            className="win-button flex-1 text-xs font-bold"
            style={{ backgroundColor: '#dbeafe' }}
          >
            {isRunning ? '수정 중...' : '자동 수정'}
          </button>
          <button
            onClick={handleFixWithInput}
            disabled={isRunning || !editedFixPrompt.trim()}
            className="win-button flex-1 text-xs font-bold"
            style={{ backgroundColor: '#fef3c7' }}
          >
            {isRunning ? '수정 중...' : '내 지시로'}
          </button>
          <button
            onClick={handleAcceptAsIs}
            disabled={isRunning}
            className="win-button flex-1 text-xs font-bold"
            style={{ backgroundColor: '#ccffcc' }}
          >
            수락
          </button>
        </div>
      </div>
    );
  };

  // ── 에러 표시 컴포넌트 ──
  const renderError = () => errorMsg ? (
    <div className="border border-red-400 bg-red-50 p-2 rounded">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-red-700">오류 발생</span>
        <button onClick={() => setErrorMsg('')} className="text-xs text-red-400 hover:text-red-600">x</button>
      </div>
      <pre className="text-[11px] text-red-600 font-mono whitespace-pre-wrap break-all max-h-32 overflow-auto">{errorMsg}</pre>
    </div>
  ) : null;

  // ──── 승인 모드에서 plan-review / code-review / audit-review 상태일 때 ────
  if (approvalMode && approvalPhase === 'audit-review') {
    return (
      <div className="space-y-2" style={{ minWidth: '340px' }}>
        {renderError()}
        {renderAuditReview()}
      </div>
    );
  }

  if (approvalMode && approvalPhase === 'plan-review') {
    return (
      <div className="space-y-2" style={{ minWidth: '340px' }}>
        {renderError()}
        {renderPlanReview()}
      </div>
    );
  }

  if (approvalMode && approvalPhase === 'code-review') {
    return (
      <div className="space-y-2" style={{ minWidth: '340px' }}>
        {renderError()}
        {renderCodeReview()}
      </div>
    );
  }

  // ──── 기본 UI (spec phase) ────
  return (
    <div className="space-y-2" style={{ minWidth: '340px' }}>
      {renderError()}

      {/* 입력 문서 요약 */}
      {pipeline.gdd && (
        <div className="border border-win-dark bg-win-light p-1">
          <label className="text-xs font-bold block mb-1">
            {isSW ? 'PRD' : 'GDD'} 입력
          </label>
          <div className="h-16 overflow-auto font-mono text-xs whitespace-pre-wrap text-gray-600">
            {pipeline.gdd.slice(0, 300)}
            {pipeline.gdd.length > 300 && '...'}
          </div>
        </div>
      )}

      {/* 출력 미리보기 / 편집 */}
      {(preview || isGenerating) && (
        <div className="border border-win-dark bg-win-white p-1">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold">
              {isEditing ? `${docLabel} Edit Mode` : `${docLabel} Preview`}{' '}
              {isGenerating && <span className="text-blue-500 animate-pulse">생성 중...</span>}
            </label>
            {isDone && approvalMode && !isGenerating && (
              <div className="flex gap-1">
                {!isEditing ? (
                  <button onClick={handleStartEdit} className="text-xs text-blue-600 hover:underline font-bold">수정</button>
                ) : (
                  <button onClick={handleCancelEdit} className="text-xs text-gray-500 hover:underline">취소</button>
                )}
              </div>
            )}
          </div>
          {isEditing ? (
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full h-48 p-1 border border-blue-400 font-mono text-xs resize-none bg-blue-50"
              style={{ outline: 'none' }}
            />
          ) : (
            <div className="h-48 overflow-auto font-mono text-xs whitespace-pre-wrap">
              {preview}
              {isGenerating && <span className="animate-pulse">▋</span>}
            </div>
          )}
        </div>
      )}

      {!pipeline.gdd && (
        <div className="border border-win-dark bg-win-white p-2 text-center text-xs text-gray-500">
          Planner에서 {isSW ? 'PRD' : 'GDD'}를 먼저 생성하세요.
        </div>
      )}

      {/* 승인 모드: GDD 도착 + 아직 미생성 시 대기 안내 */}
      {pipeline.gdd && !preview && !isGenerating && !isDone && approvalMode && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-300 rounded px-2 py-1">
          승인 모드 — {isSW ? 'PRD' : 'GDD'}가 확인되었습니다. 아래 버튼으로 {docLabel} 생성을 시작하세요.
        </div>
      )}

      {/* 버튼 */}
      <div className="flex gap-1">
        {pipeline.gdd && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="win-button flex-1 text-xs"
          >
            {isGenerating ? '생성 중...' : `Re-generate ${docLabel}`}
          </button>
        )}
        {isGenerating && (
          <button
            onClick={() => { abortRef.current = true; setIsGenerating(false); }}
            className="win-button text-xs px-2"
            style={{ backgroundColor: '#ffcccc' }}
          >
            x
          </button>
        )}
      </div>

      {isDone && (
        <div className="space-y-1">
          {approvalMode && !isEditing && (
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-300 rounded px-2 py-1">
              승인 모드 — {docLabel}를 확인/수정한 뒤 승인하세요
            </div>
          )}
          <button
            onClick={handleAccept}
            disabled={isRunning}
            className="win-button w-full text-xs font-bold"
            style={{ backgroundColor: '#ccffcc' }}
          >
            {isRunning
              ? '실행 계획 생성 중...'
              : isEditing
                ? `수정 확정 & ${approvalMode ? '실행 계획 생성' : `Generate ${isSW ? 'Boilerplate' : 'Game Code'}`}`
                : approvalMode
                  ? `▶ ${docLabel} 승인 & 실행 계획 생성`
                  : `▶ Accept & Generate ${isSW ? 'Boilerplate' : 'Game Code'}`}
          </button>
        </div>
      )}
    </div>
  );
};
