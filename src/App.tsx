import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileText, Send, Mic, Play, Square, Loader2, File, ChevronRight, AlertCircle, CheckCircle2, Database, BookOpen, Download, Settings, Menu, Plus, Trash2, X, BrainCircuit, Globe, Users, Search, Bot, Server } from 'lucide-react';
import { Message, AnalysisResponse, DiscussResponse, VoicePersona, Session, ExpertPair, Language } from './types';
import { playPCMBase64, classNames } from './utils';
import { knowledgeBase } from './data/knowledge';
import { KnowledgeBasePanel } from './components/KnowledgeBase';
import { TermHeatmap } from './components/TermHeatmap';
import { AgentsPanel, CustomAgent } from './components/AgentsPanel';
import { LiveAIPanel } from './components/LiveAIPanel';
import { ProviderDashboard } from './components/ProviderDashboard';
import { getT } from './i18n';

const loadState = <T,>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to parse local storage", e);
  }
  return defaultValue;
};

const getExpertInstruction = (name: string): string => {
  if (['General', 'Tech Focused', 'Ethical Reviewers', 'Academic Researchers'].includes(name)) {
    return name;
  }
  try {
    const saved = localStorage.getItem('expertAI_customAgents');
    if (saved) {
      const agents = JSON.parse(saved);
      const names = name.split(' & ');
      let result = '';
      names.forEach((n, idx) => {
        const agent = agents.find((a: any) => a.name === n);
        if (agent) {
          let combined = `Agent ${idx + 1} (${n}):\n${agent.instruction}`;
          if (agent.specialties) combined += `\nSpezialgebiete: ${agent.specialties}`;
          if (agent.strengths) combined += `\nStärken: ${agent.strengths}`;
          if (agent.weaknesses) combined += `\nSchwächen: ${agent.weaknesses}`;
          if (agent.personality) combined += `\nPersönlichkeit: ${agent.personality}`;
          if (agent.analysisFocus) combined += `\nAnalysefokus: ${agent.analysisFocus}`;
          result += combined + '\n\n';
        }
      });
      if (result) return result.trim();
    }
  } catch (e) {}
  return name;
};
import { LoadingProvider, useLoading } from "./contexts/LoadingContext";

