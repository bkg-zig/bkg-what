import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { classNames } from '../utils';

interface LoadingContextType {
  startLoading: (id: string, text: string) => void;
  stopLoading: (id: string) => void;
  isLoading: boolean;
  loadingText: string;
  progress: number;
}

const LoadingContext = createContext<LoadingContextType | null>(null);

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) throw new Error("useLoading must be used within LoadingProvider");
  return context;
};

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTasks, setActiveTasks] = useState<Map<string, string>>(new Map());
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startLoading = useCallback((id: string, text: string) => {
    setActiveTasks(prev => {
      const next = new Map(prev);
      next.set(id, text);
      return next;
    });
    setProgress(0);
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setProgress(p => {
          if (p < 85) return p + (Math.random() * 15);
          return p;
        });
      }, 600);
    }
  }, []);

  const stopLoading = useCallback((id: string) => {
    setActiveTasks(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // When all tasks are done, clear interval and set progress to 100 briefly, then reset
  React.useEffect(() => {
    if (activeTasks.size === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setProgress(100);
      const timeout = setTimeout(() => {
        setProgress(0);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [activeTasks.size]);

  const isLoading = activeTasks.size > 0;
  // Use the most recently added task text
  const loadingText = Array.from(activeTasks.values()).pop() || '';

  return (
    <LoadingContext.Provider value={{ startLoading, stopLoading, isLoading, loadingText, progress }}>
      {children}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: '24px', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="fixed top-14 left-0 right-0 z-40 bg-[var(--bg-panel-high)] border-b border-[var(--border)] overflow-hidden flex flex-col justify-center"
          >
             <div className="flex items-center justify-between px-6">
                <span className="font-mono text-[10px] text-[var(--accent-cyan)] uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[var(--accent-cyan)] rounded-full animate-pulse shadow-[0_0_8px_var(--accent-cyan)]" />
                  {loadingText}
                </span>
                <span className="font-mono text-[10px] text-[var(--accent-cyan)]">{Math.round(progress)}%</span>
             </div>
             <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--bg-primary)]">
               <motion.div 
                 className="h-full bg-[var(--accent-cyan)] shadow-[0_0_10px_var(--accent-cyan)]"
                 initial={{ width: 0 }}
                 animate={{ width: `${progress}%` }}
                 transition={{ ease: "easeOut", duration: 0.5 }}
               />
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </LoadingContext.Provider>
  );
};
