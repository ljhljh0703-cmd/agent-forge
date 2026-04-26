export interface AIClientConfig {
  provider: 'gemini';
  apiKey: string;
  model: string;
  maxTokens?: number;
}

export interface AIRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** 호출별 모델 오버라이드 — 미지정 시 AIClientConfig.model 사용 */
  model?: string;
}

export interface AIResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  latencyMs: number;
}

export class AIClient {
  private config: AIClientConfig;

  constructor(config: AIClientConfig) {
    this.config = config;
  }

  private geminiBody(request: AIRequest) {
    return {
      contents: [{ role: 'user', parts: [{ text: request.userPrompt }] }],
      systemInstruction: request.systemPrompt
        ? { parts: [{ text: request.systemPrompt }] }
        : undefined,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
      },
    };
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const start = Date.now();
    const model = request.model ?? this.config.model;
    const url = `/api/google/v1beta/models/${model}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey,
      },
      body: JSON.stringify(this.geminiBody(request)),
      signal: request.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      let detail = errText;
      try {
        const errJson = JSON.parse(errText);
        detail = errJson?.error?.message ?? errText;
      } catch { /* plain text */ }
      throw new Error(`Gemini API Error ${response.status}: ${detail}`);
    }

    const data = await response.json();

    // 안전 필터 등으로 candidates가 없는 경우
    if (!data.candidates || data.candidates.length === 0) {
      const blockReason = data.promptFeedback?.blockReason ?? 'UNKNOWN';
      throw new Error(`Gemini 응답 차단 — 사유: ${blockReason}. promptFeedback: ${JSON.stringify(data.promptFeedback ?? {})}`);
    }

    const finishReason = data.candidates[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
      throw new Error(`Gemini 비정상 종료 — finishReason: ${finishReason}`);
    }

    const content = data.candidates[0]?.content?.parts?.[0]?.text ?? '';
    return {
      content,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
      model,
      latencyMs: Date.now() - start,
    };
  }

  async stream(
    request: AIRequest,
    onChunk: (text: string) => void,
  ): Promise<AIResponse> {
    const start = Date.now();
    const model = request.model ?? this.config.model;
    const url =
      `/api/google/v1beta/models/${model}:streamGenerateContent?alt=sse`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey,
      },
      body: JSON.stringify(this.geminiBody(request)),
      signal: request.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      let detail = errText;
      try {
        const errJson = JSON.parse(errText);
        detail = errJson?.error?.message ?? errText;
      } catch { /* plain text */ }
      throw new Error(`Gemini API Error ${response.status}: ${detail}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr);
          const text = event.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          if (text) {
            fullContent += text;
            onChunk(text);
          }
          if (event.usageMetadata) {
            inputTokens = event.usageMetadata.promptTokenCount ?? 0;
            outputTokens = event.usageMetadata.candidatesTokenCount ?? 0;
          }
        } catch {
          // 파싱 실패 라인 무시
        }
      }
    }

    return {
      content: fullContent,
      usage: { inputTokens, outputTokens },
      model,
      latencyMs: Date.now() - start,
    };
  }

  async ping(): Promise<boolean> {
    try {
      await this.complete({
        systemPrompt: 'Reply with OK.',
        userPrompt: 'ping',
        maxTokens: 10,
      });
      return true;
    } catch {
      return false;
    }
  }
}

// 싱글톤 팩토리
let _client: AIClient | null = null;

/** API Key 변경 시 클라이언트 재생성 */
export function resetAIClient(): void {
  _client = null;
}

export function getAIClient(): AIClient {
  if (!_client) {
    const apiKey =
      import.meta.env.VITE_AI_API_KEY ||
      localStorage.getItem('ai_api_key') ||
      '';
    if (!apiKey) {
      throw new Error('API Key가 설정되지 않았습니다. 우측 패널 상단에서 API Key를 입력하세요.');
    }
    _client = new AIClient({
      provider: 'gemini',
      apiKey,
      model: import.meta.env.VITE_AI_MODEL ?? 'gemini-2.0-flash',
      maxTokens: 8192,
    });
  }
  return _client;
}
