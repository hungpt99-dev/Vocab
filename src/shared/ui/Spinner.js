import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Spinner({ label = 'Loading' }) {
    return (_jsxs("span", { role: "status", "aria-live": "polite", className: "inline-flex items-center gap-2 text-xs text-slate-500", children: [_jsx("span", { "aria-hidden": "true", className: "h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" }), label] }));
}
