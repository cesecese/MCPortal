'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../components/Icon';
import '../styles/toast.css';

interface Toast {
  id: number;
  message: string;
  detail?: string;
  icon: IconName;
  leaving?: boolean;
}

type Notify = (message: string, opts?: { detail?: string; icon?: IconName }) => void;

const ToastContext = createContext<Notify>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const notify = useCallback<Notify>((message, opts) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, message, detail: opts?.detail, icon: opts?.icon ?? 'check' }]);
    window.setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), 3200);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.leaving ? ' is-leaving' : ''}`}>
            <Icon name={t.icon} size={16} />
            <div>
              <div className="toast__msg">{t.message}</div>
              {t.detail && <div className="toast__detail">{t.detail}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Notify {
  return useContext(ToastContext);
}
