/**
 * Detect in-tab (SPA) navigations that do NOT trigger a full page reload.
 *
 * Client-side routers (React Router, Next.js app router, Vue Router, …) swap
 * the page content via history.pushState/replaceState + popstate rather than a
 * real navigation, so the content script's `main()` never re-runs and nothing
 * re-triggers features like Bilingual translation. We wrap the history methods
 * and also listen for popstate/hashchange so any such navigation fires
 * `onNavigate`, letting the caller re-translate / re-scan the new page.
 */
export function installSpaNavHandler(onNavigate: () => void): void {
  const wrap =
    (orig: typeof history.pushState | typeof history.replaceState) =>
    function (this: History, ...args: Parameters<typeof history.pushState>): void {
      orig.apply(this, args);
      onNavigate();
    };

  history.pushState = wrap(history.pushState) as typeof history.pushState;
  history.replaceState = wrap(history.replaceState) as typeof history.replaceState;
  window.addEventListener('popstate', onNavigate);
  window.addEventListener('hashchange', onNavigate);
}
