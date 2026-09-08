import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Loader2, Play, Square, MessageSquare } from 'lucide-react';
import { classNames } from '../utils';
import { Language, LiveChatMessage, Session } from '../types';
import { getT } from '../i18n';
import { motion, AnimatePresence } from 'framer-motion';

export function LiveAIPanel({ 
  onClose, 
  session,
  updateSession,
  language,
  useGoogleSearch,
  defaultShowExternalInvite = false
}: { 
  onClose: () => void,
  session: Session,
  updateSession: (update: Partial<Session>) => void,
  language: Language,
  useGoogleSearch: boolean,
  defaultShowExternalInvite?: boolean
}) {
  const t = getT(language);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const liveChat = session.liveChat || [];
  const liveAIState = session.liveAIState || {
    invited: false,
    online: false,
    mode: 'attentive',
    thinking: 'idle',
    ttsEnabled: true,
    groundingEnabled: useGoogleSearch,
  };

  const [inviteMode, setInviteMode] = useState<'passive'|'attentive'|'active'>('attentive');
  const [inviteTts, setInviteTts] = useState(true);
  const [showExternalInvite, setShowExternalInvite] = useState(defaultShowExternalInvite);

  const handleInvite = (mode: 'passive' | 'attentive' | 'active', tts: boolean, grounding: boolean) => {
    updateSession({
      liveAIState: {
        ...liveAIState,
        invited: true,
        online: true,
        mode,
        ttsEnabled: tts,
        groundingEnabled: grounding,
      }
    });
  };

  const handleLeave = () => {
    updateSession({
      liveAIState: {
        ...liveAIState,
        invited: false,
        online: false,
      }
    });
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [liveChat]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);

  const handlePlayAudio = async (msg: LiveChatMessage) => {
    if (playingMsgId === msg.id && audioRef.current) {
      audioRef.current.pause();
      setPlayingMsgId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    try {
      setPlayingMsgId(msg.id);
      updateSession({
        liveChat: liveChat.map(m => m.id === msg.id ? { ...m, ttsStatus: 'generating' } : m)
      });
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: msg.content, persona: session.voicePersona })
      });
      
      const { audioContent } = await response.json();
      
      const audioBlob = new Blob(
        [Uint8Array.from(atob(audioContent), c => c.charCodeAt(0))],
        { type: 'audio/mp3' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPlayingMsgId(null);
        updateSession({
          liveChat: liveChat.map(m => m.id === msg.id ? { ...m, ttsStatus: 'idle' } : m)
        });
      };
      
      await audio.play();
      updateSession({
        liveChat: liveChat.map(m => m.id === msg.id ? { ...m, ttsStatus: 'playing' } : m)
      });
    } catch (e) {
      console.error(e);
      setPlayingMsgId(null);
      updateSession({
        liveChat: liveChat.map(m => m.id === msg.id ? { ...m, ttsStatus: 'error' } : m)
      });
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const userMessage: LiveChatMessage = {
      id: Date.now().toString(),
      sessionId: session.id,
      senderType: 'user',
      content: input.trim(),
      createdAt: new Date().toISOString()
    };
    
    const newChat = [...liveChat, userMessage];
    updateSession({ liveChat: newChat });
    setInput('');
    setIsStreaming(true);
    updateSession({ 
      liveAIState: { 
        ...liveAIState, 
        thinking: 'reading' 
      } 
    });

    let targetSenderType: 'assistant' | 'external' = 'assistant';
    let targetSenderName = 'BKG AI';
    
    // Check for explicit mentions
    const externalParticipants = liveAIState.externalParticipants || [];
    for (const p of externalParticipants) {
      if (userMessage.content.toLowerCase().includes(`@${p.name.toLowerCase()}`)) {
        targetSenderType = 'external';
        targetSenderName = p.name;
        break;
      }
    }

    const assistantMsgId = (Date.now() + 1).toString();
    const placeholderMsg: LiveChatMessage = {
      id: assistantMsgId,
      sessionId: session.id,
      senderType: targetSenderType,
      senderName: targetSenderName,
      content: '',
      createdAt: new Date().toISOString()
    };
    updateSession({ liveChat: [...newChat, placeholderMsg] });

    try {
      updateSession({ liveAIState: { ...liveAIState, thinking: 'verifying' } });
      const historyText = newChat.map(m => `${m.senderType.toUpperCase()}: ${m.content}`).join('\n');
      
      let sessionContext = `--- CONTEXT SNAPSHOT ---\n`;
      sessionContext += `Input Text (first 2000 chars): ${session.inputText.substring(0, 2000)}\n\n`;
      if (session.messages && session.messages.length > 0) {
        sessionContext += `--- DISCUSSION SEGMENTS & CLAIMS ---\n`;
        session.messages.forEach((m, i) => {
           sessionContext += `Segment ${i + 1} [${m.role.toUpperCase()}]:\n${m.content}\n`;
           if (m.summary) sessionContext += `Summary: ${m.summary}\n`;
           if (m.inconsistencies && m.inconsistencies.length > 0) {
             sessionContext += `Inconsistencies detected:\n${m.inconsistencies.map(inc => `  - ${inc}`).join('\n')}\n`;
           }
           if (m.sourceReferences && m.sourceReferences.length > 0) {
              sessionContext += `Sources / Claims:\n`;
              m.sourceReferences.forEach(s => {
                sessionContext += `  - ${s.title}: ${s.claim || s.description || ''}\n`;
              });
           }
           sessionContext += `\n`;
        });
      }

      updateSession({ liveAIState: { ...liveAIState, thinking: 'answering' } });
      const response = await fetch('/api/live-chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: historyText,
          userMessage: targetSenderType === 'external' ? `[PROMPT AS: ${targetSenderName}] ` + userMessage.content : userMessage.content,
          sessionContext,
          language,
          useGoogleSearch
        })
      });

      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullResponse = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunkStr = decoder.decode(value, { stream: !done });
          const lines = chunkStr.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr === '[DONE]') {
                done = true;
                break;
              }
              try {
                const data = JSON.parse(dataStr);
                if (data.text) {
                  fullResponse += data.text;
                  updateSession({
                    liveChat: [...newChat, { ...placeholderMsg, content: fullResponse }]
                  });
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      updateSession({
        liveChat: [...newChat, { ...placeholderMsg, content: "ERROR: Connection failed." }]
      });
    } finally {
      setIsStreaming(false);
      updateSession({ liveAIState: { ...liveAIState, thinking: 'idle' } });
      
      if (liveAIState.ttsEnabled && fullResponse) {
        // Auto-play
        const completedMsg = { ...placeholderMsg, content: fullResponse };
        handlePlayAudio(completedMsg);
      }
    }
  };

  const [availableProviders, setAvailableProviders] = useState<any[]>([]);

  useEffect(() => {
    if (showExternalInvite && availableProviders.length === 0) {
      fetch('/api/providers')
        .then(res => res.json())
        .then(data => setAvailableProviders(data.filter((p: any) => p.enabled && !p.isPrimary)))
        .catch(console.error);
    }
  }, [showExternalInvite]);

  const handleAddExternal = async (providerName: string) => {
    setShowExternalInvite(false);
    const newParticipant: ExternalAIParticipant = {
      id: Date.now().toString(),
      provider: providerName as any,
      name: providerName,
      status: 'connecting',
      joinedAt: new Date().toISOString()
    };
    
    updateSession({
      liveAIState: {
        ...liveAIState,
        externalParticipants: [...(liveAIState.externalParticipants || []), newParticipant]
      }
    });

    // Simulate connection delay
    setTimeout(() => {
      updateSession({
        liveAIState: {
          ...liveAIState,
          externalParticipants: [...(liveAIState.externalParticipants || [])].map(p => 
            p.id === newParticipant.id ? { ...p, status: 'context_sync' } : p
          )
        },
        liveChat: [
          ...(session.liveChat || []),
          {
            id: Date.now().toString(),
            sessionId: session.id,
            senderType: 'system',
            content: `Synchronisiere Context Snapshot (Claims, Sources, Segments) mit ${providerName}...`,
            createdAt: new Date().toISOString()
          }
        ]
      });
      
      setTimeout(() => {
        updateSession({
          liveAIState: {
            ...liveAIState,
            externalParticipants: [...(liveAIState.externalParticipants || [])].map(p => 
              p.id === newParticipant.id ? { ...p, status: 'connected' } : p
            )
          },
          liveChat: [
            ...(session.liveChat || []),
            {
              id: (Date.now() - 10).toString(),
              sessionId: session.id,
              senderType: 'system',
              content: `${providerName} wurde zur Session hinzugefügt und hat den Snapshot erhalten.\nRolle: Unabhängiger Reviewer`,
              createdAt: new Date().toISOString()
            },
            {
              id: Date.now().toString(),
              sessionId: session.id,
              senderType: 'external',
              senderName: providerName,
              content: `Hallo, ich bin ${providerName}. Ich habe den Context Snapshot erhalten und bin bereit, an der Diskussion teilzunehmen.`,
              createdAt: new Date().toISOString()
            }
          ]
        });
      }, 2000);
    }, 1000);
  };

  const handleRemoveExternal = (id: string) => {
    const participant = liveAIState.externalParticipants?.find(p => p.id === id);
    if (!participant) return;

    updateSession({
      liveAIState: {
        ...liveAIState,
        externalParticipants: (liveAIState.externalParticipants || []).filter(p => p.id !== id)
      },
      liveChat: [
        ...(session.liveChat || []),
        {
          id: Date.now().toString(),
          sessionId: session.id,
          senderType: 'system',
          content: `${participant.name} hat den Live Research Room verlassen.`,
          createdAt: new Date().toISOString()
        }
      ]
    });
  };

  if (!liveAIState.invited) {
    return (
      <div className="fixed inset-y-0 right-0 w-full md:w-[500px] lg:w-[600px] bg-[var(--bg-panel)] border-l border-[var(--border)] shadow-[-10px_0_30px_rgba(0,0,0,0.8)] z-50 flex flex-col overflow-hidden">
        <div className="h-14 flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--bg-panel-high)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center">
              <Bot className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-[10px] font-mono tracking-widest text-[var(--text-primary)] uppercase">LIVE AI ASSISTANT</h2>
              <span className="text-[8px] font-mono tracking-widest text-[var(--text-muted)] uppercase">○ NICHT EINGELADEN</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-[10px] font-mono tracking-widest text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors uppercase"
          >
            {t('close')} [X]
          </button>
        </div>
        
        <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-panel-high)] border border-[var(--border)] flex items-center justify-center mb-6">
            <Bot className="w-8 h-8 text-[var(--text-primary)]" />
          </div>
          <h3 className="text-sm font-mono tracking-widest text-[var(--text-primary)] uppercase mb-2">LIVE AI EINLADEN</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm leading-relaxed mb-6">
            Die KI erhält Zugriff auf den aktuellen Analyse- und Diskussionskontext und kann aktiv an der Session teilnehmen.
          </p>

          <div className="w-full max-w-sm text-left bg-[var(--bg-panel-high)] border border-[var(--border)] rounded-sm p-4 mb-8 space-y-4">
            <div>
              <label className="text-[10px] font-mono tracking-widest text-[var(--text-secondary)] uppercase mb-2 block">Modus</label>
              <div className="flex flex-col gap-2">
                {(['passive', 'attentive', 'active'] as const).map(m => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer group">
                    <div className={classNames(
                      "w-3 h-3 rounded-full border flex items-center justify-center",
                      inviteMode === m ? "border-[var(--accent-cyan)]" : "border-[var(--border)] group-hover:border-[var(--text-muted)]"
                    )}>
                      {inviteMode === m && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)]" />}
                    </div>
                    <span className={classNames(
                      "text-xs font-mono uppercase tracking-widest",
                      inviteMode === m ? "text-[var(--accent-cyan)]" : "text-[var(--text-muted)]"
                    )}>{m}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--border)]">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={classNames(
                  "w-3 h-3 rounded-sm border flex items-center justify-center",
                  inviteTts ? "border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/20" : "border-[var(--border)] group-hover:border-[var(--text-muted)]"
                )}>
                  {inviteTts && <div className="w-1.5 h-1.5 bg-[var(--accent-cyan)] rounded-sm" />}
                </div>
                <span className={classNames(
                  "text-xs font-mono uppercase tracking-widest",
                  inviteTts ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
                )}>Antworten automatisch vorlesen</span>
              </label>
              <input type="checkbox" className="hidden" checked={inviteTts} onChange={(e) => setInviteTts(e.target.checked)} />
            </div>
            
            <div className="pt-2 border-t border-[var(--border)]">
              <label className="flex items-center gap-2 cursor-pointer group opacity-70">
                <div className={classNames(
                  "w-3 h-3 rounded-sm border flex items-center justify-center",
                  useGoogleSearch ? "border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/20" : "border-[var(--border)]"
                )}>
                  {useGoogleSearch && <div className="w-1.5 h-1.5 bg-[var(--accent-cyan)] rounded-sm" />}
                </div>
                <span className={classNames(
                  "text-xs font-mono uppercase tracking-widest",
                  useGoogleSearch ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
                )}>Google Search verwenden (Session Setting)</span>
              </label>
            </div>
          </div>
          
          <button
            onClick={() => handleInvite(inviteMode, inviteTts, useGoogleSearch)}
            className="bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30 hover:bg-[var(--accent-cyan)]/20 px-6 py-2 rounded-sm font-mono text-[10px] tracking-widest uppercase transition-colors"
          >
            [ KI EINLADEN ]
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[500px] lg:w-[600px] bg-[var(--bg-panel)] border-l border-[var(--border)] shadow-[-10px_0_30px_rgba(0,0,0,0.8)] z-50 flex flex-col overflow-hidden">
      <div className="h-14 flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--bg-panel-high)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 flex items-center justify-center relative">
            <Bot className="w-4 h-4 text-[var(--accent-violet)]" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[var(--status-success)] rounded-full animate-pulse shadow-[0_0_8px_var(--status-success)]" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-[10px] font-mono tracking-widest text-[var(--text-primary)] uppercase">LIVE RESEARCH ROOM</h2>
            <div className="flex items-center gap-2 text-[8px] font-mono tracking-widest uppercase mt-0.5">
              <span className="text-[var(--accent-cyan)]">● BKG AI</span>
              {liveAIState.externalParticipants?.map(p => (
                <span key={p.id} className="text-[var(--status-warning)] flex items-center gap-1 group relative">
                  <span className={classNames(
                    "w-1 h-1 rounded-full",
                    p.status === 'connected' ? 'bg-[var(--status-success)]' : 'bg-[var(--status-warning)] animate-pulse'
                  )} />
                  {p.name}
                  <button onClick={() => handleRemoveExternal(p.id)} className="hidden group-hover:inline ml-1 text-[var(--status-danger)] hover:text-red-400">
                    <X className="w-2 h-2" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 relative">
          <button 
            onClick={() => setShowExternalInvite(!showExternalInvite)}
            className="text-[10px] font-mono tracking-widest text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10 px-2 py-1 rounded transition-colors uppercase border border-[var(--accent-cyan)]/30"
          >
            + EXTERNE KI
          </button>
          {showExternalInvite && (
            <div className="absolute top-full right-16 mt-2 w-48 bg-[var(--bg-panel-high)] border border-[var(--border)] shadow-xl rounded-sm py-1 z-50">
              {availableProviders.length === 0 ? (
                <div className="px-4 py-2 text-xs font-mono tracking-widest uppercase text-[var(--text-muted)] text-center">Loading...</div>
              ) : (
                availableProviders.map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => handleAddExternal(provider.name)}
                    className="w-full text-left px-4 py-2 text-[10px] font-mono tracking-widest uppercase text-[var(--text-secondary)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)]"
                  >
                    {provider.name}
                  </button>
                ))
              )}
            </div>
          )}
          <button 
            onClick={onClose}
            className="text-[10px] font-mono tracking-widest text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors uppercase"
          >
            {t('close')} [X]
          </button>
        </div>
      </div>

      {/* System Status Indicators */}
      <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-panel)] flex items-center gap-4 text-[8px] font-mono tracking-widest uppercase">
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--text-muted)]">CONTEXT</span>
          <span className="text-[var(--status-success)]">READY</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--text-muted)]">GROUNDING</span>
          <span className={useGoogleSearch ? "text-[var(--accent-cyan)]" : "text-[var(--text-muted)]"}>{useGoogleSearch ? "ACTIVE" : "INACTIVE"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--text-muted)]">SESSION</span>
          <span className="text-[var(--accent-violet)]">LINKED</span>
        </div>
      </div>

      {liveAIState.thinking !== 'idle' && (
        <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-panel-high)] flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase text-[var(--accent-cyan)]">
          <span className="w-1.5 h-1.5 bg-[var(--accent-cyan)] rounded-full animate-pulse shadow-[0_0_8px_var(--accent-cyan)]" />
          {liveAIState.thinking === 'reading' && 'KI LIEST NEUEN BEITRAG...'}
          {liveAIState.thinking === 'verifying' && 'KI PRÜFT KONTEXT...'}
          {liveAIState.thinking === 'answering' && 'KI ERSTELLT ANTWORT...'}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {liveChat.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-[var(--border)] rounded-sm">
            <MessageSquare className="w-8 h-8 text-[var(--text-muted)] mb-3" />
            <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest mb-1">LIVE INTERACTION READY</p>
            <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest leading-relaxed max-w-xs">Ask questions about the current analysis, sources, or request deeper insights.</p>
          </div>
        ) : (
          liveChat.map((msg) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id} 
              className={classNames(
                "flex flex-col w-full",
                msg.senderType === 'user' ? "items-end" : msg.senderType === 'system' ? "items-center" : "items-start"
              )}
            >
              {msg.senderType === 'system' ? (
                <div className="text-[10px] font-mono tracking-widest text-[var(--text-muted)] uppercase my-2 whitespace-pre-line text-center opacity-70">
                  {msg.content}
                </div>
              ) : (
                <div className={classNames("flex flex-col max-w-[85%]", msg.senderType === 'user' ? "items-end" : "items-start")}>
                  <div className={classNames(
                    "text-[9px] font-mono tracking-widest uppercase mb-1 flex items-center gap-2",
                    msg.senderType === 'user' ? "text-[var(--accent-cyan)]" : 
                    msg.senderType === 'external' ? "text-[var(--status-warning)]" : "text-[var(--accent-violet)]"
                  )}>
                    {msg.senderType === 'user' ? 'USER' : msg.senderType === 'external' ? `${msg.senderName} [EXTERN]` : 'BKG AI [INTERN]'}
                    {(msg.senderType === 'assistant' || msg.senderType === 'external') && (!isStreaming || msg.id !== liveChat[liveChat.length - 1].id) && (
                      <button
                        onClick={() => handlePlayAudio(msg)}
                        className="hover:text-[var(--accent-cyan)] transition-colors ml-2 flex items-center gap-1"
                        title={playingMsgId === msg.id ? "Pause Audio" : "Play Audio"}
                      >
                        {playingMsgId === msg.id ? (
                          <Square className="w-3 h-3 fill-current" />
                        ) : msg.ttsStatus === 'generating' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className={classNames(
                    "p-3 rounded-sm text-sm border font-sans",
                    msg.senderType === 'user' 
                      ? "bg-[var(--accent-cyan)]/5 border-[var(--accent-cyan)]/20 text-[var(--text-primary)] rounded-tr-none" 
                      : msg.senderType === 'external'
                      ? "bg-[var(--bg-panel-high)] border-[var(--status-warning)]/30 text-[var(--text-primary)] rounded-tl-none"
                      : "bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)] rounded-tl-none"
                  )}>
                    {msg.content}
                    {isStreaming && msg.id === liveChat[liveChat.length - 1].id && msg.senderType !== 'user' && (
                      <span className={classNames("inline-block w-1.5 h-3 ml-1 animate-pulse align-middle", msg.senderType === 'external' ? "bg-[var(--status-warning)]" : "bg-[var(--accent-violet)]")} />
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-panel-high)]">
        <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-sm p-1.5 flex items-center gap-2 focus-within:border-[var(--accent-violet)] transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isStreaming}
            placeholder="Nachricht an BKG AI..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none font-mono disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="w-8 h-8 shrink-0 rounded-sm bg-[var(--accent-violet)]/20 text-[var(--accent-violet)] flex items-center justify-center disabled:opacity-30 disabled:bg-[var(--bg-secondary)] hover:bg-[var(--accent-violet)]/30 hover:text-white transition-all border border-[var(--accent-violet)]/50"
          >
            {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
