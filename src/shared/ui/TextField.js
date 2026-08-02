import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from 'react';
export function TextField({ label, hint, error, className = '', ...rest }) {
    const id = useId();
    const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
        .filter(Boolean)
        .join(' ');
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { htmlFor: id, className: "text-xs font-medium text-slate-600 dark:text-slate-300", children: label }), _jsx("input", { id: id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy || undefined, className: `h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${error ? 'border-red-500' : ''} ${className}`, ...rest }), hint && !error && (_jsx("p", { id: `${id}-hint`, className: "text-xs text-slate-500 dark:text-slate-400", children: hint })), error && (_jsx("p", { id: `${id}-error`, role: "alert", className: "text-xs text-red-600 dark:text-red-400", children: error }))] }));
}
