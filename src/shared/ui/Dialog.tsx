import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { zIndex } from '@/shared/styles/tokens';

export interface DialogAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export interface DialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  actions: readonly DialogAction[];
  onClose: () => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Reusable modal dialog. Portaled to document.body so it is never trapped inside
 * a virtualized row or clipped by an overflow container. Handles Escape-to-close,
 * backdrop click, focus capture, and focus restore.
 */
export function Dialog({ open, title, children, actions, onClose }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastActive = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    lastActive.current = document.activeElement;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (lastActive.current instanceof HTMLElement) lastActive.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-900/50 p-4"
      style={{ zIndex: zIndex.modal }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-xs rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-800"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant={action.variant ?? 'secondary'}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
