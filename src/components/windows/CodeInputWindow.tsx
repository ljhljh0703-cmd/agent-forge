import React, { useState, useRef, useCallback } from 'react';
import { useWindowContext } from '../../context/WindowContext';
import { detectLanguage } from '../../utils/language-detector';

type InputMode = 'paste' | 'upload' | 'github';

interface CodeFile {
  id: string;
  path: string;
  content: string;
  language: string;
  lines: number;
}

const SOURCE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.go', '.rs', '.java', '.kt',
  '.swift', '.cs', '.cpp', '.c', '.h', '.hpp', '.php', '.html', '.css',
  '.scss', '.json', '.yaml', '.yml', '.xml', '.sql', '.sh', '.md', '.toml',
  '.vue', '.svelte', '.dart', '.lua', '.graphql', '.gql', '.proto', '.tf',
  '.env', '.dockerfile',
];

export const CodeInputWindow: React.FC = () => {
  const { addLog, setPipeline, toggleWindowVisibility } = useWindowContext();

  const [inputMode, setInputMode] = useState<InputMode>('paste');
  const [files, setFiles] = useState<CodeFile[]>([]);

  // paste mode
  const [pasteFilename, setPasteFilename] = useState('');
  const [pasteContent, setPasteContent] = useState('');

  // github mode
  const [githubUrl, setGithubUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  // project context (optional)
  const [projectDesc, setProjectDesc] = useState('');
  const [techStack, setTechStack] = useState('');
  const [keyFeatures, setKeyFeatures] = useState('');

  // editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFile = useCallback((path: string, content: string) => {
    const file: CodeFile = {
      id: String(Date.now() + Math.random()),
      path,
      content,
      language: detectLanguage(path),
      lines: content.split('\n').length,
    };
    setFiles(prev => [...prev, file]);
    return file;
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // ── Paste 모드 ──
  const handlePasteAdd = () => {
    if (!pasteFilename.trim() || !pasteContent.trim()) {
      addLog('⚠️ 파일명과 코드를 모두 입력하세요', 'warn');
      return;
    }
    if (editingId) {
      setFiles(prev => prev.map(f =>
        f.id === editingId
          ? { ...f, path: pasteFilename, content: pasteContent, language: detectLanguage(pasteFilename), lines: pasteContent.split('\n').length }
          : f
      ));
      setEditingId(null);
    } else {
      addFile(pasteFilename, pasteContent);
    }
    setPasteFilename('');
    setPasteContent('');
    addLog(`📄 파일 추가: ${pasteFilename}`, 'success');
  };

  const handleEdit = (file: CodeFile) => {
    setInputMode('paste');
    setEditingId(file.id);
    setPasteFilename(file.path);
    setPasteContent(file.content);
  };

  // ── Upload 모드 ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    let count = 0;
    for (const file of Array.from(uploadedFiles)) {
      if (file.size > 500_000) {
        addLog(`⚠️ ${file.name} 너무 큼 (${(file.size / 1024).toFixed(0)}KB). 건너뜁니다.`, 'warn');
        continue;
      }
      const text = await file.text();
      addFile(file.webkitRelativePath || file.name, text);
      count++;
    }
    addLog(`📂 ${count}개 파일 업로드 완료`, 'success');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const items = e.dataTransfer.files;
    let count = 0;
    for (const file of Array.from(items)) {
      if (file.size > 500_000) continue;
      const text = await file.text();
      addFile(file.name, text);
      count++;
    }
    if (count > 0) addLog(`📂 ${count}개 파일 드롭 완료`, 'success');
  };

  // ── GitHub 모드 ──
  const handleGithubFetch = async () => {
    if (!githubUrl.trim()) return;
    setIsFetching(true);

    try {
      // Parse: https://github.com/owner/repo[/tree/branch/path]
      const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)\/?(.*)?)?/);
      if (!match) throw new Error('유효한 GitHub URL이 아닙니다');

      const [, owner, repo, branch = 'main', path = ''] = match;
      const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;

      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`GitHub API 오류: ${res.status}`);
      const data = await res.json();

      const items = Array.isArray(data) ? data : [data];
      const sourceFiles = items.filter(
        (item: { type: string; name: string }) =>
          item.type === 'file' && SOURCE_EXTENSIONS.some(ext => item.name.toLowerCase().endsWith(ext))
      );

      let count = 0;
      for (const item of sourceFiles.slice(0, 20)) {
        const fileRes = await fetch(item.download_url);
        if (!fileRes.ok) continue;
        const content = await fileRes.text();
        addFile(item.path, content);
        count++;
      }
      addLog(`🐙 GitHub에서 ${count}개 파일 로드 완료 (${owner}/${repo})`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`❌ GitHub 로드 실패: ${msg}`, 'error');
    } finally {
      setIsFetching(false);
    }
  };

  // ── Generate Docs ──
  const handleGenerate = () => {
    if (files.length === 0) {
      addLog('⚠️ 코드 파일을 하나 이상 추가하세요', 'warn');
      return;
    }

    const codePayload = files.map(f => ({
      path: f.path,
      language: f.language,
      lines: f.lines,
      content: f.content,
    }));

    const contextBlock = [
      projectDesc && `프로젝트 설명: ${projectDesc}`,
      techStack && `기술 스택: ${techStack}`,
      keyFeatures && `주요 기능: ${keyFeatures}`,
    ].filter(Boolean).join('\n');

    const gddContent = `# 코드베이스 문서화 요청

${contextBlock ? `## 프로젝트 컨텍스트\n${contextBlock}\n` : ''}
## 코드 파일 (${files.length}개)

${JSON.stringify(codePayload, null, 2)}`;

    setPipeline({ gdd: gddContent, spec: '', generatedCode: [], auditResult: null, executionPlan: null, diagrams: [] });
    addLog(`📂 ${files.length}개 파일이 파이프라인에 전달됨 — Planner에서 시작하세요`, 'success');
    toggleWindowVisibility('planner');
  };

  const modes: { id: InputMode; label: string }[] = [
    { id: 'paste', label: '📋 Paste' },
    { id: 'upload', label: '📁 Upload' },
    { id: 'github', label: '🐙 GitHub' },
  ];

  return (
    <div className="flex flex-col" style={{ width: '480px', height: '440px' }}>
      {/* 모드 탭 */}
      <div className="flex border-b border-win-dark bg-win-gray">
        {modes.map(m => (
          <button
            key={m.id}
            onClick={() => setInputMode(m.id)}
            className={`px-3 py-1 text-xs font-bold border-r border-win-dark ${
              inputMode === m.id ? 'bg-win-white' : 'bg-win-gray hover:bg-win-light'
            }`}
          >
            {m.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="px-2 py-1 text-xs text-gray-500">{files.length}개 파일</span>
      </div>

      {/* 입력 영역 */}
      <div className="flex-1 overflow-auto p-2">
        {inputMode === 'paste' && (
          <div className="flex flex-col gap-2 h-full">
            <input
              type="text"
              value={pasteFilename}
              onChange={e => setPasteFilename(e.target.value)}
              placeholder="파일 경로 (예: src/index.ts)"
              className="px-2 py-1 text-xs border border-win-dark font-mono bg-white"
            />
            <textarea
              value={pasteContent}
              onChange={e => setPasteContent(e.target.value)}
              placeholder="코드를 붙여넣으세요..."
              className="flex-1 px-2 py-1 text-xs border border-win-dark font-mono bg-white resize-none"
              style={{ minHeight: '80px' }}
            />
            <button onClick={handlePasteAdd} className="win-button text-xs">
              {editingId ? '✏️ 수정 완료' : '➕ 파일 추가'}
            </button>
          </div>
        )}

        {inputMode === 'upload' && (
          <div
            className="flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-300 rounded cursor-pointer hover:bg-gray-50"
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-3xl mb-2">📁</div>
            <div className="text-xs text-gray-500">파일을 드래그하거나 클릭하여 업로드</div>
            <div className="text-xs text-gray-400 mt-1">소스 코드 파일만 (최대 500KB/파일)</div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={SOURCE_EXTENSIONS.join(',')}
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {inputMode === 'github' && (
          <div className="flex flex-col gap-2">
            <div className="text-xs text-gray-500">공개 GitHub 저장소의 소스 코드를 가져옵니다</div>
            <input
              type="text"
              value={githubUrl}
              onChange={e => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repo/tree/main/src"
              className="px-2 py-1 text-xs border border-win-dark font-mono bg-white"
            />
            <button
              onClick={handleGithubFetch}
              disabled={isFetching || !githubUrl.trim()}
              className="win-button text-xs disabled:opacity-40"
            >
              {isFetching ? '⏳ 로드 중...' : '🐙 파일 가져오기'}
            </button>
          </div>
        )}
      </div>

      {/* 파일 리스트 */}
      {files.length > 0 && (
        <div className="border-t border-win-dark max-h-[120px] overflow-auto">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-1 px-2 py-0.5 text-xs font-mono hover:bg-blue-50 border-b border-gray-100">
              <span className="flex-1 truncate">{f.path}</span>
              <span className="text-gray-400 shrink-0">{f.language}</span>
              <span className="text-gray-400 shrink-0">({f.lines}줄)</span>
              <button onClick={() => handleEdit(f)} className="text-blue-500 hover:text-blue-700 shrink-0">✏️</button>
              <button onClick={() => removeFile(f.id)} className="text-red-500 hover:text-red-700 shrink-0">🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* 프로젝트 컨텍스트 (토글) */}
      <details className="border-t border-win-dark">
        <summary className="px-2 py-1 text-xs font-bold bg-win-gray cursor-pointer hover:bg-win-light">
          📝 프로젝트 컨텍스트 (선택)
        </summary>
        <div className="flex flex-col gap-1 p-2">
          <input
            type="text"
            value={projectDesc}
            onChange={e => setProjectDesc(e.target.value)}
            placeholder="프로젝트 설명"
            className="px-2 py-0.5 text-xs border border-win-dark bg-white"
          />
          <input
            type="text"
            value={techStack}
            onChange={e => setTechStack(e.target.value)}
            placeholder="기술 스택 (React, Node.js, ...)"
            className="px-2 py-0.5 text-xs border border-win-dark bg-white"
          />
          <input
            type="text"
            value={keyFeatures}
            onChange={e => setKeyFeatures(e.target.value)}
            placeholder="주요 기능"
            className="px-2 py-0.5 text-xs border border-win-dark bg-white"
          />
        </div>
      </details>

      {/* 하단 버튼 */}
      <div className="flex gap-1 p-1 bg-win-gray border-t border-win-dark">
        <button
          onClick={() => { setFiles([]); addLog('🗑️ 파일 목록 초기화', 'info'); }}
          disabled={files.length === 0}
          className="win-button text-xs flex-1 disabled:opacity-40"
        >
          🗑️ Clear All
        </button>
        <button
          onClick={handleGenerate}
          disabled={files.length === 0}
          className="win-button text-xs flex-[2] disabled:opacity-40 font-bold"
        >
          📄 Generate Docs ({files.length} files)
        </button>
      </div>
    </div>
  );
};
