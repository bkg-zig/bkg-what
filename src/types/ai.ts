export interface AICapabilities {
  chat: boolean;
  streaming: boolean;
  analysis: boolean;
  structuredOutput: boolean;
  agentGeneration: boolean;
  discussion: boolean;
  liveChat: boolean;
  grounding: boolean;
  search: boolean;
  vision: boolean;
  embeddings: boolean;
  tts: boolean;
  functionCalling: boolean;
  toolCalling: boolean;
}

export interface AIModelConfig {
  id: string;
  providerId: string;
  model: string;
  displayName?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  temperature?: number;
  capabilities: AICapabilities;
  enabled: boolean;
  priority?: number;
}

export interface AIProviderConfig {
  id: string;
  name: string;
  type: "gemini" | "openai" | "anthropic" | "openai_compatible" | "custom";
  baseUrl?: string;
  apiKeyRef?: string; // Reference ID, not the actual key
  defaultModel: string;
  models: AIModelConfig[];
  capabilities: AICapabilities;
  enabled: boolean;
  isPrimary?: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  status?: 'READY' | 'CONNECTING' | 'DEGRADED' | 'RATE_LIMITED' | 'ERROR' | 'OFFLINE';
}

export interface AIProviderConfigInput extends Omit<AIProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'apiKeyRef'> {
  apiKey?: string; // Only used during creation/update
}

export interface AIRequestRequirements {
  streaming?: boolean;
  structuredOutput?: boolean;
  grounding?: boolean;
  search?: boolean;
  embeddings?: boolean;
  tts?: boolean;
  toolCalling?: boolean;
  maxContextTokens?: number;
}

export interface AIGenerateRequest {
  systemPrompt?: string;
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  requirements?: AIRequestRequirements;
  temperature?: number;
  maxOutputTokens?: number;
  responseSchema?: any;
  responseModalities?: string[];
  speechConfig?: any;
  tools?: any[];
  metadata?: Record<string, string>;
  
  // Specific internal flags
  useGoogleSearch?: boolean;
  targetProviderId?: string; // If explicitly requesting a specific provider (e.g. external participant)
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: any;
}

export interface AIGroundingResult {
  sources: { title: string; url: string; snippet?: string }[];
}

export interface AIGenerateResponse {
  content: string;
  audioBase64?: string;
  providerId: string;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  finishReason?: string;
  toolCalls?: AIToolCall[];
  grounding?: AIGroundingResult;
  fallbackUsed?: boolean;
}

export interface AIExecutionTrace {
  providerId: string;
  modelId: string;
  startedAt: string;
  completedAt?: string;
  fallbackUsed: boolean;
  capabilitiesUsed: string[];
  errorCode?: string;
}
