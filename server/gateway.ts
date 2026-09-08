import { 
  AIProviderConfig, 
  AIGenerateRequest, 
  AIGenerateResponse,
  AIProviderConfigInput
} from '../src/types/ai';
import { AIProviderAdapter, GeminiAdapter, OpenAICompatibleAdapter } from './adapters';

export class AIGatewayRouter {
  private providers: Map<string, AIProviderAdapter> = new Map();
  private configs: AIProviderConfig[] = [];

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    const defaultGemini: AIProviderConfig = {
      id: 'default-gemini',
      name: 'BKG Default Gemini',
      type: 'gemini',
      defaultModel: 'gemini-3.6-flash',
      models: [],
      capabilities: {
        chat: true, streaming: true, analysis: true, structuredOutput: true,
        agentGeneration: true, discussion: true, liveChat: true, grounding: true,
        search: true, vision: true, embeddings: true, tts: false, functionCalling: true, toolCalling: true
      },
      enabled: true,
      isPrimary: true,
      priority: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.addProviderConfig(defaultGemini);
  }

  addProviderConfig(config: AIProviderConfig, secretKey?: string) {
    this.configs = this.configs.filter(c => c.id !== config.id);
    
    // If saving a new primary, demote others
    if (config.isPrimary) {
      this.configs.forEach(c => c.isPrimary = false);
    }
    
    this.configs.push(config);
    this.configs.sort((a, b) => a.priority - b.priority);

    let adapter: AIProviderAdapter;
    if (config.type === 'gemini') {
      adapter = new GeminiAdapter(config);
    } else {
      adapter = new OpenAICompatibleAdapter(config);
    }
    this.providers.set(config.id, adapter);
  }

  getProviders() {
    return this.configs;
  }
  
  getProviderAdapter(id: string): AIProviderAdapter | undefined {
    return this.providers.get(id);
  }

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    if (request.targetProviderId) {
      const adapter = this.providers.get(request.targetProviderId);
      if (!adapter) throw new Error(`Target provider ${request.targetProviderId} not found`);
      return adapter.generate(request);
    }

    const availableAdapters = this.configs
      .filter(c => c.enabled)
      .map(c => this.providers.get(c.id))
      .filter(Boolean) as AIProviderAdapter[];

    if (availableAdapters.length === 0) {
      throw new Error("No AI Providers configured and enabled");
    }

    // Try primary, then fallback
    let lastError = null;
    let fallbackUsed = false;

    for (const adapter of availableAdapters) {
      try {
        const response = await adapter.generate(request);
        return { ...response, fallbackUsed };
      } catch (err: any) {
        lastError = err;
        fallbackUsed = true;
        console.error(`Provider ${adapter.id} failed:`, err.message);
        // Continue to next provider in fallback chain
      }
    }

    throw new Error(`All providers failed. Last error: ${lastError?.message}`);
  }

  async stream(request: AIGenerateRequest) {
    if (request.targetProviderId) {
      const adapter = this.providers.get(request.targetProviderId);
      if (!adapter) throw new Error(`Target provider ${request.targetProviderId} not found`);
      return adapter.stream(request);
    }

    const availableAdapters = this.configs
      .filter(c => c.enabled)
      .map(c => this.providers.get(c.id))
      .filter(Boolean) as AIProviderAdapter[];

    if (availableAdapters.length === 0) {
      throw new Error("No AI Providers configured and enabled");
    }

    // Streaming is trickier with automatic fallback mid-stream, 
    // so we attempt the connection and if it throws immediately, we fallback.
    let lastError = null;
    for (const adapter of availableAdapters) {
      try {
        // Just return the iterable, we can't easily peek without consuming
        // We assume if the generator is created, the routing is established.
        // A deeper implementation would await the first chunk.
        return adapter.stream(request);
      } catch (err: any) {
        lastError = err;
        console.error(`Provider ${adapter.id} stream failed:`, err.message);
      }
    }
    
    throw new Error(`All providers failed to stream. Last error: ${lastError?.message}`);
  }
}

export const aiGateway = new AIGatewayRouter();
