import React from 'react';
import { BookOpen, ExternalLink, Database } from 'lucide-react';
import { knowledgeBase } from '../data/knowledge';
import { Language } from '../types';
import { getT } from '../i18n';

export function KnowledgeBasePanel({ onClose, language }: { onClose: () => void, language: Language }) {
  const t = getT(language);
  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-[var(--bg-panel)] border-l border-[var(--border)] shadow-[-10px_0_30px_rgba(0,0,0,0.8)] z-50 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--bg-panel-high)]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 flex items-center justify-center">
            <Database className="w-4 h-4 text-[var(--accent-cyan)]" />
          </div>
          <h2 className="text-[10px] font-mono tracking-widest text-[var(--text-primary)] uppercase">{t('databaseContext')}</h2>
        </div>
        <button 
          onClick={onClose}
          className="text-[10px] font-mono tracking-widest text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors uppercase"
        >
          {t('close')} [X]
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <p className="text-[10px] font-mono text-[var(--text-secondary)] mb-4 uppercase">
          &gt; {t('initializingKB')}<br/>
          &gt; {t('loadedRef')}
        </p>

        {knowledgeBase.map((entry) => (
          <div key={entry.id} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded p-4 hover:border-[var(--accent-cyan)]/30 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] uppercase tracking-widest text-[var(--accent-cyan)] font-mono border border-[var(--accent-cyan)]/30 px-2 py-0.5 rounded-sm bg-[var(--accent-cyan)]/5">
                {entry.category}
              </span>
              {entry.url && (
                <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-[var(--text-muted)] hover:text-[var(--accent-cyan)]">
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <h3 className="text-xs font-mono font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2 uppercase tracking-wide">
              <BookOpen className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              {entry.title}
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-3">
              {entry.content}
            </p>
            <div className="text-[9px] font-mono text-[var(--text-muted)] border-t border-[var(--border)] pt-2 uppercase tracking-widest">
              SRC: <span className="text-[var(--text-primary)]">{entry.source}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
