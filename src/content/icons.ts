/* Lucide icon paths (24x24, stroke-based) inlined as SVG so content-script
 * overlays need no runtime icon dependency inside the third-party page. */

const wrap = (paths: string): string =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ` +
  `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

/** Build an inline SVG from lucide path data. */
export const icon = (paths: string): string => wrap(paths);

export const ICON_SPARKLES = wrap(
  '<path d="M9.94 14.34A2 2 0 0 0 8.66 13.06L3 11l5.66-2.06A2 2 0 0 0 9.94 9.66L12 4l2.06 5.66a2 2 0 0 0 1.28 1.28L21 11l-5.66 2.06a2 2 0 0 0-1.28 1.28L12 20l-2.06-5.66z"/>',
);
export const ICON_LANGUAGES = wrap(
  '<path d="m5 8 3-3 3 3"/><path d="M12 19h4l3-3 3 3"/><path d="M5.5 8.5h5"/><path d="M14.5 15.5h5"/>' +
    '<path d="M3 11c2 1 4 1.5 6 1.5s4-.5 6-1.5"/>',
);
export const ICON_BOOKMARK = wrap(
  '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
);
export const ICON_COPY = wrap(
  '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
);
export const ICON_MORE = wrap(
  '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
);
export const ICON_CLOSE = wrap('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');
export const ICON_SETTINGS = wrap(
  '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>' +
    '<circle cx="12" cy="12" r="3"/>',
);
