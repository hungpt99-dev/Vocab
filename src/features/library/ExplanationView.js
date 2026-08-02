import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function List({ label, items }) {
    if (items.length === 0)
        return null;
    return (_jsxs("div", { className: "mt-1.5", children: [_jsx("p", { className: "text-[10px] uppercase tracking-wide text-slate-400", children: label }), _jsx("ul", { className: "list-inside list-disc text-xs text-slate-600 dark:text-slate-300", children: items.map((item) => (_jsx("li", { children: item }, item))) })] }));
}
/** Render a cached AI explanation. */
export function ExplanationView({ explanation }) {
    return (_jsxs("div", { className: "mt-2 rounded-md bg-slate-50 p-2 dark:bg-slate-800", children: [_jsx("p", { className: "text-xs font-medium text-slate-800 dark:text-slate-100", children: explanation.meaning }), explanation.simpleExplanation !== explanation.meaning && (_jsx("p", { className: "mt-1 text-xs text-slate-600 dark:text-slate-300", children: explanation.simpleExplanation })), explanation.pronunciation && (_jsx("p", { className: "mt-1 font-mono text-xs text-slate-500 dark:text-slate-400", children: explanation.pronunciation })), _jsx(List, { label: "Examples", items: explanation.examples }), _jsx(List, { label: "Synonyms", items: explanation.synonyms }), _jsx(List, { label: "Collocations", items: explanation.collocations }), _jsxs("p", { className: "mt-1.5 text-[10px] text-slate-400", children: [explanation.provider, explanation.model ? ` · ${explanation.model}` : ''] })] }));
}
