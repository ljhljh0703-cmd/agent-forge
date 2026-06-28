import React, { useState, useRef } from 'react';
import { useWindowContext } from '../../context/WindowContext';
import { getAgentService } from '../../services/agent-service';
import { GENRE_TEMPLATES, GenreTemplate } from '../../config/genre-templates';
import { DomainTemplate } from '../../config/domain-mode';

type InputMode = 'idea' | 'text' | 'file';
type ProjectScale = 'small' | 'medium' | 'large';

export const PlannerWindow: React.FC = () => {
  const { addLog, updateAgent, setPipeline, toggleWindowVisibility, domainMode, domainConfig, approvalMode } =
    useWindowContext();

  const isSW = domainMode === 'software';

  // ── 게임 모드 상태 ──────────────────────────────────────
  const [inputMode, setInputMode] = useState<InputMode>('idea');
  const [ideaText, setIdeaText] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<GenreTemplate | null>(null);
  const [gddContent, setGddContent] = useState('');
  const [gddFile, setGddFile] = useState<File | null>(null);

  // ── SW 모드 상태 ────────────────────────────────────────
  const [swDescription, setSwDescription] = useState('');
  const [swTemplate, setSwTemplate] = useState<DomainTemplate | null>(null);
  const [swTechStack, setSwTechStack] = useState('');
  const [swScale, setSwScale] = useState<ProjectScale>('medium');

  // ── 공통 상태 ───────────────────────────────────────────
  const [preview, setPreview] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // 모드 전환 시 초기화
  const resetState = () => {
    setPreview('');
    setIsDone(false);
    setIsGenerating(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 파일 크기 제한 (500KB)
    if (file.size > 500_000) {
      addLog(`파일이 너무 큽니다 (${(file.size / 1024).toFixed(0)}KB). 최대 500KB.`, 'warn');
      e.target.value = '';
      return;
    }
    setGddFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setGddContent(content);
      addLog(`GDD loaded: ${file.name}`, 'success');
    };
    reader.readAsText(file);
  };

  const buildSWPrompt = () => {
    const templateHint = swTemplate
      ? `\n\n템플릿: ${swTemplate.name} (${swTemplate.icon})\nPlanner 힌트: ${swTemplate.hints.planner}`
      : '';
    const techHint = swTechStack.trim()
      ? `\n기술 스택: ${swTechStack.trim()}`
      : '';
    const scaleMap: Record<ProjectScale, string> = {
      small: 'Small (1~3명, 단기 프로젝트)',
      medium: 'Medium (5~10명, 3~6개월)',
      large: 'Large (10명+, 장기 프로젝트)',
    };
    // <user_input> 태그로 사용자 입력을 명확히 구분해 프롬프트 인젝션 완화
    return `다음 소프트웨어 요구사항으로 PRD를 생성하세요:

요구사항:
<user_input>
${swDescription}
</user_input>
${templateHint}${techHint}
프로젝트 규모: ${scaleMap[swScale]}`;
  };

  const handleGenerate = async () => {
    if (isGenerating) return;

    // SW 모드: 텍스트가 없으면 경고
    if (isSW && !swDescription.trim()) {
      addLog('소프트웨어 요구사항을 입력하세요', 'warn');
      return;
    }

    // 게임 text/file 모드: GDD 직접 사용
    if (!isSW && inputMode !== 'idea') {
      if (!gddContent.trim()) {
        addLog('GDD 내용이 비어있습니다', 'warn');
        return;
      }
      setPipeline({ gdd: gddContent, status: 'running' });
      addLog('[Alex] GDD 로드 완료', 'success');
      setIsDone(true);
      return;
    }

    // 게임 idea 모드: 아이디어 입력 확인
    if (!isSW && inputMode === 'idea' && !ideaText.trim()) {
      addLog('게임 아이디어를 입력하세요', 'warn');
      return;
    }

    // AI 생성
    setIsGenerating(true);
    setIsDone(false);
    setPreview('');
    setErrorMsg('');
    abortControllerRef.current = new AbortController();

    const agentRoleId = isSW ? 'planner_sw' : 'planner';
    const label = isSW ? 'PRD' : 'GDD';

    updateAgent('planner', { status: 'writing', currentTask: `${label} 생성 중...` });
    addLog(`[Alex] ${label} 자동 생성 시작...`, 'info');

    let prompt: string;
    if (isSW) {
      prompt = buildSWPrompt();
    } else {
      const genreHint = selectedGenre
        ? `\n장르: ${selectedGenre.nameKo} (${selectedGenre.name})\n장르 힌트: ${selectedGenre.gddHints}\n기본 메카닉: ${selectedGenre.mechanics.join(', ')}`
        : '';
      // <user_input> 태그로 사용자 입력을 명확히 구분해 프롬프트 인젝션 완화
      prompt = `다음 게임 아이디어로 GDD를 생성하세요:\n\n아이디어:\n<user_input>\n${ideaText}\n</user_input>${genreHint}`;
    }

    try {
      const agentService = getAgentService();
      let fullContent = '';

      const response = await agentService.executeStream(agentRoleId, prompt, (chunk) => {
        fullContent += chunk;
        setPreview(fullContent);
      }, abortControllerRef.current.signal);

      // SW 모드는 prd 필드에, 게임 모드는 gdd 필드에 저장
      if (isSW) {
        setPipeline({ gdd: response.content, status: 'running' });  // gdd 필드를 공용으로 사용
      } else {
        setPipeline({ gdd: response.content, status: 'running' });
      }

      addLog(
        `[Alex] ${label} 생성 완료 (${response.content.length}자, ${response.usage.outputTokens} tokens)`,
        'success',
      );
      updateAgent('planner', { status: 'idle', currentTask: '' });
      setIsDone(true);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        addLog('[Alex] 생성이 취소되었습니다', 'warn');
        updateAgent('planner', { status: 'idle', currentTask: '' });
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      addLog(`[Alex] ${label} 생성 실패: ${msg}`, 'error');
      updateAgent('planner', { status: 'error', currentTask: msg });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAccept = () => {
    // 승인 모드에서 편집된 내용 반영
    if (isEditing && editContent.trim()) {
      setPipeline({ gdd: editContent });
      addLog(`${isSW ? 'PRD' : 'GDD'} 수정 사항 반영됨`, 'info');
    }
    setIsEditing(false);
    toggleWindowVisibility('planner');
    toggleWindowVisibility('architect');
    const label = isSW ? 'PRD' : 'GDD';
    addLog(`${label} 승인 → Architect 단계로 진행`, 'success');
  };

  const handleStartEdit = () => {
    setEditContent(preview);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const generateBtnLabel = isGenerating
    ? '생성 중...'
    : isSW
    ? 'Generate PRD'
    : inputMode === 'idea'
    ? 'Generate GDD'
    : '▶ Start Planning';

  return (
    <div className="space-y-2" style={{ minWidth: '340px' }}>
      {/* ── SW 모드 ─────────────────────────────────────── */}
      {isSW ? (
        <>
          {/* 소프트웨어 템플릿 선택 */}
          <div className="border border-win-dark bg-win-light p-1">
            <label className="text-xs font-bold block mb-1">템플릿 선택 (선택적)</label>
            <div className="flex gap-1 flex-wrap">
              {domainConfig.templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSwTemplate(swTemplate?.id === t.id ? null : t)}
                  title={t.description}
                  className={`text-lg p-1 border-2 rounded ${
                    swTemplate?.id === t.id
                      ? 'border-win-blue bg-blue-100'
                      : 'border-win-dark bg-win-gray hover:bg-win-light'
                  }`}
                >
                  {t.icon}
                </button>
              ))}
            </div>
            {swTemplate && (
              <div className="mt-1 text-xs text-gray-600">
                <span className="font-bold">{swTemplate.name}</span>: {swTemplate.description}
              </div>
            )}
          </div>

          {/* 요구사항 입력 */}
          <div className="border border-win-dark bg-win-white p-1">
            <label className="text-xs font-bold block mb-1">소프트웨어 요구사항</label>
            <textarea
              value={swDescription}
              onChange={e => setSwDescription(e.target.value)}
              placeholder={swTemplate?.example ?? '예: 실시간 채팅 앱, 1만 동시접속, React + Node.js'}
              rows={3}
              className="w-full p-1 border border-win-dark font-mono text-xs resize-none"
              style={{ backgroundColor: '#fff' }}
            />
          </div>

          {/* 기술 스택 힌트 */}
          <div className="border border-win-dark bg-win-white p-1">
            <label className="text-xs font-bold block mb-1">기술 스택 (선택적)</label>
            <input
              type="text"
              value={swTechStack}
              onChange={e => setSwTechStack(e.target.value)}
              placeholder="예: React, Node.js, PostgreSQL, Redis"
              className="w-full p-1 border border-win-dark font-mono text-xs"
              style={{ backgroundColor: '#fff' }}
            />
          </div>

          {/* 프로젝트 규모 */}
          <div className="border border-win-dark bg-win-light p-1">
            <label className="text-xs font-bold block mb-1">프로젝트 규모</label>
            <div className="flex gap-3 text-xs">
              {(['small', 'medium', 'large'] as ProjectScale[]).map(s => (
                <label key={s} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="scale"
                    value={s}
                    checked={swScale === s}
                    onChange={() => setSwScale(s)}
                  />
                  {s === 'small' ? 'Small (1~3명)' : s === 'medium' ? 'Medium (5~10명)' : 'Large (10명+)'}
                </label>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* ── 게임 모드 ──────────────────────────────────── */
        <>
          {/* 모드 탭 */}
          <div className="flex gap-1 border border-win-dark bg-win-light p-1">
            {(['idea', 'text', 'file'] as InputMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => { setInputMode(mode); resetState(); }}
                className={`flex-1 text-xs font-bold py-1 px-2 ${
                  inputMode === mode ? 'bg-win-blue text-white' : 'bg-win-gray hover:bg-win-light'
                }`}
              >
                {mode === 'idea' ? 'Idea' : mode === 'text' ? 'Text' : 'File'}
              </button>
            ))}
          </div>

          {inputMode === 'idea' && (
            <>
              {/* 장르 선택 */}
              <div className="border border-win-dark bg-win-light p-1">
                <label className="text-xs font-bold block mb-1">장르 선택 (선택적)</label>
                <div className="flex gap-1 flex-wrap">
                  {GENRE_TEMPLATES.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGenre(selectedGenre?.id === g.id ? null : g)}
                      title={g.description}
                      className={`text-lg p-1 border-2 rounded ${
                        selectedGenre?.id === g.id
                          ? 'border-win-blue bg-blue-100'
                          : 'border-win-dark bg-win-gray hover:bg-win-light'
                      }`}
                    >
                      {g.icon}
                    </button>
                  ))}
                </div>
                {selectedGenre && (
                  <div className="mt-1 text-xs text-gray-600">
                    <span className="font-bold">{selectedGenre.nameKo}</span>: {selectedGenre.mechanics.map(m => `• ${m}`).join('  ')}
                  </div>
                )}
              </div>

              <div className="border border-win-dark bg-win-white p-1">
                <label className="text-xs font-bold block mb-1">게임 아이디어</label>
                <input
                  type="text"
                  value={ideaText}
                  onChange={e => setIdeaText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  placeholder={selectedGenre?.example ?? '예: 탑다운 뷰 로그라이크, 마법사가 주인공, 3스테이지'}
                  className="w-full p-1 border border-win-dark font-mono text-xs"
                  style={{ backgroundColor: '#fff' }}
                />
              </div>
            </>
          )}

          {inputMode === 'text' && (
            <div className="border border-win-dark bg-win-white p-1">
              <label className="text-xs font-bold block mb-1">GDD 텍스트 입력</label>
              <textarea
                value={gddContent}
                onChange={e => setGddContent(e.target.value)}
                placeholder="게임 기획서를 여기에 입력하세요..."
                className="w-full h-40 p-1 border border-win-dark font-mono text-xs resize-none"
                style={{ backgroundColor: '#fff' }}
              />
              <p className="text-xs text-gray-500 mt-1">{gddContent.length}자</p>
            </div>
          )}

          {inputMode === 'file' && (
            <>
              <div className="border border-win-dark bg-win-white p-1">
                <label className="text-xs font-bold block mb-1">GDD 파일 업로드</label>
                <input
                  type="file"
                  accept=".md,.txt,.markdown"
                  onChange={handleFileSelect}
                  className="win-input w-full text-xs"
                />
              </div>
              {gddFile && (
                <div className="border border-win-dark bg-win-white p-1">
                  <p className="text-xs"><span className="font-bold">로드됨:</span> {gddFile.name}</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── 에러 표시 ────────────────────────────────────── */}
      {errorMsg && (
        <div className="border border-red-400 bg-red-50 p-2 rounded">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-red-700">오류 발생</span>
            <button onClick={() => setErrorMsg('')} className="text-xs text-red-400 hover:text-red-600">x</button>
          </div>
          <pre className="text-[11px] text-red-600 font-mono whitespace-pre-wrap break-all max-h-32 overflow-auto">{errorMsg}</pre>
        </div>
      )}

      {/* ── 스트리밍 프리뷰 / 편집 (공통) ─────────────────── */}
      {(preview || isGenerating) && (
        <div className="border border-win-dark bg-win-white p-1">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold">
              {isEditing ? 'Edit Mode' : 'Preview'}{' '}
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
            <div className="h-36 overflow-auto font-mono text-xs whitespace-pre-wrap">
              {preview}
              {isGenerating && <span className="animate-pulse">▋</span>}
            </div>
          )}
        </div>
      )}

      {/* ── 버튼 영역 (공통) ───────────────────────────── */}
      <div className="flex gap-1">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="win-button flex-1 text-xs"
        >
          {generateBtnLabel}
        </button>
        {isGenerating && (
          <button
            onClick={() => { abortControllerRef.current?.abort(); abortControllerRef.current = null; setIsGenerating(false); }}
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
              승인 모드 — 내용을 확인/수정한 뒤 승인하세요
            </div>
          )}
          <button
            onClick={handleAccept}
            className="win-button w-full text-xs font-bold"
            style={{ backgroundColor: '#ccffcc' }}
          >
            {isEditing ? '수정 확정 & Continue to Architect' : '▶ Accept & Continue to Architect'}
          </button>
        </div>
      )}
    </div>
  );
};
