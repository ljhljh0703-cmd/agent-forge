export interface CodeBlock {
  language: string;
  content: string;
  filename?: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  taskId: number;
}

/**
 * AI 응답 마크다운에서 코드 블록을 추출한다.
 * 지원 형식:
 *   ```html
 *   <!-- index.html -->
 *   ...
 *   ```
 */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  // ``` 언어 (선택적 공백) 개행 ... ``` 패턴
  const fence = /```(\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(markdown)) !== null) {
    const language = (match[1] ?? 'text').toLowerCase();
    const content = match[2];

    // 파일명 힌트: 첫 번째 줄에 주석으로 명시된 경우 추출
    // <!-- index.html -->  /  /* style.css */  /  // game.js
    const firstLine = content.split('\n')[0].trim();
    const filenameMatch =
      firstLine.match(/<!--\s*([\w./\-]+)\s*-->/) ??
      firstLine.match(/\/\*\s*([\w./\-]+)\s*\*\//) ??
      firstLine.match(/\/\/\s*([\w./\-]+)/);

    blocks.push({
      language,
      content,
      filename: filenameMatch?.[1],
    });
  }

  return blocks;
}

/**
 * CodeBlock 배열을 GeneratedFile 배열로 변환한다.
 * 파일명 힌트가 없을 때는 언어로 기본 파일명을 결정한다.
 */
export function codeBlocksToFiles(
  blocks: CodeBlock[],
  projectName: string,
): GeneratedFile[] {
  const langToExt: Record<string, string> = {
    html: 'html',
    css: 'css',
    javascript: 'js',
    js: 'js',
    typescript: 'ts',
    ts: 'ts',
  };

  // 언어별 등장 횟수 추적 (같은 언어 블록이 여러 개일 때 번호 부여)
  const langCount: Record<string, number> = {};

  return blocks.map((block, idx) => {
    const ext = langToExt[block.language] ?? block.language;

    let path: string;
    if (block.filename) {
      path = block.filename;
    } else {
      langCount[ext] = (langCount[ext] ?? 0) + 1;
      const suffix = langCount[ext] > 1 ? `-${langCount[ext]}` : '';
      path = ext === 'html' ? 'index.html' : `${projectName}${suffix}.${ext}`;
    }

    return { path, content: block.content, taskId: idx };
  });
}

// ──── SW 모드 전용 ────────────────────────────────────────

export interface MermaidDiagram {
  type: 'architecture' | 'erd' | 'sequence' | 'deployment' | 'other';
  code: string;
}

/**
 * SW 모드: ```filepath 패턴 코드 블록 추출.
 * 예: ```src/controllers/auth.ts
 */
export function extractSWCodeBlocks(markdown: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  // 백틱 3개 + 슬래시 포함 경로 패턴 (src/, tests/, __tests__/ 등)
  const fence = /```([\w./\-]+\/[\w./\-]+)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = fence.exec(markdown)) !== null) {
    const path = match[1].trim();
    const content = match[2];
    files.push({ path, content, taskId: idx++ });
  }

  // 경로 없이 파일명만 있는 패턴도 추출: ```README.md, ```.env.example, ```package.json
  const simpleFile = /```(README\.md|\.env\.example|\.env\.sample|package\.json|tsconfig\.json|Dockerfile|docker-compose\.yml)\n([\s\S]*?)```/g;
  while ((match = simpleFile.exec(markdown)) !== null) {
    const path = match[1].trim();
    // 중복 방지
    if (!files.find(f => f.path === path)) {
      files.push({ path, content: match[2], taskId: idx++ });
    }
  }

  return files;
}

/**
 * 마크다운에서 Mermaid 다이어그램 블록을 추출한다.
 * 블록 앞 헤더 텍스트로 type을 자동 추론한다.
 */
export function extractMermaidDiagrams(markdown: string): MermaidDiagram[] {
  const diagrams: MermaidDiagram[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim() === '```mermaid') {
      // 이 블록 앞에서 가장 가까운 헤더 찾기
      let headerText = '';
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        if (lines[j].trim().startsWith('#')) {
          headerText = lines[j].toLowerCase();
          break;
        }
      }

      // 헤더 텍스트로 type 추론
      let type: MermaidDiagram['type'] = 'other';
      if (headerText.includes('erd') || headerText.includes('데이터 모델') || headerText.includes('data model')) {
        type = 'erd';
      } else if (headerText.includes('sequence') || headerText.includes('시퀀스')) {
        type = 'sequence';
      } else if (headerText.includes('deploy') || headerText.includes('배포')) {
        type = 'deployment';
      } else if (headerText.includes('architecture') || headerText.includes('아키텍처') || headerText.includes('system')) {
        type = 'architecture';
      } else if (diagrams.length === 0) {
        type = 'architecture'; // 첫 번째는 아키텍처로 가정
      } else if (diagrams.length === 1) {
        type = 'erd'; // 두 번째는 ERD로 가정
      }

      // 블록 내용 수집
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '```') {
        codeLines.push(lines[i]);
        i++;
      }
      diagrams.push({ type, code: codeLines.join('\n') });
    }
    i++;
  }

  return diagrams;
}

/**
 * GeneratedFile 배열을 단일 HTML 문자열로 조합한다.
 * CSS → <style>, JS → <script> 인라인 삽입.
 */
export function assembleGame(files: GeneratedFile[]): string {
  const htmlFile = files.find(f => f.path.endsWith('.html'));
  const cssFiles = files.filter(f => f.path.endsWith('.css'));
  const jsFiles = files.filter(f => f.path.endsWith('.js') || f.path.endsWith('.ts'));

  // HTML 파일이 없으면 기본 뼈대 생성
  let html = htmlFile?.content ?? `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>Game</title></head>
<body></body>
</html>`;

  // CSS 인라인 삽입 (</head> 앞)
  if (cssFiles.length > 0) {
    const styleTag = `<style>\n${cssFiles.map(f => f.content).join('\n')}\n</style>`;
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${styleTag}\n</head>`);
    } else {
      html = styleTag + '\n' + html;
    }
  }

  // JS 인라인 삽입 (</body> 앞)
  if (jsFiles.length > 0) {
    const scriptTag = `<script>\n${jsFiles.map(f => f.content).join('\n')}\n</script>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${scriptTag}\n</body>`);
    } else {
      html = html + '\n' + scriptTag;
    }
  }

  return html;
}
