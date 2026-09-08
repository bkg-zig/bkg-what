import { GoogleGenAI } from '@google/genai';
import { 
  AIProviderConfig, 
  AIGenerateRequest, 
  AIGenerateResponse,
  AIProviderConfigInput
} from '../src/types/ai';

export interface AIGenerateChunk {
  text: string;
  isDone: boolean;
}

export interface AIProviderAdapter {
  id: string;
  config: AIProviderConfig;
  generate(request: AIGenerateRequest): Promise<AIGenerateResponse>;
  stream(request: AIGenerateRequest): AsyncIterable<AIGenerateChunk>;
  healthCheck(): Promise<'READY' | 'ERROR' | 'OFFLINE'>;
}

// In-memory secret store for the prototype
const secretStore = new Map<string, string>();

function getSecret(ref: string): string | undefined {
  return secretStore.get(ref);
}

function setSecret(ref: string, secret: string) {
  secretStore.set(ref, secret);
}

export class GeminiAdapter implements AIProviderAdapter {
  id: string;
  config: AIProviderConfig;
  private ai: GoogleGenAI;

  constructor(config: AIProviderConfig) {
    this.id = config.id;
    this.config = config;
    const key = config.apiKeyRef ? getSecret(config.apiKeyRef) : process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Gemini API Key missing");
    this.ai = new GoogleGenAI({ apiKey: key });
  }

  async healthCheck(): Promise<'READY' | 'ERROR' | 'OFFLINE'> {
    try {
      await this.ai.models.generateContent({
        model: this.config.defaultModel || 'gemini-3.6-flash',
        contents: 'hello',
        config: { maxOutputTokens: 1 }
      });
      return 'READY';
    } catch (e) {
      return 'ERROR';
    }
  }

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const contents = request.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.content }]
    }));

    const response = await this.ai.models.generateContent({
      model: request.metadata?.overrideModel || this.config.defaultModel,
      contents,
      config: {
        systemInstruction: request.systemPrompt,
        temperature: request.temperature,
        tools: request.useGoogleSearch ? [{ googleSearch: {} }] : undefined,
        responseSchema: request.responseSchema,
        responseModalities: request.responseModalities as any,
        speechConfig: request.speechConfig
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    return {
      content: response.text || '',
      audioBase64: base64Audio,
      providerId: this.id,
      model: this.config.defaultModel,
      grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks ? {
        sources: response.candidates[0].groundingMetadata.groundingChunks
          .map(c => c.web?.uri && c.web?.title ? { url: c.web.uri, title: c.web.title } : null)
          .filter(Boolean) as { url: string; title: string }[]
      } : undefined
    };
  }

  async *stream(request: AIGenerateRequest): AsyncIterable<AIGenerateChunk> {
    const contents = request.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.content }]
    }));

    const responseStream = await this.ai.models.generateContentStream({
      model: this.config.defaultModel,
      contents,
      config: {
        systemInstruction: request.systemPrompt,
        temperature: request.temperature,
        tools: request.useGoogleSearch ? [{ googleSearch: {} }] : undefined
      }
    });

    for await (const chunk of responseStream) {
      yield { text: chunk.text, isDone: false };
    }
    yield { text: '', isDone: true };
  }
}

export class OpenAICompatibleAdapter implements AIProviderAdapter {
  id: string;
  config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.id = config.id;
    this.config = config;
  }

  private get headers() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKeyRef) {
      const key = getSecret(this.config.apiKeyRef);
      if (key) headers['Authorization'] = `Bearer ${key}`;
    }
    return headers;
  }

  async healthCheck(): Promise<'READY' | 'ERROR' | 'OFFLINE'> {
    if (!this.config.baseUrl) return 'ERROR';
    try {
      const url = this.config.baseUrl.replace(/\/$/, '') + '/models';
      const res = await fetch(url, { headers: this.headers });
      if (res.ok) return 'READY';
      // fallback health check
      const chatRes = await fetch(this.config.baseUrl.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ model: this.config.defaultModel, messages: [{role: 'user', content: 'test'}], max_tokens: 1 })
      });
      return chatRes.ok ? 'READY' : 'ERROR';
    } catch {
      return 'OFFLINE';
    }
  }

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const url = this.config.baseUrl!.replace(/\/$/, '') + '/chat/completions';
    
    let messages = [...request.messages];
    if (request.systemPrompt) {
      messages = [{ role: 'system', content: request.systemPrompt }, ...messages];
    }

    // Convert GenAI schema to JSON schema if provided
    let response_format;
    if (request.responseSchema) {
      // Basic recursive mapping for demo purposes
      const mapSchema = (s: any): any => {
        if (!s) return s;
        if (s.type === 'OBJECT' || s.type === 'object') {
          const props: any = {};
          for (const k in s.properties) {
            props[k] = mapSchema(s.properties[k]);
          }
          return { type: 'object', properties: props, required: s.required };
        }
        if (s.type === 'ARRAY' || s.type === 'array') {
          return { type: 'array', items: mapSchema(s.items) };
        }
        if (s.type === 'STRING' || s.type === 'string') return { type: 'string' };
        if (s.type === 'INTEGER' || s.type === 'number') return { type: 'number' };
        return s;
      };
      
      response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'response',
          schema: mapSchema(request.responseSchema),
          strict: true
        }
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: this.config.defaultModel,
        messages,
        temperature: request.temperature,
        max_tokens: request.maxOutputTokens,
        response_format
      })
    });

    if (!res.ok) {
      throw new Error(`OpenAI-Compatible API Error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      providerId: this.id,
      model: this.config.defaultModel
    };
  }

  async *stream(request: AIGenerateRequest): AsyncIterable<AIGenerateChunk> {
    const url = this.config.baseUrl!.replace(/\/$/, '') + '/chat/completions';
    
    let messages = [...request.messages];
    if (request.systemPrompt) {
      messages = [{ role: 'system', content: request.systemPrompt }, ...messages];
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: this.config.defaultModel,
        messages,
        temperature: request.temperature,
        stream: true
      })
    });

    if (!res.ok) {
      throw new Error(`OpenAI-Compatible API Error: ${res.status} ${res.statusText}`);
    }

    if (!res.body) throw new Error("No response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith('data: ')) {
          const dataStr = t.replace('data: ', '').trim();
          if (dataStr === '[DONE]') {
            yield { text: '', isDone: true };
            return;
          }
          try {
            const data = JSON.parse(dataStr);
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              yield { text: content, isDone: false };
            }
          } catch(e) {}
        }
      }
    }
    yield { text: '', isDone: true };
  }
}
