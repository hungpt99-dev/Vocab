/**
 * Detect in-tab (SPA) navigations that do NOT trigger a full page reload.
 *
 * Client-side routers (React Router, Next.js app router, Vue Router, …) swap
 * the page content via history.pushState/replaceState + popstate rather than a
 * real navigation, so the content script's `main()` never re-runs and nothing
 * re-triggers features like Bilingual translation.
 *
 * History-method monkey-patching is unreliable: some routers capture a reference
 * to the native `pushState` (or call `History.prototype.pushState`) and bypass a
 * patched instance method entirely, so the navigation goes undetected. We
 * therefore use the signals that CAN'T be bypassed:
 *   - `popstate` / `hashchange` events (real DOM events every router fires), and
 *   - a MutationObserver that notices the URL actually changed (SPA routers
 *     always change `location.href`, even though there is no full reload).
 * Infinite scroll / chat appends keep the same URL, so they are ignored.
 */
export function installSpaNavHandler(onNavigate: () => void): void {
  // Reliable DOM events fired by every client-side router.
  window.addEventListener('popstate', onNavigate);
  window.addEventListener('hashchange', onNavigate);

  // URL-change watcher: catches pushState/replaceState-driven swaps that emit no
  // popstate/hashchange. We observe document mutations (debounced) and, when the
  // URL differs from the last seen one, treat it as an SPA navigation.
  let lastHref = location.href;
  let timer: number | undefined;
  const observer = new MutationObserver(() => {
    if (location.href === lastHref) return; // same URL → not a route change
    if (timer !== undefined) clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (location.href === lastHref) return;
      lastHref = location.href;
      onNavigate();
    }, 100);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Best-effort extra coverage for routers that keep the URL identical but still
  // replace the view: patch history methods so a pushState without a URL change
  // also notifies us. This is a bonus and safe to no-op when bypassed.
  const wrap =
    (orig: typeof history.pushState | typeof history.replaceState) =>
    function (this: History, ...args: Parameters<typeof history.pushState>): void {
      document.documentElement.setAttribute(
        'data-spa-intercept',
        String(+(document.documentElement.getAttribute('data-spa-intercept') || '0') + 1),
      );
      orig.apply(this, args);
      lastHref = location.href;
      onNavigate();
    };
  try {
    history.pushState = wrap(history.pushState) as typeof history.pushState;
    history.replaceState = wrap(history.replaceState) as typeof history.replaceState;
  } catch {
    // Patching failed (locked down environment): the observer + events above
    // still cover the common cases.
  }
}
