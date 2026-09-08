import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, BrainCircuit, Scale, CheckSquare, Square } from 'lucide-react';
import { classNames } from '../utils';
import { Language } from '../types';
import { getT } from '../i18n';

export interface CustomAgent {
  id: string;
  name: string;
  instruction: string;
  specialties?: string;
  strengths?: string;
  weaknesses?: string;
  personality?: string;
  analysisFocus?: string;
}

export function AgentsPanel({ 
  onClose, 
  onSelectAgent,
  language
}: { 
  onClose: () => void,
  onSelectAgent: (name: string) => void,
  language: Language
}) {
  const t = getT(language);
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  // New Agent State
  const [newName, setNewName] = useState('');
  const [newInstruction, setNewInstruction] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [personality, setPersonality] = useState('');
  const [analysisFocus, setAnalysisFocus] = useState('');

  // Compare State
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('expertAI_customAgents');
      if (saved) setAgents(JSON.parse(saved));
    } catch (e) {}
  }, []);

  const saveAgents = (newAgents: CustomAgent[]) => {
    setAgents(newAgents);
    localStorage.setItem('expertAI_customAgents', JSON.stringify(newAgents));
  };

  const handleAdd = () => {
    if (!newName.trim() || !newInstruction.trim()) return;
    const newAgent: CustomAgent = {
      id: Date.now().toString(),
      name: newName.trim(),
      instruction: newInstruction.trim(),
      specialties: specialties.trim(),
      strengths: strengths.trim(),
      weaknesses: weaknesses.trim(),
      personality: personality.trim(),
      analysisFocus: analysisFocus.trim(),
    };
    saveAgents([...agents, newAgent]);
    
    // Reset form
    setNewName('');
    setNewInstruction('');
    setSpecialties('');
    setStrengths('');
    setWeaknesses('');
    setPersonality('');
    setAnalysisFocus('');
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    saveAgents(agents.filter(a => a.id !== id));
    setSelectedForCompare(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleCompareSelect = (id: string) => {
    setSelectedForCompare(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const comparedAgents = agents.filter(a => selectedForCompare.has(a.id));

  return (
    <div className={classNames(
      "bg-[var(--bg-panel)] h-full border-l border-[var(--border)] flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.8)] transition-all duration-300",
      showComparison ? "w-full md:w-[800px]" : "w-full md:w-[450px]"
    )}>
      <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--border)] bg-[var(--bg-panel-high)] shrink-0">
        <h2 className="text-[10px] font-mono tracking-widest text-[var(--text-primary)] flex items-center gap-2 uppercase">
          {showComparison ? <Scale className="w-3.5 h-3.5 text-[var(--accent-cyan)]" /> : <BrainCircuit className="w-3.5 h-3.5 text-[var(--accent-cyan)]" />}
          {showComparison ? "AGENT MATRIX" : "EXPERT DIRECTORY"}
        </h2>
        <button onClick={onClose} className="text-[10px] font-mono tracking-widest text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors uppercase">
          {t('close')} [X]
        </button>
      </div>

      {!showComparison && (
        <div className="p-4 border-b border-[var(--border)] shrink-0 flex flex-col gap-3">
          {!isAdding && !isCompareMode && (
            <>
              <button
                onClick={() => setIsAdding(true)}
                className="w-full py-2 px-4 bg-[var(--accent-cyan)]/10 hover:bg-[var(--accent-cyan)]/20 border border-[var(--accent-cyan)]/30 text-[var(--accent-cyan)] rounded-sm text-[10px] font-mono tracking-widest uppercase transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                INITIALIZE EXPERT
              </button>
              {agents.length > 1 && (
                <button
                  onClick={() => setIsCompareMode(true)}
                  className="w-full py-2 px-4 bg-[var(--bg-secondary)] hover:bg-[var(--bg-panel-high)] border border-[var(--border)] text-[var(--text-primary)] rounded-sm text-[10px] font-mono tracking-widest uppercase transition-colors flex items-center justify-center gap-2"
                >
                  <Scale className="w-3.5 h-3.5" />
                  SELECT PAIR / COMPARE
                </button>
              )}
            </>
          )}

          {isCompareMode && !showComparison && (
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">Select exactly 2 agents to form a pair, or compare multiple:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowComparison(true)}
                  disabled={selectedForCompare.size < 2}
                  className="flex-1 py-2 bg-[var(--accent-cyan)]/20 hover:bg-[var(--accent-cyan)]/30 border border-[var(--accent-cyan)]/50 disabled:border-[var(--border)] disabled:bg-transparent disabled:text-[var(--text-muted)] text-[var(--accent-cyan)] rounded-sm text-[10px] font-mono tracking-widest uppercase transition-colors"
                >
                  EXECUTE COMPARISON ({selectedForCompare.size})
                </button>
                <button
                  onClick={() => {
                    const selectedArr = Array.from(selectedForCompare);
                    const agentNames = agents.filter(a => selectedArr.includes(a.id)).map(a => a.name);
                    onSelectAgent(agentNames.join(' & '));
                    onClose();
                  }}
                  disabled={selectedForCompare.size !== 2}
                  className="flex-1 py-2 bg-[var(--accent-violet)]/20 hover:bg-[var(--accent-violet)]/30 border border-[var(--accent-violet)]/50 disabled:border-[var(--border)] disabled:bg-transparent disabled:text-[var(--text-muted)] text-[var(--accent-violet)] rounded-sm text-[10px] font-mono tracking-widest uppercase transition-colors"
                >
                  USE AS PAIR
                </button>
                <button
                  onClick={() => {
                    setIsCompareMode(false);
                    setSelectedForCompare(new Set());
                  }}
                  className="px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-panel-high)] border border-[var(--border)] text-[var(--text-secondary)] rounded-sm text-[10px] font-mono tracking-widest uppercase transition-colors"
                >
                  ABORT
                </button>
              </div>
            </div>
          )}

          {isAdding && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-1 uppercase tracking-widest">Designation (Name)</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-sm px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-cyan)] outline-none transition-colors"
                  placeholder="e.g. Nexus-7"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-1 uppercase tracking-widest">Core Instruction *</label>
                <textarea
                  value={newInstruction}
                  onChange={e => setNewInstruction(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-sm px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-cyan)] outline-none transition-colors min-h-[100px] resize-y custom-scrollbar"
                  placeholder="Define primary directives..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-1 uppercase tracking-widest">Specialties</label>
                  <input type="text" value={specialties} onChange={e => setSpecialties(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-sm px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-cyan)] outline-none transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-1 uppercase tracking-widest">Analysis Focus</label>
                  <input type="text" value={analysisFocus} onChange={e => setAnalysisFocus(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-sm px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-cyan)] outline-none transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-1 uppercase tracking-widest">Strengths</label>
                  <input type="text" value={strengths} onChange={e => setStrengths(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-sm px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-cyan)] outline-none transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-1 uppercase tracking-widest">Weaknesses</label>
                  <input type="text" value={weaknesses} onChange={e => setWeaknesses(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-sm px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-cyan)] outline-none transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-1 uppercase tracking-widest">Personality Profile</label>
                <input type="text" value={personality} onChange={e => setPersonality(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-sm px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-cyan)] outline-none transition-colors" />
              </div>
              
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAdd}
                  disabled={!newName.trim() || !newInstruction.trim()}
                  className="flex-1 py-2 bg-[var(--accent-cyan)]/20 hover:bg-[var(--accent-cyan)]/30 border border-[var(--accent-cyan)]/50 disabled:border-[var(--border)] disabled:bg-transparent disabled:text-[var(--text-muted)] text-[var(--accent-cyan)] rounded-sm text-[10px] font-mono tracking-widest uppercase transition-colors"
                >
                  SAVE RECORD
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-panel-high)] border border-[var(--border)] text-[var(--text-secondary)] rounded-sm text-[10px] font-mono tracking-widest uppercase transition-colors"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showComparison ? (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-[10px] font-mono tracking-widest text-[var(--text-primary)] uppercase">Selected Agents</h3>
            <button 
              onClick={() => setShowComparison(false)}
              className="text-[10px] font-mono tracking-widest text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors uppercase"
            >
              RETURN
            </button>
          </div>
          <div className="overflow-x-auto pb-4">
            <table className="w-full text-left border-collapse min-w-[600px] font-mono">
              <thead>
                <tr>
                  <th className="p-3 border-b border-[var(--border)] text-[var(--text-muted)] tracking-widest text-[10px] w-32 uppercase">Property</th>
                  {comparedAgents.map(a => (
                    <th key={a.id} className="p-3 border-b border-[var(--accent-cyan)]/30 text-[var(--text-primary)] text-[11px] tracking-wider uppercase">{a.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                <tr className="hover:bg-[var(--bg-secondary)]">
                  <td className="p-3 border-b border-[var(--border)] text-[var(--text-muted)] align-top uppercase tracking-widest">Specialties</td>
                  {comparedAgents.map(a => <td key={a.id} className="p-3 border-b border-[var(--border)] align-top">{a.specialties || '-'}</td>)}
                </tr>
                <tr className="hover:bg-[var(--bg-secondary)]">
                  <td className="p-3 border-b border-[var(--border)] text-[var(--text-muted)] align-top uppercase tracking-widest">Strengths</td>
                  {comparedAgents.map(a => <td key={a.id} className="p-3 border-b border-[var(--border)] align-top">{a.strengths || '-'}</td>)}
                </tr>
                <tr className="hover:bg-[var(--bg-secondary)]">
                  <td className="p-3 border-b border-[var(--border)] text-[var(--text-muted)] align-top uppercase tracking-widest">Weaknesses</td>
                  {comparedAgents.map(a => <td key={a.id} className="p-3 border-b border-[var(--border)] align-top">{a.weaknesses || '-'}</td>)}
                </tr>
                <tr className="hover:bg-[var(--bg-secondary)]">
                  <td className="p-3 border-b border-[var(--border)] text-[var(--text-muted)] align-top uppercase tracking-widest">Personality</td>
                  {comparedAgents.map(a => <td key={a.id} className="p-3 border-b border-[var(--border)] align-top">{a.personality || '-'}</td>)}
                </tr>
                <tr className="hover:bg-[var(--bg-secondary)]">
                  <td className="p-3 border-b border-[var(--border)] text-[var(--text-muted)] align-top uppercase tracking-widest">Focus</td>
                  {comparedAgents.map(a => <td key={a.id} className="p-3 border-b border-[var(--border)] align-top">{a.analysisFocus || '-'}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {agents.length === 0 ? (
            <div className="text-center text-[var(--text-muted)] text-[10px] font-mono tracking-widest py-8 uppercase border border-dashed border-[var(--border)] rounded-sm m-2">
              NO EXPERT AGENTS INITIALIZED.<br/>INITIALIZE NEW RECORDS FOR ANALYSIS.
            </div>
          ) : (
            agents.map((agent) => (
              <div 
                key={agent.id} 
                onClick={() => isCompareMode ? toggleCompareSelect(agent.id) : null}
                className={classNames(
                  "border rounded-sm p-4 flex flex-col gap-3 group transition-colors",
                  isCompareMode ? "cursor-pointer" : "",
                  isCompareMode && selectedForCompare.has(agent.id) ? "bg-[var(--accent-cyan)]/10 border-[var(--accent-cyan)]/50" : "bg-[var(--bg-secondary)] border-[var(--border)] hover:border-[var(--accent-cyan)]/30"
                )}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {isCompareMode && (
                      <div className="text-[var(--accent-cyan)]">
                        {selectedForCompare.has(agent.id) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      </div>
                    )}
                    <h3 className="text-[11px] font-mono font-medium text-[var(--text-primary)] uppercase tracking-wide">{agent.name}</h3>
                  </div>
                  {!isCompareMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(agent.id); }}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--status-error)] hover:bg-[var(--status-error)]/10 rounded-sm transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {!isCompareMode && (
                  <>
                    <p className="text-[10px] text-[var(--text-secondary)] line-clamp-3">{agent.instruction}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAgent(agent.name);
                        onClose();
                      }}
                      className="w-full py-1.5 mt-2 bg-[var(--bg-panel-high)] hover:bg-[var(--accent-cyan)] hover:text-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--accent-cyan)] rounded-sm text-[10px] font-mono tracking-widest uppercase transition-colors"
                    >
                      ASSIGN SOLO
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
