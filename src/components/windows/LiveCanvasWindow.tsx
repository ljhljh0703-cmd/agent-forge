import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useWindowContext } from '../../context/WindowContext';
import { assembleGame } from '../../utils/code-extractor';
import { MermaidDiagram } from '../../utils/code-extractor';
import { detectLanguage, extToHighlightLang } from '../../utils/language-detector';

type SWTab = 'diagrams' | 'files' | 'code' | 'setup';

/**
 * Mermaid가 렌더링한 SVG에서 XSS 벡터를 제거한다.
 * - <script> 태그 제거
 * - on* 이벤트 핸들러 속성 제거
 * - javascript: URI 제거
 * - data:text/html URI 제거
 */
function sanitizeSVG(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '');
}

// ──────────────────────────────────────────────────────────
// 게임 모드: Blob URL iframe 렌더러
// ──────────────────────────────────────────────────────────
const GameCanvas: React.FC = () => {
  const { pipeline, addLog } = useWindowContext();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasGame, setHasGame] = useState(false);
  const [showRuntimeTooltip, setShowRuntimeTooltip] = useState(false);

  useEffect(() => {
    const files = pipeline.generatedCode;
    if (!files || files.length === 0) return;

    try {
      const html = assembleGame(files);
      const blob = new Blob([html], { type: 'text/html' });

      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      if (iframeRef.current) iframeRef.current.src = url;

      setHasGame(true);
      setError(null);
      addLog('🎮 Live Canvas: 생성된 게임 로드 완료', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      addLog(`❌ Live Canvas 렌더링 실패: ${msg}`, 'error');
    }

    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.generatedCode]);

  const handleReload = () => {
    if (iframeRef.current && blobUrlRef.current) iframeRef.current.src = blobUrlRef.current;
  };

  const handleDownload = () => {
    const files = pipeline.generatedCode;
    if (!files || files.length === 0) return;
    const html = assembleGame(files);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'game.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenTab = () => {
    if (blobUrlRef.current) window.open(blobUrlRef.current, '_blank');
  };

  return (
    <div className="flex flex-col" style={{ width: '480px', height: '380px' }}>
      <div className="flex-1 border border-win-dark bg-black overflow-hidden">
        {error ? (
          <div className="w-full h-full flex items-center justify-center text-red-400 font-mono text-xs p-2">
            <div>
              <div className="font-bold mb-1">❌ 렌더링 오류</div>
              <div className="whitespace-pre-wrap">{error}</div>
            </div>
          </div>
        ) : !hasGame ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400 font-mono text-xs">
            <div className="text-center">
              <div className="text-2xl mb-2">🎮</div>
              <div>게임이 생성되면 여기에 표시됩니다</div>
            </div>
          </div>
        ) : (
          <iframe ref={iframeRef} className="w-full h-full border-0" title="Live Game Preview" sandbox="allow-scripts" />
        )}
      </div>
      <div className="flex gap-1 p-1 bg-win-gray border-t border-win-dark items-center">
        <button onClick={handleReload} disabled={!hasGame} className="win-button text-xs flex-1 disabled:opacity-40">🔄 Reload</button>
        <button onClick={handleDownload} disabled={!hasGame} className="win-button text-xs flex-1 disabled:opacity-40">📥 Download</button>
        <button onClick={handleOpenTab} disabled={!hasGame} className="win-button text-xs flex-1 disabled:opacity-40">🔗 Open Tab</button>
        {pipeline.runtimeReport && (
          <div className="relative">
            <button
              onClick={() => setShowRuntimeTooltip(prev => !prev)}
              className={`text-xs font-bold px-2 py-0.5 rounded border ${
                pipeline.runtimeReport.errors.length === 0
                  ? 'bg-green-100 border-green-400 text-green-700'
                  : 'bg-red-100 border-red-400 text-red-700'
              }`}
            >
              {pipeline.runtimeReport.errors.length === 0
                ? '✅ Runtime OK'
                : `❌ ${pipeline.runtimeReport.errors.length} errors`}
            </button>
            {showRuntimeTooltip && pipeline.runtimeReport.errors.length > 0 && (
              <div className="absolute bottom-full right-0 mb-1 w-64 max-h-40 overflow-auto bg-white border border-win-dark shadow-md rounded p-2 text-xs font-mono z-50">
                <div className="font-bold text-red-600 mb-1">Runtime Errors:</div>
                {pipeline.runtimeReport.errors.map((err, i) => (
                  <div key={i} className="text-red-500 mb-0.5">{err}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────
// SW 모드: Mermaid 다이어그램 + 파일 트리 + 코드 프리뷰
// ──────────────────────────────────────────────────────────
const MermaidView: React.FC<{ diagram: MermaidDiagram | undefined }> = ({ diagram }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!diagram?.code) { setSvg(''); setErr(''); return; }

    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });

        // Gemini가 종종 생성하는 문법 오류 자동 정제
        const code = diagram.code
          .replace(/```mermaid\s*/g, '')   // 중첩된 코드 펜스 제거
          .replace(/```\s*$/g, '')
          .replace(/\t/g, '    ')          // 탭 → 스페이스
          .trim();

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const { svg: rendered } = await mermaid.render(id, code);
        if (!cancelled) { setSvg(rendered); setErr(''); }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setErr(msg);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [diagram]);

  if (!diagram) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-xs">
        다이어그램이 없습니다. Architect를 실행하세요.
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-2 text-xs font-mono overflow-auto h-full">
        <div className="font-bold mb-1 text-red-500">⚠️ Mermaid 렌더링 오류</div>
        <pre className="whitespace-pre-wrap text-red-400 mb-2 text-[11px]">{err}</pre>
        <div className="font-bold mb-1 text-gray-600">📝 원본 Mermaid 코드:</div>
        <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-2 border rounded">{diagram.code}</pre>
      </div>
    );
  }

  if (!svg) {
    return <div className="flex items-center justify-center h-full text-xs text-gray-400">⏳ 렌더링 중...</div>;
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto p-2 bg-white"
      dangerouslySetInnerHTML={{ __html: sanitizeSVG(svg) }}
    />
  );
};

// 언어 배지 색상
const LANG_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-100 text-blue-700',
  'TypeScript (React)': 'bg-blue-100 text-blue-700',
  JavaScript: 'bg-yellow-100 text-yellow-700',
  'JavaScript (React)': 'bg-yellow-100 text-yellow-700',
  Python: 'bg-green-100 text-green-700',
  HTML: 'bg-orange-100 text-orange-700',
  CSS: 'bg-purple-100 text-purple-700',
  SCSS: 'bg-pink-100 text-pink-700',
  JSON: 'bg-gray-100 text-gray-700',
  YAML: 'bg-red-100 text-red-600',
  SQL: 'bg-indigo-100 text-indigo-700',
  Shell: 'bg-gray-200 text-gray-800',
  Markdown: 'bg-gray-100 text-gray-600',
  Go: 'bg-cyan-100 text-cyan-700',
  Rust: 'bg-orange-100 text-orange-800',
  Java: 'bg-red-100 text-red-700',
  Dockerfile: 'bg-blue-200 text-blue-800',
  Environment: 'bg-yellow-200 text-yellow-800',
};

// 클립보드 복사 헬퍼
function useCopyFeedback() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  }, []);
  return { copiedKey, copy };
}

