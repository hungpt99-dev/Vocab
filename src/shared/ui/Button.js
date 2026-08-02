import { jsx as _jsx } from "react/jsx-runtime";
const VARIANTS = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
};
const SIZES = {
    sm: 'h-7 px-2 text-xs',
    md: 'h-9 px-3 text-sm',
};
export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', children, ...rest }) {
    return (_jsx("button", { type: type, className: `inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`, ...rest, children: children }));
}
