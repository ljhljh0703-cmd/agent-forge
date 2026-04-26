/** 파일 확장자 → 프로그래밍 언어 이름 매핑 */
const EXT_TO_LANG: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript (React)',
  js: 'JavaScript',
  jsx: 'JavaScript (React)',
  py: 'Python',
  rb: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  swift: 'Swift',
  cs: 'C#',
  cpp: 'C++',
  c: 'C',
  h: 'C/C++ Header',
  hpp: 'C++ Header',
  php: 'PHP',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  less: 'LESS',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  sql: 'SQL',
  sh: 'Shell',
  bash: 'Shell',
  zsh: 'Shell',
  md: 'Markdown',
  toml: 'TOML',
  ini: 'INI',
  env: 'Environment',
  dockerfile: 'Dockerfile',
  vue: 'Vue',
  svelte: 'Svelte',
  dart: 'Dart',
  lua: 'Lua',
  r: 'R',
  scala: 'Scala',
  ex: 'Elixir',
  exs: 'Elixir',
  erl: 'Erlang',
  hs: 'Haskell',
  tf: 'Terraform',
  proto: 'Protocol Buffers',
  graphql: 'GraphQL',
  gql: 'GraphQL',
};

/** 파일명에서 확장자를 추출하여 언어 이름을 반환 */
export function detectLanguage(filename: string): string {
  const lower = filename.toLowerCase();
  // Dockerfile 등 확장자 없는 특수 파일
  const basename = lower.split('/').pop() ?? lower;
  if (basename === 'dockerfile') return 'Dockerfile';
  if (basename === 'makefile') return 'Makefile';
  if (basename.startsWith('.env')) return 'Environment';

  const ext = basename.split('.').pop() ?? '';
  return EXT_TO_LANG[ext] ?? ext.toUpperCase();
}

/** 파일 확장자 → highlight.js 언어 식별자 */
export function extToHighlightLang(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    kt: 'kotlin', swift: 'swift', cs: 'csharp', cpp: 'cpp', c: 'c',
    php: 'php', html: 'html', css: 'css', scss: 'scss', json: 'json',
    yaml: 'yaml', yml: 'yaml', xml: 'xml', sql: 'sql', sh: 'bash',
    bash: 'bash', md: 'markdown', dart: 'dart', lua: 'lua',
    vue: 'html', svelte: 'html', graphql: 'graphql',
  };
  return map[ext] ?? 'plaintext';
}
