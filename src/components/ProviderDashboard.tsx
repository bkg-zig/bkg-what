import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Server, Key, Save, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { AIProviderConfig, AIProviderConfigInput } from '../types/ai';
import { classNames } from '../utils';

export function ProviderDashboard({ 
  onClose 
}: { 
  onClose: () => void 
}) {
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<Partial<AIProviderConfigInput> | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/providers');
      const data = await res.json();
      setProviders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingProvider || !editingProvider.name) return;
    
    try {
      setTestResult(null);
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProvider)
      });
      if (res.ok) {
        await fetchProviders();
        setEditingProvider(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[var(--bg-panel)] border border-[var(--border)] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="h-14 flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--bg-panel-high)] shrink-0">
          <h2 className="text-xs font-mono tracking-widest text-[var(--text-primary)] flex items-center gap-2 uppercase">
            <Server className="w-4 h-4 text-[var(--accent-cyan)]" />
            AI INFRASTRUCTURE
          </h2>
          <button onClick={onClose} className="p-1 hover:text-[var(--accent-cyan)] text-[var(--text-muted)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-[var(--border)] bg-[var(--bg-panel-high)] flex flex-col">
            <div className="p-4 flex flex-col gap-2">
              <h3 className="text-[10px] font-mono tracking-widest text-[var(--text-muted)] uppercase mb-2">PRIMARY</h3>
              {providers.filter(p => p.isPrimary).map(p => (
                <div key={p.id} className="flex items-center gap-2 text-xs font-mono px-3 py-2 bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)]/30 text-[var(--accent-cyan)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)] animate-pulse" />
                  {p.name}
                </div>
              ))}

              <h3 className="text-[10px] font-mono tracking-widest text-[var(--text-muted)] uppercase mt-6 mb-2">FALLBACK CHAIN</h3>
              {providers.filter(p => !p.isPrimary).map((p, i) => (
                <button 
                  key={p.id}
                  onClick={() => setEditingProvider(p as AIProviderConfigInput)}
                  className="flex items-center gap-2 text-xs font-mono px-3 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-panel)] transition-colors text-left"
                >
                  <span className="text-[var(--text-muted)]">{String(i+1).padStart(2, '0')}</span>
                  <span className={p.enabled ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] line-through"}>{p.name}</span>
                </button>
              ))}
            </div>
            <div className="mt-auto p-4 border-t border-[var(--border)]">
              <button
                onClick={() => setEditingProvider({
                  name: 'New Provider',
                  type: 'openai_compatible',
                  defaultModel: 'gpt-4o',
                  enabled: true,
                  priority: 10,
                  capabilities: { chat: true, streaming: true, analysis: true, structuredOutput: true, agentGeneration: true, discussion: true, liveChat: true, grounding: false, search: false, vision: false, embeddings: false, tts: false, functionCalling: false, toolCalling: false }
                })}
                className="w-full text-[10px] font-mono tracking-widest text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30 hover:bg-[var(--accent-cyan)]/10 px-4 py-2 uppercase transition-colors"
              >
                [ + PROVIDER ]
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto bg-[var(--bg-base)]">
            {!editingProvider ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                <Server className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-mono text-xs uppercase tracking-widest">Select or Add a Provider</p>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                  <h3 className="text-sm font-mono tracking-widest text-[var(--text-primary)] uppercase">
                    {editingProvider.id ? 'EDIT PROVIDER' : 'NEW PROVIDER'}
                  </h3>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-mono uppercase cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editingProvider.enabled} 
                        onChange={e => setEditingProvider({...editingProvider, enabled: e.target.checked})}
                        className="accent-[var(--accent-cyan)]"
                      />
                      <span className={editingProvider.enabled ? 'text-[var(--accent-cyan)]' : 'text-[var(--text-muted)]'}>Enabled</span>
                    </label>
                  </div>
                </div>

                <div className="grid gap-6">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--text-secondary)] mb-2">Provider Name</label>
                    <input 
                      type="text" 
                      value={editingProvider.name} 
                      onChange={e => setEditingProvider({...editingProvider, name: e.target.value})}
                      className="w-full bg-[var(--bg-panel)] border border-[var(--border)] px-4 py-2 text-sm font-mono focus:border-[var(--accent-cyan)] outline-none"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-[var(--text-secondary)] mb-2">Type</label>
                      <select 
                        value={editingProvider.type} 
                        onChange={e => setEditingProvider({...editingProvider, type: e.target.value as any})}
                        className="w-full bg-[var(--bg-panel)] border border-[var(--border)] px-4 py-2 text-sm font-mono focus:border-[var(--accent-cyan)] outline-none"
                      >
                        <option value="gemini">Gemini API</option>
                        <option value="openai_compatible">OpenAI-Compatible REST</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-[var(--text-secondary)] mb-2">Priority</label>
                      <input 
                        type="number" 
                        value={editingProvider.priority} 
                        onChange={e => setEditingProvider({...editingProvider, priority: parseInt(e.target.value)})}
                        className="w-full bg-[var(--bg-panel)] border border-[var(--border)] px-4 py-2 text-sm font-mono focus:border-[var(--accent-cyan)] outline-none"
                      />
                    </div>
                  </div>

                  {editingProvider.type === 'openai_compatible' && (
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-[var(--text-secondary)] mb-2">Base URL</label>
                      <input 
                        type="text" 
                        value={editingProvider.baseUrl || ''} 
                        onChange={e => setEditingProvider({...editingProvider, baseUrl: e.target.value})}
                        placeholder="http://localhost:11434/v1"
                        className="w-full bg-[var(--bg-panel)] border border-[var(--border)] px-4 py-2 text-sm font-mono focus:border-[var(--accent-cyan)] outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--text-secondary)] mb-2">API Key (Saved Securely)</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)]" />
                      <input 
                        type="password" 
                        value={editingProvider.apiKey || ''} 
                        onChange={e => setEditingProvider({...editingProvider, apiKey: e.target.value})}
                        placeholder={editingProvider.id ? "••••••••••••••••" : "Enter API Key"}
                        className="w-full bg-[var(--bg-panel)] border border-[var(--border)] pl-10 pr-4 py-2 text-sm font-mono focus:border-[var(--accent-cyan)] outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--text-secondary)] mb-2">Default Model</label>
                    <input 
                      type="text" 
                      value={editingProvider.defaultModel} 
                      onChange={e => setEditingProvider({...editingProvider, defaultModel: e.target.value})}
                      className="w-full bg-[var(--bg-panel)] border border-[var(--border)] px-4 py-2 text-sm font-mono focus:border-[var(--accent-cyan)] outline-none"
                    />
                  </div>

                  <div className="pt-6 border-t border-[var(--border)] flex justify-between items-center">
                    <button 
                      onClick={() => setTestResult("Test mocked in frontend for prototype...")}
                      className="text-[10px] font-mono tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--text-muted)] px-4 py-2 uppercase transition-colors flex items-center gap-2"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Test Connection
                    </button>
                    
                    <button 
                      onClick={handleSave}
                      className="text-[10px] font-mono tracking-widest text-[var(--bg-base)] bg-[var(--accent-cyan)] hover:bg-cyan-300 px-6 py-2 uppercase transition-colors flex items-center gap-2"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Speichern
                    </button>
                  </div>
                  {testResult && (
                    <div className="mt-2 text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-panel-high)] p-2 border border-[var(--border)]">
                      {testResult}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
