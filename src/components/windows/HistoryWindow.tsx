import React, { useState } from 'react';
import { useWindowContext } from '../../context/WindowContext';
import { loadPipelineLogs, PipelineLog } from '../../context/WindowContext';

export const HistoryWindow: React.FC = () => {
  const { setPipeline, addLog, domainMode } = useWindowContext();
  const [logs] = useState<PipelineLog[]>(() => loadPipelineLogs());
  const [selected, setSelected] = useState<PipelineLog | null>(null);

  const handleLoad = (log: PipelineLog) => {
    setPipeline({ gdd: log.gdd, spec: log.spec, status: 'idle', generatedCode: [], auditResult: null });
    addLog(`📂 "${log.projectName}" 로드 완료 — Planner/Architect 창에서 확인`, 'success');
  };

  const handleDelete = (id: string) => {
    const updated = loadPipelineLogs().filter(l => l.id !== id);
    localStorage.setItem('pipeline_logs', JSON.stringify(updated));
    if (selected?.id === id) setSelected(null);
    addLog('🗑️ 로그 삭제 완료', 'info');
    window.location.reload(); // 목록 갱신 (간단한 방법)
  };

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-gray-400 font-mono">
        저장된 세션이 없습니다.<br />파이프라인이 완료되면 자동 저장됩니다.
      </div>
    );
  }

  return (
    <div className="flex gap-2" style={{ minWidth: '480px', height: '360px' }}>
      {/* 목록 */}
      <div className="flex flex-col border border-win-dark" style={{ width: '200px', overflow: 'hidden' }}>
        <div className="text-xs font-bold px-2 py-1 bg-win-gray border-b border-win-dark">
          📚 세션 목록 ({logs.length})
        </div>
        <div className="flex-1 overflow-auto">
          {logs.map(log => (
            <div
              key={log.id}
              onClick={() => setSelected(log)}
              className={`px-2 py-2 border-b border-gray-200 cursor-pointer hover:bg-blue-50 text-xs ${
                selected?.id === log.id ? 'bg-blue-100' : ''
              }`}
            >
              <div className="font-bold truncate" title={log.projectName}>
                {log.domainMode === 'game' ? '🎮' : '🏗️'} {log.projectName}
              </div>
              <div className="text-gray-400 mt-0.5">
                {new Date(log.timestamp).toLocaleDateString('ko-KR', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </div>
              <div className={`mt-0.5 ${log.passed ? 'text-green-600' : 'text-red-500'}`}>
                {log.passed ? '✅ PASS' : '❌ FAIL'} · {log.generatedFileCount}개 파일
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 상세 */}
      <div className="flex-1 flex flex-col border border-win-dark overflow-hidden">
        {selected ? (
          <>
            <div className="text-xs font-bold px-2 py-1 bg-win-gray border-b border-win-dark flex justify-between items-center">
              <span>📄 {selected.projectName}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => handleLoad(selected)}
                  className="win-button text-xs px-2 py-0.5"
                  style={{ backgroundColor: '#ccffcc' }}
                >
                  📂 이 세션 불러오기
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="win-button text-xs px-2 py-0.5"
                  style={{ backgroundColor: '#ffcccc' }}
                >
                  🗑️
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2 text-xs font-mono space-y-2">
              <div>
                <span className="font-bold text-gray-600">도메인:</span>{' '}
                {selected.domainMode === 'game' ? '🎮 Game Dev' : '🏗️ SW Architect'}
              </div>
              <div>
                <span className="font-bold text-gray-600">저장 시각:</span>{' '}
                {new Date(selected.timestamp).toLocaleString('ko-KR')}
              </div>
              <div>
                <span className="font-bold text-gray-600">생성 파일:</span>{' '}
                {selected.generatedFileCount}개
              </div>
              <div>
                <span className="font-bold text-gray-600">Audit Score:</span>{' '}
                {selected.auditScore !== null ? `${selected.auditScore}/10` : 'N/A'}
                {' '}{selected.passed ? '✅ PASS' : '❌ FAIL'}
              </div>
              <div className="border-t pt-2">
                <div className="font-bold text-gray-600 mb-1">
                  {selected.domainMode === 'game' ? 'GDD 미리보기' : 'PRD 미리보기'}
                </div>
                <div className="whitespace-pre-wrap text-gray-700 bg-gray-50 p-1 rounded border max-h-28 overflow-auto">
                  {selected.gdd.slice(0, 500)}{selected.gdd.length > 500 ? '...' : ''}
                </div>
              </div>
              <div>
                <div className="font-bold text-gray-600 mb-1">
                  {selected.domainMode === 'game' ? 'SPEC 미리보기' : '아키텍처 미리보기'}
                </div>
                <div className="whitespace-pre-wrap text-gray-700 bg-gray-50 p-1 rounded border max-h-28 overflow-auto">
                  {selected.spec.slice(0, 500)}{selected.spec.length > 500 ? '...' : ''}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-gray-400">
            좌측에서 세션을 선택하세요
          </div>
        )}
      </div>
    </div>
  );
};
