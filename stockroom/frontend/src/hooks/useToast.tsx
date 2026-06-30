import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

type Action =
  | { type: 'ADD'; toast: Toast }
  | { type: 'REMOVE'; id: string };

function reducer(state: Toast[], action: Action): Toast[] {
  if (action.type === 'ADD') return [...state, action.toast];
  if (action.type === 'REMOVE') return state.filter(t => t.id !== action.id);
  return state;
}

const ToastCtx = createContext<{
  toasts: Toast[];
  toast: (type: ToastType, title: string, message?: string) => void;
  dismiss: (id: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);

  const toast = useCallback((type: ToastType, title: string, message?: string, duration = 4000) => {
    const id = Math.random().toString(36).slice(2);
    dispatch({ type: 'ADD', toast: { id, type, title, message, duration } });
    setTimeout(() => dispatch({ type: 'REMOVE', id }), duration);
  }, []);

  const dismiss = useCallback((id: string) => dispatch({ type: 'REMOVE', id }), []);

  return <ToastCtx.Provider value={{ toasts, toast, dismiss }}>{children}</ToastCtx.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