const FileTree: React.FC<{
  files: { path: string; content: string; taskId: number }[];
  onSelect: (path: string) => void;
  selected: string;
}> = ({ files, onSelect, selected }) => {
  const [filter, setFilter] = useState('');
  const { copiedKey, copy } = useCopyFeedback();

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-xs">
        생성된 파일이 없습니다.
      </div>
    );
  }

  const filtered = filter
    ? files.filter(f => f.path.toLowerCase().includes(filter.toLowerCase()))
    : files;
  const totalLines = files.reduce((acc, f) => acc + f.content.split('\n').length, 0);

  return (
    <div className="flex flex-col h-full">
      {/* 검색 필터 */}
      <div className="border-b border-win-dark p-1">
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="🔍 파일 검색..."
          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:border-blue-400"
        />
      </div>

      <div className="flex-1 overflow-auto font-mono text-xs p-1">
        {filtered.map(f => {
          const lines = f.content.split('\n').length;
          const depth = (f.path.match(/\//g) ?? []).length;
          const lang = detectLanguage(f.path);
          const badgeColor = LANG_COLORS[lang] ?? 'bg-gray-100 text-gray-600';

          return (
            <div
              key={f.path}
              className={`flex items-center gap-1 py-0.5 px-1 cursor-pointer rounded hover:bg-blue-50 group ${
                selected === f.path ? 'bg-blue-100 font-bold' : ''
              }`}
              style={{ paddingLeft: `${4 + depth * 12}px` }}
            >
              <span onClick={() => onSelect(f.path)} className="flex items-center gap-1 flex-1 min-w-0">
                <span>{f.path.endsWith('/') ? '📁' : '📄'}</span>
                <span className="truncate">{f.path.split('/').pop()}</span>
                <span className={`px-1 rounded text-[9px] shrink-0 ${badgeColor}`}>{lang}</span>
              </span>
              <span className="text-gray-400 shrink-0">({lines}줄)</span>
              <button
                onClick={e => { e.stopPropagation(); copy(f.content, f.path); }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-500 shrink-0 transition-opacity"
                title="파일 복사"
              >
                {copiedKey === f.path ? '✅' : '📋'}
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-4">검색 결과 없음</div>
        )}
      </div>
      <div className="border-t border-win-dark p-1 text-xs text-gray-500">
        총 {files.length}개 파일 | {totalLines}줄{filter && ` | ${filtered.length}개 표시`}
      </div>
    </div>
  );
};

// ── 코드 뷰어: 구문 하이라이팅 + 라인 넘버 ──
const HighlightedCode: React.FC<{ code: string; filename: string }> = ({ code, filename }) => {
  const [html, setHtml] = useState('');
  const lang = extToHighlightLang(filename);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hljs = (await import('highlight.js')).default;
        const result = hljs.getLanguage(lang)
          ? hljs.highlight(code, { language: lang })
          : hljs.highlightAuto(code);
        if (!cancelled) setHtml(result.value);
      } catch {
        if (!cancelled) setHtml('');
      }
    })();
    return () => { cancelled = true; };
  }, [code, lang]);

  const lines = code.split('\n');

  return (
    <div className="font-mono text-xs leading-relaxed">
      <style>{`
        .sw-code-line { display: flex; }
        .sw-code-line:hover { background: #f0f7ff; }
        .sw-line-num {
          counter-increment: line;
          color: #999;
          text-align: right;
          padding-right: 8px;
          user-select: none;
          min-width: 32px;
          flex-shrink: 0;
          border-right: 1px solid #e5e7eb;
          margin-right: 8px;
        }
      `}</style>
      {html ? (
        // highlight.js 렌더 결과를 줄 단위 분할
        <pre className="p-0 m-0 bg-transparent"><code>
          {lines.map((_, i) => {
            // 원본 줄과 매핑
            const lineHtml = (() => {
              // 간단한 방식: 전체 렌더링 후 줄 분할
              const allLines = html.split('\n');
              return allLines[i] ?? '';
            })();
            return (
              <div key={i} className="sw-code-line">
                <span className="sw-line-num">{i + 1}</span>
                <span className="flex-1 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: lineHtml }} />
              </div>
            );
          })}
        </code></pre>
      ) : (
        <pre className="p-0 m-0 bg-transparent"><code>
          {lines.map((line, i) => (
            <div key={i} className="sw-code-line">
              <span className="sw-line-num">{i + 1}</span>
              <span className="flex-1 whitespace-pre-wrap">{line}</span>
            </div>
          ))}
        </code></pre>
      )}
    </div>
  );
};

