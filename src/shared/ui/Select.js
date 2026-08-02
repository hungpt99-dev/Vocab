import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from 'react';
export function Select({ label, options, hint, className = '', ...rest }) {
    const id = useId();
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { htmlFor: id, className: "text-xs font-medium text-slate-600 dark:text-slate-300", children: label }), _jsx("select", { id: id, "aria-describedby": hint ? `${id}-hint` : undefined, className: `h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${className}`, ...rest, children: options.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) }), hint && (_jsx("p", { id: `${id}-hint`, className: "text-xs text-slate-500 dark:text-slate-400", children: hint }))] }));
}
