import type { ReactNode } from 'react';
import { Spinner } from './Spinner';

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  id?: string;
}

/**
 * Accessible on/off switch. Renders a track + thumb; while `loading` is true it
 * shows a small spinner and ignores clicks (e.g. while the extension activates
 * a heavier feature like inline bilingual reading).
 */
export function Switch({ checked, onChange, loading = false, disabled = false, label, id }: SwitchProps): ReactNode {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      onClick={() => {
        if (!isDisabled) onChange(!checked);
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'
      } ${isDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-flex h-4 w-4 transform items-center justify-center rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      >
        {loading && <Spinner label="" />}
      </span>
    </button>
  );
}