// ── Setup 탭: 프로젝트 정보 자동 감지 ──
interface ProjectInfo {
  name: string;
  stack: string[];
  setupCommands: { label: string; cmd: string }[];
  envVars: string[];
  readmePreview: string;
}

function analyzeProject(files: { path: string; content: string }[]): ProjectInfo {
  const info: ProjectInfo = { name: 'project', stack: [], setupCommands: [], envVars: [], readmePreview: '' };
  const fileMap = new Map(files.map(f => [f.path.toLowerCase(), f.content]));

  // package.json 분석
  const pkgPaths = ['package.json', 'frontend/package.json', 'client/package.json'];
  for (const p of pkgPaths) {
    const pkg = fileMap.get(p);
    if (pkg) {
      try {
        const parsed = JSON.parse(pkg);
        info.name = parsed.name ?? info.name;

        // 기술 스택 감지
        const allDeps = { ...parsed.dependencies, ...parsed.devDependencies };
        if (allDeps?.react) info.stack.push('React');
        if (allDeps?.next) info.stack.push('Next.js');
        if (allDeps?.vue) info.stack.push('Vue');
        if (allDeps?.express) info.stack.push('Express');
        if (allDeps?.nestjs || allDeps?.['@nestjs/core']) info.stack.push('NestJS');
        if (allDeps?.typescript) info.stack.push('TypeScript');
        if (allDeps?.tailwindcss) info.stack.push('Tailwind CSS');
        if (allDeps?.prisma || allDeps?.['@prisma/client']) info.stack.push('Prisma');

        // 실행 명령어
        info.setupCommands.push({ label: '의존성 설치', cmd: 'npm install' });
        const scripts = parsed.scripts ?? {};
        if (scripts.dev) info.setupCommands.push({ label: '개발 서버', cmd: 'npm run dev' });
        if (scripts.build) info.setupCommands.push({ label: '빌드', cmd: 'npm run build' });
        if (scripts.start) info.setupCommands.push({ label: '실행', cmd: 'npm start' });
        if (scripts.test) info.setupCommands.push({ label: '테스트', cmd: 'npm test' });
      } catch { /* JSON 파싱 실패 무시 */ }
      break;
    }
  }

  // requirements.txt (Python)
  const reqTxt = fileMap.get('requirements.txt');
  if (reqTxt) {
    info.stack.push('Python');
    const deps = reqTxt.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    if (deps.some(d => d.startsWith('django'))) info.stack.push('Django');
    if (deps.some(d => d.startsWith('flask'))) info.stack.push('Flask');
    if (deps.some(d => d.startsWith('fastapi'))) info.stack.push('FastAPI');
    info.setupCommands.push(
      { label: '가상환경 생성', cmd: 'python -m venv venv && source venv/bin/activate' },
      { label: '의존성 설치', cmd: 'pip install -r requirements.txt' },
    );
  }

  // go.mod (Go)
  const goMod = fileMap.get('go.mod');
  if (goMod) {
    info.stack.push('Go');
    info.setupCommands.push(
      { label: '의존성 설치', cmd: 'go mod download' },
      { label: '실행', cmd: 'go run .' },
    );
  }

  // Dockerfile
  if (fileMap.has('dockerfile') || files.some(f => f.path.toLowerCase() === 'dockerfile')) {
    info.stack.push('Docker');
    info.setupCommands.push(
      { label: 'Docker 빌드', cmd: `docker build -t ${info.name} .` },
      { label: 'Docker 실행', cmd: `docker run -p 3000:3000 ${info.name}` },
    );
  }

  // .env.example
  for (const f of files) {
    if (f.path.toLowerCase().includes('.env.example') || f.path.toLowerCase().includes('.env.sample')) {
      info.envVars = f.content.split('\n')
        .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
        .map(l => l.split('=')[0].trim());
      break;
    }
  }

  // README.md 프리뷰
  for (const f of files) {
    if (f.path.toLowerCase() === 'readme.md') {
      info.readmePreview = f.content.slice(0, 800);
      break;
    }
  }

  // 스택이 비어있으면 확장자 기반 감지
  if (info.stack.length === 0) {
    const exts = files.map(f => f.path.split('.').pop()?.toLowerCase()).filter(Boolean);
    if (exts.includes('ts') || exts.includes('tsx')) info.stack.push('TypeScript');
    else if (exts.includes('js') || exts.includes('jsx')) info.stack.push('JavaScript');
    if (exts.includes('py')) info.stack.push('Python');
    if (exts.includes('go')) info.stack.push('Go');
    if (exts.includes('rs')) info.stack.push('Rust');
  }

  // 기본 명령어
  if (info.setupCommands.length === 0) {
    info.setupCommands.push({ label: '프로젝트 열기', cmd: `cd ${info.name}` });
  }

  return info;
}

