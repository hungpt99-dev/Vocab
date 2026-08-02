import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function EmptyState({ title, description }) {
    return (_jsxs("div", { className: "flex flex-col items-center gap-1 px-4 py-8 text-center", children: [_jsx("p", { className: "text-sm font-medium text-slate-700 dark:text-slate-200", children: title }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: description })] }));
}
