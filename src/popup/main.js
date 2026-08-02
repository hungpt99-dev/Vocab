import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@/shared/styles/tailwind.css';
const container = document.getElementById('root');
if (container) {
    createRoot(container).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
}
