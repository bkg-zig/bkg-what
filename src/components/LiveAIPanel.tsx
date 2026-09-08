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
  useGoogleSearch
}: { 
  onClose: () => void,
  session: Session,
  updateSession: (update: Partial<Session>) => void,
  language: Language,
  useGoogleSearch: boolean
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

    const assistantMsgId = (Date.now() + 1).toString();
    const placeholderMsg: LiveChatMessage = {
      id: assistantMsgId,
      sessionId: session.id,
      senderType: 'assistant',
      content: '',
      createdAt: new Date().toISOString()
    };
    updateSession({ liveChat: [...newChat, placeholderMsg] });

    try {
      updateSession({ liveAIState: { ...liveAIState, thinking: 'verifying' } });
      const historyText = newChat.map(m => `${m.senderType.toUpperCase()}: ${m.content}`).join('\n');
      const sessionContext = `Analyzed Text: ${session.inputText.substring(0, 1000)}\n\nLast Discussion Output: ${session.messages[session.messages.length - 1]?.content || 'None'}`;
      
      updateSession({ liveAIState: { ...liveAIState, thinking: 'answering' } });
      const response = await fetch('/api/live-chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: historyText,
          userMessage: userMessage.content,
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

  const [inviteMode, setInviteMode] = useState<'passive'|'attentive'|'active'>('attentive');
  const [inviteTts, setInviteTts] = useState(true);

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
            <h2 className="text-[10px] font-mono tracking-widest text-[var(--text-primary)] uppercase">LIVE AI ASSISTANT</h2>
            <span className="text-[8px] font-mono tracking-widest text-[var(--accent-cyan)] uppercase">● EINGELADEN • ONLINE</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleLeave}
            className="text-[10px] font-mono tracking-widest text-[var(--text-muted)] hover:text-[var(--status-danger)] transition-colors uppercase"
          >
            [ KI VERLASSEN LASSEN ]
          </button>
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
                "flex flex-col max-w-[85%]",
                msg.senderType === 'user' ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className={classNames(
                "text-[9px] font-mono tracking-widest uppercase mb-1 flex items-center gap-2",
                msg.senderType === 'user' ? "text-[var(--accent-cyan)]" : "text-[var(--accent-violet)]"
              )}>
                {msg.senderType === 'user' ? 'USER' : 'BKG AI'}
                {msg.senderType === 'assistant' && !isStreaming && (
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
                  : "bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)] rounded-tl-none"
              )}>
                {msg.content}
                {isStreaming && msg.id === liveChat[liveChat.length - 1].id && msg.senderType === 'assistant' && (
                  <span className="inline-block w-1.5 h-3 ml-1 bg-[var(--accent-violet)] animate-pulse align-middle" />
                )}
              </div>
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