export function AppContent() {
  const { startLoading, stopLoading } = useLoading();
  const loadInitialState = () => {
    const loadedSessions: Session[] = loadState('expertAI_sessions', []);
    let activeId = loadState('expertAI_currentSessionId', null) as string | null;
    
    if (!activeId && loadedSessions.length > 0) {
      activeId = loadedSessions[0].id;
    }
    
    let activeSession = loadedSessions.find(s => s.id === activeId);
    
    if (!activeSession) {
      // Legacy migration from old state if exists
      const oldStateStr = localStorage.getItem('expertAI_state');
      if (oldStateStr) {
        try {
          const oldState = JSON.parse(oldStateStr);
          activeSession = {
            id: Date.now().toString(),
            title: oldState.messages?.length > 0 ? (oldState.messages[0].content?.substring(0, 30) + '...') : 'Migrated Session',
            updatedAt: Date.now(),
            appState: oldState.appState || 'upload',
            inputText: oldState.inputText || '',
            messages: oldState.messages || [],
            voicePersona: oldState.voicePersona || 'Professional',
            expertPair: 'General',
            language: oldState.language || 'English'
          };
          loadedSessions.push(activeSession);
          localStorage.removeItem('expertAI_state');
        } catch (e) {}
      }

      if (!activeSession) {
        activeSession = {
          id: Date.now().toString(),
          title: 'Neue Analyse',
          updatedAt: Date.now(),
          appState: 'upload',
          inputText: '',
          messages: [],
          voicePersona: 'Professional',
          expertPair: 'General',
          language: 'Deutsch'
        };
        loadedSessions.push(activeSession);
      }
      activeId = activeSession.id;
    }
    
    return { sessions: loadedSessions, activeSession };
  };

  const initialState = useRef(loadInitialState()).current;

  const [sessions, setSessions] = useState<Session[]>(initialState.sessions);
  const [currentSessionId, setCurrentSessionId] = useState<string>(initialState.activeSession.id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [appState, setAppState] = useState<'upload' | 'analyzing' | 'discussion'>(initialState.activeSession.appState);
  const [inputText, setInputText] = useState(initialState.activeSession.inputText);
  const [messages, setMessages] = useState<Message[]>(initialState.activeSession.messages);
  const [voicePersona, setVoicePersona] = useState<VoicePersona>(initialState.activeSession.voicePersona);
  const [expertPair, setExpertPair] = useState<ExpertPair>(initialState.activeSession.expertPair || 'General');
  const [language, setLanguage] = useState<Language>(initialState.activeSession.language || 'Deutsch');
  const [useGoogleSearch, setUseGoogleSearch] = useState<boolean>(initialState.activeSession.useGoogleSearch || false);
  const [liveChat, setLiveChat] = useState<LiveChatMessage[]>(initialState.activeSession.liveChat || []);
  const [activeAudioProgress, setActiveAudioProgress] = useState<{ msgId: string, paragraphIndex: number } | null>(null);

  const [isTyping, setIsTyping] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);

  const [activeAudio, setActiveAudio] = useState<{ stop: () => void, msgId: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isKbOpen, setIsKbOpen] = useState(false);
  const [isAgentsOpen, setIsAgentsOpen] = useState(false);
  const [isLiveAIOpen, setIsLiveAIOpen] = useState(false);
  const [showExternalInviteTab, setShowExternalInviteTab] = useState(false);
  const [isProviderDashboardOpen, setIsProviderDashboardOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const activeSession = sessions.find(s => s.id === currentSessionId);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (activeAudioProgress) {
      const paragraphEl = document.getElementById(`msg-${activeAudioProgress.msgId}-p-${activeAudioProgress.paragraphIndex}`);
      if (paragraphEl) {
        paragraphEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeAudioProgress]);

  useEffect(() => {
    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id === currentSessionId) {
          const messagesToSave = messages.map(msg => {
            const { audioCache, ...rest } = msg;
            return rest;
          });
          
          let title = s.title;
          if (messages.length > 0 && (s.title === 'Neue Analyse' || s.title === 'New Analysis')) {
            const firstMsg = messages[0].summary || messages[0].content || inputText;
            title = (firstMsg.substring(0, 30) || 'Analyse') + '...';
          }

          return {
            ...s,
            title,
            updatedAt: Date.now(),
            appState: appState === 'analyzing' ? (messages.length > 0 ? 'discussion' : 'upload') : appState,
            inputText,
            messages: messagesToSave,
            liveChat,
            voicePersona,
            expertPair,
            language,
            useGoogleSearch
          };
        }
        return s;
      });
      localStorage.setItem('expertAI_sessions', JSON.stringify(updated));
      localStorage.setItem('expertAI_currentSessionId', JSON.stringify(currentSessionId));
      return updated;
    });
  }, [appState, inputText, messages, liveChat, voicePersona, expertPair, language, useGoogleSearch, currentSessionId]);

  const switchSessionInternal = (session: Session) => {
    setCurrentSessionId(session.id);
    setAppState(session.appState);
    setInputText(session.inputText);
    setMessages(session.messages);
    setLiveChat(session.liveChat || []);
    setVoicePersona(session.voicePersona);
    setExpertPair(session.expertPair || 'General');
    setLanguage(session.language || 'Deutsch');
    setUseGoogleSearch(session.useGoogleSearch || false);
    stopAudio();
  };

  const switchSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session && session.id !== currentSessionId) {
      switchSessionInternal(session);
      setIsSidebarOpen(false);
    }
  };

  const createNewSession = () => {
    const newSession: Session = {
      id: Date.now().toString(),
      title: 'Neue Analyse',
      updatedAt: Date.now(),
      appState: 'upload',
      inputText: '',
      messages: [],
      voicePersona: 'Professional',
      expertPair: 'General',
      language: 'Deutsch',
      useGoogleSearch: false
    };
    setSessions(prev => [newSession, ...prev]);
    switchSessionInternal(newSession);
    setIsSidebarOpen(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    if (updated.length === 0) {
      const newSession: Session = {
        id: Date.now().toString(),
        title: 'Neue Analyse',
        updatedAt: Date.now(),
        appState: 'upload',
        inputText: '',
        messages: [],
        voicePersona: 'Professional',
        expertPair: 'General',
        language: 'Deutsch',
        useGoogleSearch: false
      };
      setSessions([newSession]);
      switchSessionInternal(newSession);
    } else {
      setSessions(updated);
      if (currentSessionId === id) {
        switchSessionInternal(updated[0]);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setInputText(text);
    };
    reader.readAsText(file);
  };

  const startAnalysis = async () => {
    if (!inputText.trim()) return;
    setAppState('analyzing');
    startLoading('analyze', 'ANALYSE PIPELINE ... AGENT GENERATION');

    try {
      const resolvedExpertPair = getExpertInstruction(expertPair);

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: inputText, 
          knowledgeBaseStr: JSON.stringify(knowledgeBase),
          expertPair: resolvedExpertPair,
          language,
          useGoogleSearch
        }),
      });
      const data: AnalysisResponse = await res.json();

      if (data.error) throw new Error(data.error);

      stopLoading('analyze');

      setMessages([{
        id: Date.now().toString(),
        role: 'experts',
        content: data.script,
        summary: data.summary,
        inconsistencies: data.inconsistencies,
        citations: data.citations,
        sourceReferences: data.sourceReferences,
        suggestedTopics: data.suggestedTopics,
        audioCache: {},
      }]);
      setAppState('discussion');
    } catch (err) {
      stopLoading('analyze');
      console.error(err);
      alert('Failed to analyze the text. Please try again.');
      setAppState('upload');
    }
  };

  const sendPrompt = async (promptText: string) => {
    if (!promptText.trim()) return;
    
    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: promptText,
    };
    
    setMessages(prev => [...prev, userMsg]);
    setUserPrompt('');
    setIsTyping(true);
    startLoading('discuss', 'DISCUSSION SYNTHESIS IN PROGRESS');

    try {
      const historyText = messages.map(m => `${m.role === 'user' ? 'User' : 'Experts'}: ${m.content}`).join('\n\n');
      
      const resolvedExpertPair = getExpertInstruction(expertPair);

      const res = await fetch('/api/discuss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          history: historyText, 
          userPrompt: promptText,
          knowledgeBaseStr: JSON.stringify(knowledgeBase),
          expertPair: resolvedExpertPair,
          language,
          useGoogleSearch
        }),
      });
      
      const data: DiscussResponse = await res.json();
      
      if (data.error) throw new Error(data.error);

      stopLoading('discuss');

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'experts',
        content: data.script,
        citations: data.citations,
        sourceReferences: data.sourceReferences,
        suggestedTopics: data.suggestedTopics,
        audioCache: {},
      }]);
    } catch (err) {
      stopLoading('discuss');
      console.error(err);
      alert('Failed to get response.');
    } finally {
      setIsTyping(false);
    }
  };

  const handlePlayAudio = async (msg: Message) => {
    if (activeAudio?.msgId === msg.id) {
      stopAudio();
      return;
    }
    stopAudio();

    if (msg.audioCache?.[voicePersona]) {
      playCached(msg.audioCache[voicePersona], msg.id);
      return;
    }

    setAudioLoadingId(msg.id);
    startLoading('tts', 'AUDIO GENERATION ACTIVE');
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: msg.content, persona: voicePersona }),
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      stopLoading('tts');

      setMessages(prev => prev.map(m => 
        m.id === msg.id 
          ? { ...m, audioCache: { ...(m.audioCache || {}), [voicePersona]: data.audio } }
          : m
      ));
      
      playCached(data.audio, msg.id);
    } catch (err) {
      stopLoading('tts');
      console.error(err);
      alert('Failed to generate audio for this persona.');
    } finally {
      setAudioLoadingId(null);
    }
  };

  const playCached = (base64Audio: string, msgId: string) => {
    const audioControl = playPCMBase64(base64Audio);
    setIsPlaying(true);
    
    const msg = messages.find(m => m.id === msgId);
    let interval: NodeJS.Timeout | null = null;
    
    if (msg) {
      const paragraphs = msg.content.split('\n').filter(l => l.trim().length > 0);
      const totalLength = paragraphs.reduce((acc, p) => acc + p.length, 0);
      
      interval = setInterval(() => {
        const time = audioControl.getCurrentTime();
        const duration = audioControl.getDuration();
        
        if (duration > 0 && paragraphs.length > 0) {
          const progress = Math.min(1, time / duration);
          const targetChar = progress * totalLength;
          let currChar = 0;
          let pIndex = 0;
          for (let i = 0; i < paragraphs.length; i++) {
            currChar += paragraphs[i].length;
            if (currChar >= targetChar) {
              pIndex = i;
              break;
            }
          }
          setActiveAudioProgress({ msgId, paragraphIndex: pIndex });
        }
      }, 150);
    }

    const stop = () => {
      if (interval) clearInterval(interval);
      audioControl.stop();
      setActiveAudioProgress(null);
    };

    setActiveAudio({ stop, msgId });
    
    audioControl.onEnded(() => {
      if (interval) clearInterval(interval);
      setActiveAudio(null);
      setActiveAudioProgress(null);
      setIsPlaying(false);
    });
  };

  const stopAudio = () => {
    if (activeAudio) {
      activeAudio.stop();
      setActiveAudio(null);
      setActiveAudioProgress(null);
      setIsPlaying(false);
    }
  };

  const downloadMarkdown = () => {
    if (messages.length === 0) return;

    let md = '# ExpertAI Analyse & Diskurs\n\n';

    messages.forEach((msg) => {
      if (msg.role === 'user') {
        md += `## Du\n\n${msg.content}\n\n`;
      } else {
        if (msg.summary) {
          md += `## Zusammenfassung\n\n${msg.summary}\n\n`;
        }
        if (msg.inconsistencies && msg.inconsistencies.length > 0) {
          md += `## Kritische Analyse\n\n`;
          msg.inconsistencies.forEach((inc) => {
            md += `- ${inc}\n`;
          });
          md += '\n';
        }

        md += `## KI Experten\n\n`;
        msg.content.split('\n').forEach((line) => {
          if (line.trim()) {
            md += `${line}\n\n`;
          }
        });

        if (msg.citations && msg.citations.length > 0) {
          md += `### Verwendete Quellen\n\n`;
          msg.citations.forEach((cit) => {
            md += `- ${cit}\n`;
          });
          md += '\n';
        }
      }
      md += '---\n\n';
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expertai-analyse.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] font-sans selection:bg-[var(--accent-cyan)] selection:text-black">
      
      {/* Session Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-[var(--bg-panel)] border-r border-[var(--border)] shadow-[10px_0_30px_rgba(0,0,0,0.8)] z-50 flex flex-col"
            >
              <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--border)] bg-[var(--bg-panel-high)] shrink-0">
                <h2 className="text-[10px] font-mono tracking-widest text-[var(--text-primary)] flex items-center gap-2 uppercase">
                  <Menu className="w-3.5 h-3.5 text-[var(--accent-cyan)]" />
                  {getT(language)('sessions')}
                </h2>
                <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:text-[var(--accent-cyan)] text-[var(--text-muted)] lg:hidden transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-4 border-b border-[var(--border)]">
                <button
                  onClick={createNewSession}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-[var(--accent-cyan)]/10 hover:bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30 text-[10px] font-mono tracking-widest uppercase transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {getT(language)('initiateNew')}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-2 py-4 space-y-2 custom-scrollbar">
                {sessions.sort((a,b) => b.updatedAt - a.updatedAt).map(s => (
                  <div
                    key={s.id}
                    onClick={() => switchSession(s.id)}
                    className={classNames(
                      "group flex items-center justify-between p-3 cursor-pointer transition-colors border",
                      currentSessionId === s.id 
                        ? "bg-[var(--bg-secondary)] border-[var(--accent-cyan)]/50 text-[var(--text-primary)]" 
                        : "bg-[var(--bg-panel-high)] border-[var(--border)] hover:border-[var(--accent-cyan)]/30 text-[var(--text-secondary)]"
                    )}
                  >
                    <div className="truncate flex-1">
                      <p className="text-xs font-mono truncate">{s.title}</p>
                      <p className="text-[9px] font-mono text-[var(--text-muted)] mt-1 uppercase tracking-widest">
                        {new Date(s.updatedAt).toLocaleDateString()} // {s.expertPair.substring(0, 10)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteSession(s.id, e)}
                      className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-[var(--status-error)]/10 hover:text-[var(--status-error)] text-[var(--text-muted)] transition-all"
                      title={getT(language)('deleteSession')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className="border-b border-[var(--border)] bg-[var(--bg-panel)] sticky top-0 z-40 h-14 flex items-center justify-between px-4 font-mono text-[var(--text-muted)] text-[10px] sm:text-xs tracking-widest uppercase">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 hover:bg-[var(--bg-panel-high)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-2"
            title={getT(language)('viewSessions')}
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 text-[var(--accent-cyan)] font-medium">
            <span className="hidden sm:inline">BKG AI EXPERTS</span>
            <span className="w-1.5 h-1.5 bg-[var(--accent-cyan)] rounded-full animate-pulse shadow-[0_0_8px_var(--accent-cyan)]" />
            <span className="hidden md:inline text-[var(--text-primary)]">{getT(language)('systemOnline')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden lg:flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-transparent border-none text-[var(--text-secondary)] outline-none cursor-pointer focus:ring-0 [&>option]:bg-[var(--bg-panel-high)] uppercase"
            >
              <option value="English">EN</option>
              <option value="Deutsch">DE</option>
            </select>
          </div>
          <button
            onClick={() => setUseGoogleSearch(!useGoogleSearch)}
            className={classNames(
              "flex items-center gap-2 transition-colors uppercase tracking-widest px-2 py-1",
              useGoogleSearch 
                ? "text-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)]/30" 
                : "hover:text-[var(--text-primary)] border border-transparent"
            )}
          >
            <span className="w-1.5 h-1.5" style={{ backgroundColor: useGoogleSearch ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
            {useGoogleSearch ? getT(language)('searchActive') : getT(language)('searchOff')}
          </button>
          <button
            onClick={() => setIsAgentsOpen(true)}
            className="flex items-center gap-2 hover:text-[var(--text-primary)] transition-colors px-2 py-1"
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{expertPair.length > 15 ? expertPair.substring(0, 15) + '...' : expertPair}</span>
          </button>
          <button
            onClick={() => setIsProviderDashboardOpen(true)}
            className="flex items-center gap-2 hover:text-[var(--text-primary)] transition-colors px-2 py-1"
            title="AI Infrastructure"
          >
            <Server className="w-3.5 h-3.5" />
          </button>
          <div className="hidden lg:flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <select
              value={voicePersona}
              onChange={(e) => setVoicePersona(e.target.value as VoicePersona)}
              className="bg-transparent border-none text-[var(--text-secondary)] outline-none cursor-pointer focus:ring-0 [&>option]:bg-[var(--bg-panel-high)] uppercase"
            >
              <option value="Professional">PROF</option>
              <option value="Casual">CASUAL</option>
              <option value="Energetic">ENERGY</option>
            </select>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => {
                setShowExternalInviteTab(true);
                setIsLiveAIOpen(true);
              }}
              className="flex items-center gap-2 hover:text-[var(--accent-cyan)] text-[var(--accent-cyan)] transition-colors px-2 py-1 border border-transparent hover:border-[var(--accent-cyan)]/30 rounded-sm"
              title="Invite External AI"
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">+ EXTERNE KI</span>
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => {
                setShowExternalInviteTab(false);
                setIsLiveAIOpen(true);
              }}
              className="flex items-center gap-2 hover:text-[var(--accent-violet)] text-[var(--accent-violet)] transition-colors px-2 py-1 border border-transparent hover:border-[var(--accent-violet)]/30 rounded-sm"
              title="Live AI Assistant"
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">LIVE AI</span>
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={downloadMarkdown}
              className="flex items-center gap-2 px-2 py-1 rounded-sm text-[var(--accent-cyan)] hover:bg-[var(--bg-panel-high)] transition-colors"
              title="Exportieren"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {isPlaying && (
            <button 
              onClick={stopAudio}
              className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--status-error)]/10 text-[var(--status-error)] hover:bg-[var(--status-error)]/20 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span className="hidden md:inline">STOP</span>
            </button>
          )}
          <button
            onClick={() => setIsKbOpen(true)}
            className="flex items-center gap-2 hover:text-[var(--text-primary)] transition-colors px-2 py-1"
          >
            <Database className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-8 w-full">
        <AnimatePresence mode="wait">
          {appState === 'upload' && (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-3xl mx-auto mt-12"
            >
              <div className="text-center mb-10">
                <h2 className="text-2xl font-mono text-[var(--text-primary)] mb-4 tracking-widest uppercase">{getT(language)('analysisCommandCenter')}</h2>
                <p className="text-[var(--text-secondary)] text-sm">{getT(language)('uploadDescription')}</p>
              </div>

              <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-sm shadow-[0_4px_24px_rgba(0,0,0,0.5)] overflow-hidden">
                <div className="h-8 border-b border-[var(--border)] bg-[var(--bg-panel-high)] px-4 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-widest uppercase">{getT(language)('inputAnalysis')}</span>
                  <span className="font-mono text-[10px] text-[var(--status-success)] flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] animate-pulse" />{getT(language)('ready')}</span>
                </div>
                <div className="p-6">
                  <div className="relative">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={getT(language)('placeholderInput')}
                      className="w-full h-64 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-sm p-4 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)] resize-none transition-all placeholder:text-[var(--text-muted)]"
                    />
                    <div className="absolute bottom-4 left-4">
                      <label className="cursor-pointer flex items-center gap-2 px-4 py-2 hover:bg-[var(--bg-panel-high)] rounded text-xs text-[var(--text-secondary)] transition-colors border border-[var(--border)]">
                        <FileText className="w-4 h-4" />
                        <span>{getT(language)('loadSource')}</span>
                        <input 
                          type="file" 
                          accept=".txt,.md,.json,.csv"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </label>
                    </div>
                    <div className="absolute bottom-4 right-4">
                      <button
                        onClick={startAnalysis}
                        disabled={!inputText.trim()}
                        className="flex items-center gap-2 px-6 py-2 bg-[var(--bg-panel)] border border-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10 disabled:border-[var(--border)] disabled:text-[var(--text-muted)] disabled:hover:bg-transparent text-[var(--accent-cyan)] rounded text-xs font-mono font-medium transition-colors"
                      >
                        <Loader2 className="w-4 h-4 hidden" />
                        <span>{getT(language)('startAnalysis')}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {appState === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32"
            >
              <div className="w-24 h-24 relative flex items-center justify-center mb-8">
                <div className="absolute inset-0 rounded-full border border-[var(--accent-cyan)]/20 animate-ping" />
                <div className="absolute inset-0 rounded-full border-t border-[var(--accent-cyan)] animate-spin" />
                <BrainCircuit className="w-8 h-8 text-[var(--accent-cyan)]" />
              </div>
              <h3 className="text-sm font-mono text-[var(--text-primary)] mb-3 tracking-widest uppercase">{getT(language)('systemProcessing')}</h3>
              <p className="text-[var(--accent-cyan)] font-mono text-xs text-center max-w-sm mb-8 animate-pulse">{getT(language)('initiatingPipeline')}</p>
            </motion.div>
          )}

          {appState === 'discussion' && (
            <motion.div
              key="discussion"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="pb-32"
            >
              <div className="space-y-8">
                {messages.map((msg, index) => (
                  <motion.div 
                    key={msg.id} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className={classNames("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}
                  >
                    {msg.role === 'experts' && msg.summary && (
                      <div className="w-full mb-8 bg-[var(--bg-panel)] border border-[var(--border)] rounded shadow-[0_4px_24px_rgba(0,0,0,0.5)] p-6 md:p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent-cyan)] to-transparent opacity-20" />
                        
                        <div className="flex items-center gap-3 mb-6 border-b border-[var(--border)] pb-4">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-[var(--status-success)] rounded-full animate-pulse" />
                            <h3 className="text-sm font-mono text-[var(--text-primary)] tracking-widest uppercase">{getT(language)('summary')}</h3>
                          </div>
                        </div>
                        <p className="text-[var(--text-primary)] font-sans leading-relaxed text-sm md:text-base mb-8">{msg.summary}</p>

                        {msg.inconsistencies && msg.inconsistencies.length > 0 && (
                          <div className="mb-8 border border-[var(--status-warning)]/20 bg-[var(--status-warning)]/5 rounded p-4">
                            <div className="flex items-center gap-2 mb-4">
                              <AlertCircle className="w-4 h-4 text-[var(--status-warning)]" />
                              <h3 className="text-sm font-mono text-[var(--status-warning)] tracking-widest uppercase">{getT(language)('criticalAnalysis')}</h3>
                            </div>
                            <ul className="space-y-3">
                              {msg.inconsistencies.map((inc, i) => (
                                <li key={i} className="flex gap-3 text-[var(--text-secondary)] text-sm md:text-base font-sans">
                                  <span className="text-[var(--status-warning)] mt-1 font-mono">{'>'}</span>
                                  <span>{inc}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {msg.sourceReferences && msg.sourceReferences.length > 0 ? (
                          <div className="mt-8 pt-6 border-t border-[var(--border)]">
                            <h4 className="text-[10px] font-mono text-[var(--text-muted)] mb-4 flex items-center gap-2 uppercase tracking-widest">
                              <BookOpen className="w-3.5 h-3.5" />
                              {getT(language)('evidenceSources')}
                            </h4>
                            <div className="space-y-2">
                              {msg.sourceReferences.map((ref, i) => (
                                <div key={i} className="p-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded flex flex-col md:flex-row md:items-start justify-between gap-3 group hover:border-[var(--accent-violet)]/50 transition-colors">
                                  <div className="flex-1">
                                    <div className="text-sm font-mono text-[var(--text-primary)] mb-1">
                                      <span className="text-[var(--text-muted)] mr-2">[{String(i + 1).padStart(2, '0')}]</span>
                                      {ref.title}
                                    </div>
                                    {ref.claim && <p className="text-xs text-[var(--text-secondary)] pl-8 border-l border-[var(--border)] ml-3 mt-2 py-1">{ref.claim}</p>}
                                    {ref.paragraphIndex !== undefined && (
                                      <button
                                        onClick={() => {
                                          const el = document.getElementById(`msg-${msg.id}-p-${ref.paragraphIndex}`);
                                          if (el) {
                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            el.classList.add('segment-targeted-highlight');
                                            setTimeout(() => {
                                              el.classList.remove('segment-targeted-highlight');
                                            }, 2500);
                                          }
                                        }}
                                        className="mt-3 ml-8 text-[10px] font-mono text-[var(--accent-violet)] hover:text-[var(--accent-cyan)] flex items-center gap-1 transition-colors uppercase tracking-widest"
                                      >
                                        <ChevronRight className="w-3 h-3" />
                                        {getT(language)('targetSegment')} {ref.paragraphIndex + 1}
                                      </button>
                                    )}
                                  </div>
                                  {ref.url && (
                                    <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-[var(--text-muted)] hover:text-[var(--accent-cyan)] text-[10px] font-mono flex items-center gap-1 shrink-0 uppercase tracking-widest">
                                      {getT(language)('view')} <Globe className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          msg.citations && msg.citations.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-[var(--border)]">
                              <h4 className="text-[10px] font-mono text-[var(--text-muted)] mb-4 flex items-center gap-2 uppercase tracking-widest">
                                <BookOpen className="w-3.5 h-3.5" />
                                {getT(language)('sourcesUsed')}
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {msg.citations.map((citation, i) => (
                                  <span key={i} className="px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[10px] font-mono text-[var(--text-secondary)] uppercase">
                                    {citation}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )
                        )}

                        <div className="mt-8 pt-6 border-t border-[var(--border)]">
                          <TermHeatmap text={inputText} />
                        </div>
                      </div>
                    )}

                    <div className={classNames(
                      "max-w-[90%] md:max-w-[85%] rounded p-5 md:p-6 transition-all duration-300",
                      msg.role === 'user' 
                        ? "bg-[var(--accent-cyan)]/5 border border-[var(--accent-cyan)]/20 text-[var(--text-primary)] rounded-tr-none ml-auto" 
                        : "bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-secondary)] rounded-tl-none w-full"
                    )}>
                      {msg.role === 'experts' && (
                        <div className="flex items-center justify-between mb-6 border-b border-[var(--border)] pb-4">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-[var(--accent-violet)] rounded-full animate-pulse" />
                            <span className="text-[10px] font-mono text-[var(--text-primary)] tracking-widest uppercase">{getT(language)('expertSystemOutput')}</span>
                          </div>
                          <button
                            onClick={() => handlePlayAudio(msg)}
                            disabled={audioLoadingId === msg.id}
                            className={classNames(
                              "flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-mono tracking-widest transition-colors border uppercase",
                              activeAudio?.msgId === msg.id
                                ? "bg-[var(--status-error)]/10 hover:bg-[var(--status-error)]/20 text-[var(--status-error)] border-[var(--status-error)]/30"
                                : "bg-[var(--accent-violet)]/10 hover:bg-[var(--accent-violet)]/20 text-[var(--accent-violet)] border-[var(--accent-violet)]/30 disabled:opacity-50"
                            )}
                          >
                            {audioLoadingId === msg.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : activeAudio?.msgId === msg.id ? (
                              <Square className="w-3 h-3 fill-current" />
                            ) : (
                              <Play className="w-3 h-3 fill-current" />
                            )}
                            <span>
                              {audioLoadingId === msg.id 
                                ? getT(language)('generating') 
                                : activeAudio?.msgId === msg.id 
                                  ? getT(language)('haltAudio') 
                                  : getT(language)('playAudio')}
                            </span>
                          </button>
                        </div>
                      )}
                      
                      <div className="max-w-none text-sm md:text-base leading-relaxed">
                        {msg.content.split('\n').filter(l => l.trim().length > 0).map((line, i) => {
                          const isActive = activeAudioProgress?.msgId === msg.id && activeAudioProgress?.paragraphIndex === i;
                          const baseClass = "mb-3 transition-colors duration-300 font-sans " + (isActive ? "text-[var(--text-primary)] segment-speaking-highlight rounded-sm px-3 py-1.5 shadow-[0_0_10px_rgba(0,229,255,0.1)] -mx-3" : "px-0 text-[var(--text-secondary)]");
                          
                          let displayLine = line;
                          let agentPrefix = null;

                          // Very basic prefix extraction - we can refine this based on the specific agent names chosen
                          if (line.includes(': ')) {
                            const parts = line.split(': ');
                            if (parts[0].length < 20) {
                              agentPrefix = <strong className="text-[var(--accent-cyan)] font-mono uppercase tracking-wider text-[10px] border border-[var(--accent-cyan)]/30 bg-[var(--accent-cyan)]/10 px-1.5 py-0.5 rounded-sm mr-2">{parts[0]}</strong>;
                              displayLine = parts.slice(1).join(': ');
                            }
                          }
                          
                          return <p id={`msg-${msg.id}-p-${i}`} key={i} className={baseClass}>{agentPrefix}{displayLine}</p>
                        })}
                      </div>

                      {msg.role === 'experts' && !msg.summary && (
                        <>
                          {msg.sourceReferences && msg.sourceReferences.length > 0 ? (
                            <div className="mt-6 pt-6 border-t border-[var(--border)]">
                              <h4 className="text-[10px] font-mono text-[var(--text-muted)] mb-3 flex items-center gap-2 uppercase tracking-widest">
                                <BookOpen className="w-3 h-3" />
                                {getT(language)('evidenceSources')}
                              </h4>
                              <div className="space-y-2">
                                {msg.sourceReferences.map((ref, i) => (
                                  <div key={i} className="p-3 rounded bg-[var(--bg-secondary)] border border-[var(--border)] flex flex-col gap-2 hover:border-[var(--accent-violet)]/30 transition-colors">
                                    <div className="flex items-center justify-between">
                                      <div className="text-xs text-[var(--text-primary)] font-mono"><span className="text-[var(--text-muted)] mr-2">[{String(i+1).padStart(2, '0')}]</span> {ref.title}</div>
                                      {ref.url && (
                                        <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-cyan)] hover:text-white text-[10px] font-mono flex items-center gap-1 shrink-0 uppercase tracking-widest">
                                          {getT(language)('view')} <Globe className="w-2.5 h-2.5" />
                                        </a>
                                      )}
                                    </div>
                                    {ref.claim && <p className="text-[11px] text-[var(--text-secondary)] pl-6 border-l border-[var(--border)] py-0.5">{ref.claim}</p>}
                                    {ref.paragraphIndex !== undefined && (
                                      <button
                                        onClick={() => {
                                          const el = document.getElementById(`msg-${msg.id}-p-${ref.paragraphIndex}`);
                                          if (el) {
                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            el.classList.add('segment-targeted-highlight');
                                            setTimeout(() => {
                                              el.classList.remove('segment-targeted-highlight');
                                            }, 2500);
                                          }
                                        }}
                                        className="text-[10px] font-mono text-[var(--accent-violet)] hover:text-white flex items-center gap-1 transition-colors self-start ml-6 uppercase tracking-widest mt-1"
                                      >
                                        <ChevronRight className="w-2.5 h-2.5" />
                                        {getT(language)('targetSegment')} {ref.paragraphIndex + 1}
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            msg.citations && msg.citations.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                                <h4 className="text-[10px] font-mono text-[var(--text-muted)] mb-2 flex items-center gap-2 uppercase tracking-widest">
                                  <BookOpen className="w-3 h-3" />
                                  Verwendete Quellen
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                  {msg.citations.map((citation, i) => (
                                    <span key={i} className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[10px] font-mono text-[var(--text-secondary)] uppercase">
                                      {citation}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )
                          )}
                        </>
                      )}
                    </div>

                    {msg.role === 'experts' && msg.suggestedTopics && msg.suggestedTopics.length > 0 && (
                      <div className="mt-4 w-full pl-4 md:pl-8 border-l border-[var(--border)]">
                        <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-3">{getT(language)('suggestedTopics')}</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.suggestedTopics.map((topic, i) => (
                            <button
                              key={i}
                              onClick={() => sendPrompt(topic)}
                              className="text-left px-3 py-1.5 rounded bg-[var(--bg-panel)] border border-[var(--border)] hover:border-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/5 text-[11px] font-mono text-[var(--text-secondary)] transition-colors"
                            >
                              {topic}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
                
                {isTyping && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-start"
                  >
                    <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded p-6 rounded-tl-none w-full max-w-[85%]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)] animate-bounce" />
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)] animate-bounce" style={{ animationDelay: '0.2s' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)] animate-bounce" style={{ animationDelay: '0.4s' }} />
                          </div>
                          <span className="text-[10px] font-mono text-[var(--text-muted)] tracking-widest uppercase">{getT(language)('systemGenerating')}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)] to-transparent pointer-events-none">
                <div className="max-w-4xl mx-auto relative pointer-events-auto">
                  <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded shadow-[0_0_24px_rgba(0,0,0,0.8)] p-1.5 flex items-center gap-2 focus-within:border-[var(--accent-cyan)] transition-colors">
                    <input
                      type="text"
                      value={userPrompt}
                      onChange={(e) => setUserPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendPrompt(userPrompt);
                        }
                      }}
                      placeholder={getT(language)('askExperts')}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-4 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none font-mono"
                    />
                    <button
                      onClick={() => sendPrompt(userPrompt)}
                      disabled={!userPrompt.trim() || isTyping}
                      className="w-10 h-10 rounded bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] flex items-center justify-center disabled:opacity-30 disabled:bg-[var(--bg-secondary)] hover:bg-[var(--accent-cyan)]/30 hover:text-white transition-all border border-[var(--accent-cyan)]/50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Knowledge Base Side Panel */}
      <AnimatePresence>
        {isKbOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsKbOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 flex"
            >
              <KnowledgeBasePanel onClose={() => setIsKbOpen(false)} language={language} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Agents Side Panel */}
      <AnimatePresence>
        {isAgentsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAgentsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 flex"
            >
              <AgentsPanel 
                onClose={() => setIsAgentsOpen(false)} 
                onSelectAgent={(agentName) => {
                  setExpertPair(agentName);
                }}
                language={language}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Live AI Panel */}
      <AnimatePresence>
        {isLiveAIOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLiveAIOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 flex"
            >
              <LiveAIPanel 
                onClose={() => {
                  setIsLiveAIOpen(false);
                  setShowExternalInviteTab(false);
                }}
                session={activeSession!}
                updateSession={(update) => {
                  setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, ...update } : s));
                  if (update.liveChat) setLiveChat(update.liveChat);
                }}
                language={language}
                useGoogleSearch={useGoogleSearch}
                defaultShowExternalInvite={showExternalInviteTab}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isProviderDashboardOpen && (
          <ProviderDashboard onClose={() => setIsProviderDashboardOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <LoadingProvider>
      <AppContent />
    </LoadingProvider>
  );
}
