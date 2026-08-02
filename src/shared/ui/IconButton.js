import { jsx as _jsx } from "react/jsx-runtime";
export function IconButton({ label, active = false, className = '', children, ...rest }) {
    return (_jsx("button", { type: "button", "aria-label": label, title: label, "aria-pressed": rest.role === 'switch' ? undefined : active, className: `inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${active ? 'text-amber-500 dark:text-amber-400' : ''} ${className}`, ...rest, children: children }));
}
