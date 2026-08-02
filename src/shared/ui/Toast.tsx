import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckIcon, AlertIcon, XIcon } from './Icons';
import { zIndex, statusSurface } from '@/shared/styles/tokens';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  notify: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, string> = statusSurface;

/**
 * Reusable toast notifications. One provider per app (popup / options) renders
 * a region in the corner; consumers call `useToast().notify(...)`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, message, variant }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-3 right-3 flex w-72 flex-col gap-2"
        style={{ zIndex: zIndex.modal }}
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2 text-xs shadow-sm ${VARIANT_STYLES[toast.variant]}`}
          >
            <span className="mt-0.5 shrink-0" aria-hidden="true">
              {toast.variant === 'success' ? <CheckIcon size={14} /> : <AlertIcon size={14} />}
            </span>
            <span className="min-w-0 flex-1">{toast.message}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <XIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
