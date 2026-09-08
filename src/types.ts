export type Role = 'user' | 'experts';
export type VoicePersona = 'Professional' | 'Casual' | 'Energetic';
export type ExpertPair = 'General' | 'Tech Focused' | 'Ethical Reviewers' | 'Academic Researchers' | string;
export type Language = 'English' | 'Deutsch';

export interface SourceReference {
  id: string;
  title: string;
  url?: string;
  domain?: string;
  description?: string;
  discussionMessageId?: string;
  discussionSegmentId?: string;
  claim?: string;
  relevance?: string;
  paragraphIndex?: number;
}

export interface ExternalAIParticipant {
  id: string;
  provider: 'ChatGPT' | 'Claude' | 'OpenCode' | 'Codex' | 'Gemini' | 'Custom';
  name: string;
  status: 'connecting' | 'context_sync' | 'connected' | 'error';
  joinedAt: string;
}

export interface LiveChatMessage {
  id: string;
  sessionId: string;
  senderType: 'user' | 'assistant' | 'agent' | 'system' | 'external';
  senderId?: string;
  senderName?: string;
  content: string;
  sourceIds?: string[];
  claimIds?: string[];
  discussionSegmentIds?: string[];
  createdAt: string;
  audioAvailable?: boolean;
  ttsStatus?: "idle" | "generating" | "ready" | "playing" | "error";
}

export interface LiveAIState {
  invited: boolean;
  online: boolean;
  mode: "passive" | "attentive" | "active";
  thinking: "idle" | "reading" | "detecting_question" | "verifying" | "answering" | "moderating";
  ttsEnabled: boolean;
  groundingEnabled: boolean;
  pendingQuestionId?: string;
  externalParticipants?: ExternalAIParticipant[];
}

export interface Session {
  id: string;
  title: string;
  updatedAt: number;
  appState: 'upload' | 'analyzing' | 'discussion';
  inputText: string;
  messages: Message[];
  liveChat?: LiveChatMessage[];
  liveAIState?: LiveAIState;
  voicePersona: VoicePersona;
  expertPair: ExpertPair;
  language?: Language;
  useGoogleSearch?: boolean;
}


export interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  source: string;
  url?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string; // The script or the user prompt
  summary?: string;
  inconsistencies?: string[];
  citations?: string[];
  sourceReferences?: SourceReference[];
  audioCache?: Record<string, string>;
  suggestedTopics?: string[];
}

export interface AnalysisResponse {
  summary: string;
  inconsistencies: string[];
  citations: string[];
  sourceReferences?: SourceReference[];
  script: string;
  suggestedTopics: string[];
  error?: string;
}

export interface DiscussResponse {
  script: string;
  citations: string[];
  sourceReferences?: SourceReference[];
  suggestedTopics: string[];
  error?: string;
}

