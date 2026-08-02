import { useId, type InputHTMLAttributes } from 'react';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  label: string;
  description?: string;
}

/**
 * Accessible toggle used in settings. The visible box uses a design-system
 * checked state; keyboard and screen-reader users get a real checkbox input.
 */
export function Checkbox({ label, description, className = '', ...rest }: CheckboxProps) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex items-start gap-2.5 text-sm ${className}`}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 dark:border-slate-600 dark:bg-slate-800"
        {...rest}
      />
      <span className="min-w-0">
        <span className="text-slate-800 dark:text-slate-100">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