const SetupTab: React.FC<{ files: { path: string; content: string; taskId: number }[] }> = ({ files }) => {
  const { copiedKey, copy } = useCopyFeedback();
  const info = useMemo(() => analyzeProject(files), [files]);

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-xs">
        <div className="text-center">
          <div className="text-2xl mb-2">📦</div>
          <div>코드가 생성되면 Quick Start 가이드가 표시됩니다</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-3 text-xs font-mono space-y-3">
      {/* 프로젝트 헤더 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded p-2">
        <div className="font-bold text-sm text-blue-800">{info.name}</div>
        <div className="flex flex-wrap gap-1 mt-1">
          {info.stack.map(s => (
            <span key={s} className="px-1.5 py-0.5 bg-white border border-blue-300 rounded text-[10px] text-blue-700">{s}</span>
          ))}
        </div>
      </div>

      {/* 설치 & 실행 명령어 */}
      <div>
        <div className="font-bold text-gray-700 mb-1">🚀 Quick Start</div>
        <div className="space-y-1">
          {info.setupCommands.map((c, i) => (
            <div key={i} className="flex items-center gap-1 bg-gray-900 text-green-400 rounded px-2 py-1">
              <span className="text-gray-500 select-none">$</span>
              <span className="flex-1">{c.cmd}</span>
              <button
                onClick={() => copy(c.cmd, `cmd-${i}`)}
                className="text-gray-500 hover:text-green-300 shrink-0"
                title={c.label}
              >
                {copiedKey === `cmd-${i}` ? '✅' : '📋'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 환경 변수 */}
      {info.envVars.length > 0 && (
        <div>
          <div className="font-bold text-gray-700 mb-1">🔐 환경 변수</div>
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 space-y-0.5">
            {info.envVars.map(v => (
              <div key={v} className="flex items-center gap-1">
                <span className="text-yellow-700">{v}</span>
                <span className="text-gray-400">=</span>
                <span className="text-gray-400 italic">your_value</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* README 프리뷰 */}
      {info.readmePreview && (
        <div>
          <div className="font-bold text-gray-700 mb-1">📄 README.md</div>
          <div className="bg-gray-50 border rounded p-2 whitespace-pre-wrap text-[11px] text-gray-600 max-h-32 overflow-auto">
            {info.readmePreview}
            {info.readmePreview.length >= 800 && <span className="text-gray-400">...</span>}
          </div>
        </div>
      )}

      {/* 파일 구조 요약 */}
      <div>
        <div className="font-bold text-gray-700 mb-1">📂 프로젝트 구조</div>
        <div className="bg-gray-50 border rounded p-2 text-[11px]">
          {files.slice(0, 15).map(f => (
            <div key={f.path} className="text-gray-600">{f.path}</div>
          ))}
          {files.length > 15 && <div className="text-gray-400">... +{files.length - 15}개 파일</div>}
        </div>
      </div>
    </div>
  );
};

const SWCanvas: React.FC = () => {
  const { pipeline, addLog } = useWindowContext();
  const [activeTab, setActiveTab] = useState<SWTab>('diagrams');
  const [selectedFile, setSelectedFile] = useState('');
  const [diagramSub, setDiagramSub] = useState<'architecture' | 'erd'>('architecture');
  const { copiedKey, copy } = useCopyFeedback();

  const archDiagram = pipeline.diagrams.find(d => d.type === 'architecture');
  const erdDiagram = pipeline.diagrams.find(d => d.type === 'erd');

  const selectedFileObj = pipeline.generatedCode.find(f => f.path === selectedFile);

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
    setActiveTab('code');
  };

  const handleDownloadZip = useCallback(async () => {
    if (pipeline.generatedCode.length === 0) return;
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      for (const f of pipeline.generatedCode) {
        zip.file(f.path, f.content);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'project.zip';
      a.click();
      URL.revokeObjectURL(url);
      addLog(`📥 project.zip 다운로드 완료 (${pipeline.generatedCode.length}개 파일)`, 'success');
    } catch (e) {
      addLog(`❌ ZIP 다운로드 실패: ${String(e)}`, 'error');
    }
  }, [pipeline.generatedCode, addLog]);

  const handleCopyAll = useCallback(() => {
    if (pipeline.generatedCode.length === 0) return;
    const allText = pipeline.generatedCode
      .map(f => `// ===== ${f.path} =====\n${f.content}`)
      .join('\n\n');
    navigator.clipboard.writeText(allText).then(() => {
      addLog(`📋 전체 ${pipeline.generatedCode.length}개 파일 복사됨`, 'success');
    });
  }, [pipeline.generatedCode, addLog]);

  const handleExportGuide = useCallback(async () => {
    // ZIP 다운로드
    await handleDownloadZip();

    // 가이드를 터미널 로그로 출력
    const info = analyzeProject(pipeline.generatedCode);
    addLog('─────────────────────────────────────', 'info');
    addLog(`🚀 ${info.name} — Quick Start Guide`, 'success');
    addLog('─────────────────────────────────────', 'info');
    if (info.stack.length > 0) {
      addLog(`📦 Tech Stack: ${info.stack.join(', ')}`, 'info');
    }
    for (const c of info.setupCommands) {
      addLog(`  $ ${c.cmd}  ← ${c.label}`, 'info');
    }
    if (info.envVars.length > 0) {
      addLog(`🔐 .env 설정 필요: ${info.envVars.join(', ')}`, 'warn');
    }
    addLog('─────────────────────────────────────', 'info');
  }, [handleDownloadZip, pipeline.generatedCode, addLog]);

  const tabs: { id: SWTab; label: string }[] = [
    { id: 'diagrams', label: '📊 Diagrams' },
    { id: 'files', label: '📁 Files' },
    { id: 'code', label: '📄 Code' },
    { id: 'setup', label: '📦 Setup' },
  ];

  return (
    <div className="flex flex-col" style={{ width: '520px', height: '420px' }}>
      {/* 탭 헤더 */}
      <div className="flex border-b border-win-dark bg-win-gray">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1 text-xs font-bold border-r border-win-dark ${
              activeTab === tab.id ? 'bg-win-white' : 'bg-win-gray hover:bg-win-light'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-hidden border border-win-dark bg-white">
        {/* Diagrams 탭: Architecture + ERD 통합 */}
        {activeTab === 'diagrams' && (
          <div className="flex flex-col h-full">
            <div className="flex border-b bg-gray-50 px-1 py-0.5 gap-1">
              <button
                onClick={() => setDiagramSub('architecture')}
                className={`px-2 py-0.5 text-[10px] rounded ${
                  diagramSub === 'architecture' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                Architecture
              </button>
              <button
                onClick={() => setDiagramSub('erd')}
                className={`px-2 py-0.5 text-[10px] rounded ${
                  diagramSub === 'erd' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                ERD
              </button>
              {/* Mermaid 소스 복사 버튼 */}
              {(diagramSub === 'architecture' ? archDiagram : erdDiagram) && (
                <button
                  onClick={() => {
                    const d = diagramSub === 'architecture' ? archDiagram : erdDiagram;
                    if (d) copy(d.code, `mermaid-${diagramSub}`);
                  }}
                  className="ml-auto text-[10px] text-gray-400 hover:text-blue-500"
                >
                  {copiedKey === `mermaid-${diagramSub}` ? '✅ 복사됨' : '📋 Copy Mermaid'}
                </button>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <MermaidView diagram={diagramSub === 'architecture' ? archDiagram : erdDiagram} />
            </div>
          </div>
        )}

        {/* Files 탭 */}
        {activeTab === 'files' && (
          <FileTree
            files={pipeline.generatedCode}
            onSelect={handleFileSelect}
            selected={selectedFile}
          />
        )}

        {/* Code 탭: 구문 하이라이팅 + 라인 넘버 */}
        {activeTab === 'code' && (
          <div className="h-full overflow-auto">
            {selectedFile && selectedFileObj ? (
              <>
                <div className="sticky top-0 bg-gray-100 border-b px-2 py-0.5 text-xs font-bold text-gray-600 flex items-center z-10">
                  <span className="flex-1">{selectedFile}</span>
                  <span className={`px-1 rounded text-[9px] mr-2 ${
                    LANG_COLORS[detectLanguage(selectedFile)] ?? 'bg-gray-100 text-gray-600'
                  }`}>
                    {detectLanguage(selectedFile)}
                  </span>
                  <button
                    onClick={() => copy(selectedFileObj.content, `code-${selectedFile}`)}
                    className="text-gray-400 hover:text-blue-500"
                    title="파일 복사"
                  >
                    {copiedKey === `code-${selectedFile}` ? '✅' : '📋 Copy'}
                  </button>
                </div>
                <div className="p-2">
                  <HighlightedCode code={selectedFileObj.content} filename={selectedFile} />
                </div>
              </>
            ) : pipeline.generatedCode.length > 0 ? (
              // 파일 미선택 시 전체 파일 순차 표시
              <div>
                {pipeline.generatedCode.map(f => (
                  <div key={f.path} className="border-b border-gray-200">
                    <div className="sticky top-0 bg-gray-100 border-b px-2 py-0.5 text-xs font-bold text-gray-600 flex items-center z-10">
                      <span className="flex-1 cursor-pointer hover:text-blue-600" onClick={() => setSelectedFile(f.path)}>
                        {f.path}
                      </span>
                      <span className={`px-1 rounded text-[9px] mr-2 ${
                        LANG_COLORS[detectLanguage(f.path)] ?? 'bg-gray-100 text-gray-600'
                      }`}>
                        {detectLanguage(f.path)}
                      </span>
                      <button
                        onClick={() => copy(f.content, `code-${f.path}`)}
                        className="text-gray-400 hover:text-blue-500"
                      >
                        {copiedKey === `code-${f.path}` ? '✅' : '📋'}
                      </button>
                    </div>
                    <div className="p-2">
                      <HighlightedCode code={f.content} filename={f.path} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                <div className="text-center">
                  <div className="text-2xl mb-2">📄</div>
                  <div>코드가 생성되면 여기에 표시됩니다</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Setup 탭 */}
        {activeTab === 'setup' && (
          <SetupTab files={pipeline.generatedCode} />
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-1 p-1 bg-win-gray border-t border-win-dark">
        <button
          onClick={handleDownloadZip}
          disabled={pipeline.generatedCode.length === 0}
          className="win-button text-xs flex-1 disabled:opacity-40"
        >
          📥 Download ZIP
        </button>
        <button
          onClick={handleCopyAll}
          disabled={pipeline.generatedCode.length === 0}
          className="win-button text-xs flex-1 disabled:opacity-40"
        >
          📋 Copy All
        </button>
        <button
          onClick={handleExportGuide}
          disabled={pipeline.generatedCode.length === 0}
          className="win-button text-xs flex-1 disabled:opacity-40"
        >
          🚀 Export
        </button>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────
// Docs 모드: 마크다운 문서 프리뷰어
// ──────────────────────────────────────────────────────────
type DocsTab = 'preview' | 'source' | 'toc';

interface TocItem {
  level: number;
  text: string;
  id: string;
}

function parseToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const headingRe = /^(#{1,6})\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].replace(/[*_`]/g, '').trim();
    const id = text.toLowerCase().replace(/[^a-z0-9가-힣\s-]/g, '').replace(/\s+/g, '-');
    items.push({ level, text, id });
  }
  return items;
}

const DocsCanvas: React.FC = () => {
  const { pipeline, addLog } = useWindowContext();
  const [activeTab, setActiveTab] = useState<DocsTab>('preview');
  const previewRef = useRef<HTMLDivElement>(null);
  const [renderedHtml, setRenderedHtml] = useState('');

  const markdownSource = pipeline.generatedCode[0]?.content ?? '';
  const tocItems = React.useMemo(() => parseToc(markdownSource), [markdownSource]);

  // marked + highlight.js 렌더링
  useEffect(() => {
    if (!markdownSource) { setRenderedHtml(''); return; }

    let cancelled = false;
    (async () => {
      try {
        const { marked } = await import('marked');
        const hljs = (await import('highlight.js')).default;

        marked.setOptions({
          highlight(code: string, lang: string) {
            if (lang && hljs.getLanguage(lang)) {
              return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
          },
        } as import('marked').MarkedOptions);

        const html = await marked.parse(markdownSource);
        if (!cancelled) setRenderedHtml(html);
      } catch {
        // fallback: 순수 텍스트
        if (!cancelled) setRenderedHtml(`<pre>${markdownSource}</pre>`);
      }
    })();

    return () => { cancelled = true; };
  }, [markdownSource]);

  // Mermaid 다이어그램 렌더링 (preview에 삽입된 mermaid 코드 블록)
  useEffect(() => {
    if (activeTab !== 'preview' || !renderedHtml || !previewRef.current) return;

    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'neutral' });

        const codeBlocks = previewRef.current!.querySelectorAll('code.language-mermaid');
        for (const block of Array.from(codeBlocks)) {
          const pre = block.parentElement;
          if (!pre || cancelled) continue;
          const id = `mermaid-doc-${Date.now()}-${Math.random()}`;
          try {
            const { svg } = await mermaid.render(id, block.textContent ?? '');
            const wrapper = document.createElement('div');
            wrapper.className = 'mermaid-rendered';
            wrapper.innerHTML = sanitizeSVG(svg);
            pre.replaceWith(wrapper);
          } catch {
            // mermaid 렌더링 실패 시 원본 유지
          }
        }
      } catch {
        // mermaid import 실패 시 무시
      }
    })();

    return () => { cancelled = true; };
  }, [renderedHtml, activeTab]);

  const handleTocClick = (id: string) => {
    setActiveTab('preview');
    setTimeout(() => {
      const el = previewRef.current?.querySelector(`#${CSS.escape(id)}`);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleDownload = () => {
    if (!markdownSource) return;
    const blob = new Blob([markdownSource], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'documentation.md';
    a.click();
    URL.revokeObjectURL(url);
    addLog('📥 documentation.md 다운로드 완료', 'success');
  };

  const handleCopy = () => {
    if (!markdownSource) return;
    navigator.clipboard.writeText(markdownSource).then(() => {
      addLog('📋 문서 전체 복사됨', 'success');
    });
  };

  const handleOpenTab = () => {
    if (!renderedHtml) return;
    const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Documentation</title>
<style>body{font-family:system-ui;max-width:800px;margin:0 auto;padding:20px;line-height:1.6}
pre{background:#f4f4f4;padding:12px;border-radius:4px;overflow-x:auto}
code{font-size:13px}table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ddd;padding:8px;text-align:left}
th{background:#f0f0f0}img{max-width:100%}</style>
</head><body>${renderedHtml}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const tabs: { id: DocsTab; label: string }[] = [
    { id: 'preview', label: '👁️ Preview' },
    { id: 'source', label: '📝 Source' },
    { id: 'toc', label: '📑 TOC' },
  ];

  return (
    <div className="flex flex-col" style={{ width: '520px', height: '420px' }}>
      {/* 탭 헤더 */}
      <div className="flex border-b border-win-dark bg-win-gray">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1 text-xs font-bold border-r border-win-dark ${
              activeTab === tab.id ? 'bg-win-white' : 'bg-win-gray hover:bg-win-light'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-hidden border border-win-dark bg-white">
        {activeTab === 'preview' && (
          markdownSource ? (
            <div
              ref={previewRef}
              className="h-full overflow-auto p-4 prose prose-sm max-w-none"
              style={{ fontSize: '13px', lineHeight: '1.6' }}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-xs">
              <div className="text-center">
                <div className="text-2xl mb-2">📄</div>
                <div>문서가 생성되면 여기에 표시됩니다</div>
              </div>
            </div>
          )
        )}

        {activeTab === 'source' && (
          <div className="h-full overflow-auto">
            {markdownSource ? (
              <pre className="p-2 text-xs font-mono whitespace-pre-wrap">
                {markdownSource.split('\n').map((line, i) => (
                  <div key={i} className="flex">
                    <span className="text-gray-300 select-none w-8 text-right mr-2 shrink-0">{i + 1}</span>
                    <span>{line}</span>
                  </div>
                ))}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                마크다운 소스가 없습니다
              </div>
            )}
          </div>
        )}

        {activeTab === 'toc' && (
          <div className="h-full overflow-auto p-2">
            {tocItems.length > 0 ? (
              <div className="font-mono text-xs">
                {tocItems.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => handleTocClick(item.id)}
                    className="py-0.5 cursor-pointer hover:bg-blue-50 hover:text-blue-600 rounded px-1"
                    style={{ paddingLeft: `${(item.level - 1) * 16}px` }}
                  >
                    <span className="text-gray-400 mr-1">{'#'.repeat(item.level)}</span>
                    {item.text}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                목차가 없습니다. 문서를 먼저 생성하세요.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-1 p-1 bg-win-gray border-t border-win-dark">
        <button
          onClick={handleDownload}
          disabled={!markdownSource}
          className="win-button text-xs flex-1 disabled:opacity-40"
        >
          📥 Download .md
        </button>
        <button
          onClick={handleCopy}
          disabled={!markdownSource}
          className="win-button text-xs flex-1 disabled:opacity-40"
        >
          📋 Copy All
        </button>
        <button
          onClick={handleOpenTab}
          disabled={!renderedHtml}
          className="win-button text-xs flex-1 disabled:opacity-40"
        >
          🔗 Open Tab
        </button>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────
// 메인 컴포넌트: 도메인 분기
// ──────────────────────────────────────────────────────────
export const LiveCanvasWindow: React.FC = () => {
  const { domainMode } = useWindowContext();

  return domainMode === 'docs' ? <DocsCanvas />
       : domainMode === 'software' ? <SWCanvas />
       : <GameCanvas />;
};
