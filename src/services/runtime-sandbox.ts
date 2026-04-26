import { assembleGame } from '../utils/code-extractor';
import type { GeneratedFile } from '../context/WindowContext';

export interface RuntimeReport {
  success: boolean;
  errors: string[];
  warnings: string[];
  logs: string[];
  domInfo: {
    elementCount: number;
    hasCanvas: boolean;
    bodyText: string;
  };
  hasGameLoop: boolean;
  loadTimeMs: number;
}

const SANDBOX_TIMEOUT_MS = 5000;
const MAX_LOG_LINES = 50;

// 프로브 스크립트: iframe 내부에서 실행되어 런타임 정보를 수집
function buildProbeScript(probeId: string): string {
  return `
<script>
(function() {
  var __PROBE_ID = "${probeId}";
  var __errors = [];
  var __warnings = [];
  var __logs = [];
  var __hasGameLoop = false;
  var __startTime = Date.now();

  // console 오버라이드
  var _origLog = console.log;
  var _origWarn = console.warn;
  var _origError = console.error;

  console.log = function() {
    if (__logs.length < ${MAX_LOG_LINES}) {
      __logs.push(Array.prototype.slice.call(arguments).join(' '));
    }
    _origLog.apply(console, arguments);
  };
  console.warn = function() {
    if (__warnings.length < ${MAX_LOG_LINES}) {
      __warnings.push(Array.prototype.slice.call(arguments).join(' '));
    }
    _origWarn.apply(console, arguments);
  };
  console.error = function() {
    if (__errors.length < ${MAX_LOG_LINES}) {
      __errors.push(Array.prototype.slice.call(arguments).join(' '));
    }
    _origError.apply(console, arguments);
  };

  // 에러 핸들러
  window.onerror = function(msg, src, line, col, err) {
    __errors.push((msg || 'Unknown error') + (line ? ' (line ' + line + ')' : ''));
  };
  window.addEventListener('unhandledrejection', function(e) {
    __errors.push('Unhandled rejection: ' + (e.reason ? (e.reason.message || String(e.reason)) : 'unknown'));
  });

  // 게임 루프 감지: rAF 및 setInterval 래핑
  var _origRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = function(cb) {
    __hasGameLoop = true;
    return _origRAF.call(window, cb);
  };
  var _origSetInterval = window.setInterval;
  window.setInterval = function(fn, ms) {
    if (typeof ms === 'number' && ms <= 100) __hasGameLoop = true;
    return _origSetInterval.apply(window, arguments);
  };

  // 로드 후 3초 대기 → DOM 정보 수집 → postMessage
  window.addEventListener('load', function() {
    setTimeout(function() {
      var body = document.body;
      var report = {
        __RUNTIME_PROBE: true,
        probeId: __PROBE_ID,
        report: {
          success: __errors.length === 0,
          errors: __errors,
          warnings: __warnings,
          logs: __logs,
          domInfo: {
            elementCount: body ? body.querySelectorAll('*').length : 0,
            hasCanvas: !!document.querySelector('canvas'),
            bodyText: body ? (body.innerText || '').substring(0, 200) : ''
          },
          hasGameLoop: __hasGameLoop,
          loadTimeMs: Date.now() - __startTime
        }
      };
      parent.postMessage(report, '*');
    }, 3000);
  });
})();
</script>`;
}

// 프로브 스크립트를 HTML <head> 앞에 주입
function injectProbe(html: string, probeId: string): string {
  const probe = buildProbeScript(probeId);
  // <head> 태그 바로 뒤에 삽입
  if (html.includes('<head>')) {
    return html.replace('<head>', '<head>' + probe);
  }
  if (html.includes('<head ')) {
    return html.replace(/<head\s[^>]*>/, (match) => match + probe);
  }
  // <head> 없으면 HTML 시작에 삽입
  return probe + html;
}

/** 숨겨진 iframe에서 코드를 실행하고 RuntimeReport를 반환 */
export function executeInSandbox(files: GeneratedFile[]): Promise<RuntimeReport> {
  return new Promise((resolve) => {
    const probeId = `probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let settled = false;

    const fallbackReport: RuntimeReport = {
      success: false,
      errors: ['Sandbox execution timed out'],
      warnings: [],
      logs: [],
      domInfo: { elementCount: 0, hasCanvas: false, bodyText: '' },
      hasGameLoop: false,
      loadTimeMs: SANDBOX_TIMEOUT_MS,
    };

    // HTML 조립 + 프로브 주입
    let html: string;
    try {
      html = assembleGame(files);
      html = injectProbe(html, probeId);
    } catch (err) {
      resolve({
        ...fallbackReport,
        errors: [`HTML assembly failed: ${err instanceof Error ? err.message : String(err)}`],
      });
      return;
    }

    // 메시지 리스너
    const onMessage = (event: MessageEvent) => {
      if (settled) return;
      const data = event.data;
      if (!data || data.__RUNTIME_PROBE !== true || data.probeId !== probeId) return;

      settled = true;
      cleanup();
      resolve(data.report as RuntimeReport);
    };

    window.addEventListener('message', onMessage);

    // 숨겨진 iframe 생성
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.sandbox.add('allow-scripts');
    document.body.appendChild(iframe);

    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    iframe.src = blobUrl;

    // 타임아웃
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(fallbackReport);
    }, SANDBOX_TIMEOUT_MS);

    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      try {
        document.body.removeChild(iframe);
      } catch { /* 이미 제거됨 */ }
      URL.revokeObjectURL(blobUrl);
    }
  });
}
