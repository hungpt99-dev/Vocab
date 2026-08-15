import { sendMessage } from '@/shared/messaging/client';
import { settingsRepository } from '@/storage/settings-repository';
import { splitIntoSentences } from '@/shared/lib/text';
import {
  getReadingPreferences,
  setReadingPreferences,
  watchReadingPreferences,
  type ReadingAlignment,
  type ReadingMode,
} from './preferences';
import { extractArticle, type ArticleBlock } from './extract';
import { buildSentenceBlock, wrapWords } from './gloss';
import { WordGlossPopover } from './word-gloss-popover';
import type { WordAlignResult, BilingualPerf } from '@/ai/types';
import { aiErrorMessage } from '@/ai/types';
import { bilingualLog, contentTimer } from '@/shared/lib/bilingual-log';
import { ICON_BOOK_OPEN, ICON_CLOSE, ICON_LANGUAGES, ICON_GLOSS_WORD, ICON_REFRESH } from '../icons';
import { isReadingActiveOnHost } from '@/shared/types/settings';
import { translationCache, cacheKey, type CachedTranslation } from './translation-cache';

/**
 * Inline bilingual reading: keeps the original page UI intact and injects the
 * translation of each sentence (or paragraph) directly beneath the source text
 * on the live page — like a bilingual book laid over the real article. No
 * separate dialog or overlay replaces the site.
 */
export class InlineReader {
  private readonly injected = new Map<string, HTMLElement[]>();
  private control: HTMLElement | null = null;
  private modeButton: HTMLButtonElement | null = null;
  private prefsListener: (() => void) | null = null;
  private banner: HTMLElement | null = null;
  private readonly popover = new WordGlossPopover();
  private readonly hostOriginal = new Map<HTMLElement, string>();
  private alignment: ReadingAlignment = 'sentence';
  private mode: ReadingMode = 'word';
  private active = false;
  /** IntersectionObserver that triggers translation as blocks enter the viewport. */
  private observer: IntersectionObserver | null = null;
  /** Block ids already translated, so we never re-translate on re-observe. */
  private readonly translatedBlockIds = new Set<string>();
  /** Skeleton placeholders currently shown, keyed by block id, for removal. */
  private readonly skeletons = new Map<string, HTMLElement>();
  /** Monotonic token; bumped on every (re)inject or close so a stale in-flight
   *  batch can tell it has been superseded and must not append nodes. */
  private generation = 0;
  /** Last AI failure surfaced to the user, so we don't spam duplicate toasts. */
  private lastError: string | null = null;

  get isOpen(): boolean {
    return this.active;
  }

  async toggle(): Promise<boolean> {
    if (this.active) {
      this.close();
      return false;
    }
    return this.open();
  }

  /** Force a re-translation of the page, bypassing the session cache. */
  async refresh(): Promise<void> {
    if (!this.active) {
      // Nothing is open to refresh; opening it fresh will translate from scratch.
      void this.open();
      return;
    }
    const blocks = extractArticle();
    if (blocks.length === 0) return;
    this.generation += 1;
    this.restoreHost();
    for (const nodes of this.injected.values()) {
      for (const node of nodes) node.remove();
    }
    this.injected.clear();
    this.translatedBlockIds.clear();
    this.clearSkeletons();
    this.observer?.disconnect();
    this.observer = null;
    await this.observeBlocks(blocks, true);
  }

  /** Reveal a previously hidden reader (tab re-focused) without re-translating. */
  show(): void {
    if (!this.active) return;
    this.restoreVisibility();
    // Resume lazy translation for any blocks not yet translated; blocks already
    // in translatedBlockIds are skipped, so nothing already shown is redone.
    if (!this.observer) {
      const blocks = extractArticle();
      if (blocks.length > 0) void this.observeBlocks(blocks);
    }
  }

  /** Hide the reader while keeping its translated DOM (tab backgrounded). */
  hide(): void {
    if (!this.active) return;
    this.applyVisibility(false);
    // Stop lazy-loading hidden blocks so we don't burn AI calls on a tab the
    // user isn't looking at; observeBlocks() is re-run on show().
    this.observer?.disconnect();
    this.observer = null;
  }

  private applyVisibility(visible: boolean): void {
    const display = visible ? '' : 'none';
    if (this.control) this.control.style.display = display;
    for (const nodes of this.injected.values()) {
      for (const node of nodes) node.style.display = display;
    }
    if (this.banner) this.banner.style.display = display;
  }

  private restoreVisibility(): void {
    // Clearing inline display lets each node's own `hidden` attribute (set by
    // the show/hide-translations toggle) and the CSS take over again.
    this.applyVisibility(true);
  }

  async open(): Promise<boolean> {
    if (this.active) return true;
    const blocks = extractArticle();
    if (blocks.length === 0) {
      // No translatable article text on this page. Previously this returned
      // silently, so enabling bilingual looked like "nothing happens". Surface
      // it so the cause is diagnosable.
      console.warn('[bilingual] enabled but no translatable blocks found on this page');
      return false;
    }

    const [prefs, settings] = await Promise.all([getReadingPreferences(), settingsRepository.get()]);
    this.alignment = prefs.alignment;
    this.mode = prefs.mode;
    this.active = true;
    this.generation += 1;
    this.lastError = null;

    // Reading aids are active when the tri-state reading mode is on for this
    // host: 'everywhere' always, 'allowed' only on the shared allowedDomains.
    const effective = isReadingActiveOnHost(settings, location.hostname);

    this.buildControl(effective);
    this.prefsListener = watchReadingPreferences((next) => {
      this.alignment = next.alignment;
      if (next.mode !== this.mode) {
        this.mode = next.mode;
        void this.rerender(blocks);
      }
      this.refreshControl();
    });
    document.body.addEventListener('mouseover', this.onWordHover);
    document.body.addEventListener('mouseout', this.onWordLeave);

    if (effective) {
      // Lazily translate: eagerly translate what is (or is about to be) visible so
      // the first screenful appears instantly, then top up the rest on scroll.
      // We never "load all" the page up front.
      await this.observeBlocks(blocks);
    }
    return true;
  }

  private readonly onWordHover = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (this.popover.contains(target)) return;
    const word = target.closest<HTMLElement>('.avs-gloss-word');
    if (word) this.popover.show(word);
    else this.popover.scheduleHide();
  };

  private readonly onWordLeave = (event: MouseEvent): void => {
    const related = event.relatedTarget;
    if (related instanceof Node && this.popover.contains(related)) return;
    this.popover.scheduleHide();
  };

  close(): void {
    this.active = false;
    this.generation += 1;
    this.observer?.disconnect();
    this.observer = null;
    this.translatedBlockIds.clear();
    this.clearSkeletons();
    document.body.removeEventListener('mouseover', this.onWordHover);
    document.body.removeEventListener('mouseout', this.onWordLeave);
    this.popover.destroy();
    for (const [element, html] of this.hostOriginal) element.innerHTML = html;
    this.hostOriginal.clear();
    for (const nodes of this.injected.values()) {
      for (const node of nodes) node.remove();
    }
    this.injected.clear();
    this.banner?.remove();
    this.banner = null;
    this.control?.remove();
    this.control = null;
    this.modeButton = null;
    this.prefsListener?.();
    this.prefsListener = null;
  }

  /** Re-inject translations after a mode change (clears the old ones first). */
  private async rerender(blocks: ArticleBlock[]): Promise<void> {
    this.generation += 1;
    this.restoreHost();
    for (const nodes of this.injected.values()) {
      for (const node of nodes) node.remove();
    }
    this.injected.clear();
    this.translatedBlockIds.clear();
    this.clearSkeletons();
    this.observer?.disconnect();
    this.observer = null;
    if (blocks.length > 0) this.observeBlocks(blocks);
  }

  /** Undo any word wrapping we applied to the host page. */
  private restoreHost(): void {
    for (const [element, html] of this.hostOriginal) element.innerHTML = html;
    this.hostOriginal.clear();
  }

  /**
   * Lazily translate the page. An IntersectionObserver watches every block; only
   * blocks that are in (or near) the viewport are sent for translation, and
   * more are translated as the reader scrolls. This keeps first paint instant
   * and avoids translating an entire long article up front.
   */
  private async observeBlocks(blocks: ArticleBlock[], force = false): Promise<void> {
    const generation = this.generation;
    const visible = blocks.filter((b) => {
      const el = b.element;
      if (!(el instanceof HTMLElement)) return false;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // Anything within one viewport below the fold is considered "near" and is
      // translated eagerly so it's ready just as the reader reaches it.
      return rect.top < vh * 2 && rect.bottom > -vh;
    });

    // Translate what's already (near) visible right away, so the first screenful
    // appears without waiting for a scroll.
    if (visible.length > 0) await this.translateBlocks(visible, force);

    // A close()/rerender() may have superseded this run while we awaited the
    // eager batch; if so, don't set up the observer (it would fire stale work).
    if (this.generation !== generation) return;

    // Top up the rest as it scrolls into view.
    this.observer = new IntersectionObserver(
      (entries) => {
        const entering = entries
          .filter((e) => e.isIntersecting)
          .map((e) => blocks.find((b) => b.element === e.target))
          .filter((b): b is ArticleBlock => Boolean(b));
        if (entering.length > 0) void this.translateBlocks(entering, force);
      },
      // Start translating a block a full viewport before it scrolls into view.
      { rootMargin: '200% 0px 200% 0px' },
    );
    for (const block of blocks) {
      if (block.element instanceof HTMLElement) this.observer.observe(block.element);
    }
  }

  /**
   * Translate a specific set of blocks (visible ones), skipping already-done
   * blocks AND already-translated text. Results are cached per session keyed by
   * the source text + language + mode, so reopening a page (or switching tabs and
   * back) reuses the previous translation instead of re-calling the AI and
   * re-flashing the skeleton. See translation-cache.ts.
   */
  private async translateBlocks(blocks: ArticleBlock[], force = false): Promise<void> {
    const generation = this.generation;
    const pending = blocks.filter((b) => !this.translatedBlockIds.has(b.id));
    if (pending.length === 0) return;

    const timer = contentTimer(`translateBlocks(${pending.length} blocks)`);
    const t0 = performance.now();

    const items: Array<{ id: string; text: string; anchor: HTMLElement }> = [];
    for (const block of pending) {
      const targets = this.resolveTargets(block);
      for (const target of targets) items.push(target);
    }
    if (items.length === 0) {
      // Nothing translatable here (e.g. navigation) — still mark done so we
      // don't keep re-checking it.
      for (const b of pending) this.translatedBlockIds.add(b.id);
      timer?.stop(`no items`);
      return;
    }

    // Resolve the language + mode once for the whole batch, and look up the
    // session cache before doing any work. Fetch settings first so the cache key
    // (which depends on the target language) doesn't create a self-referential
    // type inference.
    const settings = await settingsRepository.get();
    const language = settings.targetLanguage || 'English';
    // On a forced refresh we deliberately ignore the session cache so every
    // block is re-fetched from the translation service, even if it was already
    // translated this session.
    const cached = force
      ? new Map()
      : await translationCache.get(
          items.map((item) => cacheKey(item.text, language, this.mode)),
        );

    const toTranslate: typeof items = [];
    let injectedSomething = false;

    for (const item of items) {
      const key = cacheKey(item.text, language, this.mode);
      const hit = cached.get(key);
      if (!hit) {
        toTranslate.push(item);
        continue;
      }
      // Cache hit: render directly, no skeleton, no AI call.
      this.renderItem(item, hit.translation, hit.pairs, key);
      injectedSomething = true;
    }

    if (toTranslate.length > 0) {
      // Skeleton placeholders only for the blocks we actually have to fetch.
      const skeletonByAnchor = new Map<HTMLElement, HTMLElement>();
      for (const block of pending) {
        const anchor = block.element instanceof HTMLElement ? block.element : null;
        if (!anchor || this.skeletons.has(block.id)) continue;
        if (!toTranslate.some((it) => it.anchor === anchor)) continue;
        const skeleton = this.buildSkeletonLine();
        anchor.after(skeleton);
        this.skeletons.set(block.id, skeleton);
        skeletonByAnchor.set(anchor, skeleton);
      }

      const replaceSkeleton = (anchor: HTMLElement, node: HTMLElement | null): void => {
        const skeleton = skeletonByAnchor.get(anchor);
        if (!skeleton) return;
        if (node) skeleton.replaceWith(node);
        else skeleton.remove();
        for (const [id, sk] of this.skeletons) if (sk === skeleton) this.skeletons.delete(id);
      };

      const newCache = new Map<string, CachedTranslation>();
      if (this.mode === 'word') {
        const aligned = await this.alignItems(toTranslate);
        if (this.generation !== generation) {
          for (const sk of skeletonByAnchor.values()) sk.remove();
          return;
        }
        let lastText: string | null = null;
        for (const item of toTranslate) {
          const result = aligned.map.get(item.id);
          if (!result) continue;
          this.applyWordGloss(item, result);
          const line = result.translation || result.pairs.map((pair) => pair.target).join(' ');
          if (line && line !== lastText) {
            const node = buildSentenceBlock(line);
            replaceSkeleton(item.anchor, node);
            this.track(item.id, node);
            lastText = result.translation;
            injectedSomething = true;
          } else {
            replaceSkeleton(item.anchor, null);
          }
          newCache.set(cacheKey(item.text, language, 'word'), { translation: result.translation, pairs: result.pairs });
        }
        const swPerf = aligned.perf;
        bilingualLog.content(
          `word batch: ${toTranslate.length} items, ${(performance.now() - t0).toFixed(0)}ms wall`,
          swPerf ? { providerMs: swPerf.providerMs, rateLimitWaitMs: swPerf.rateLimitWaitMs, swTotalMs: swPerf.totalMs } : 'no perf',
        );
      } else {
        const translated = await this.translateItems(toTranslate);
        if (this.generation !== generation) {
          for (const sk of skeletonByAnchor.values()) sk.remove();
          return;
        }
        let lastText: string | null = null;
        for (const item of toTranslate) {
          const translation = translated.map.get(item.id);
          if (!translation) continue;
          if (translation === lastText) {
            replaceSkeleton(item.anchor, null);
            continue;
          }
          lastText = translation;
          const node = buildSentenceBlock(translation);
          replaceSkeleton(item.anchor, node);
          this.track(item.id, node);
          injectedSomething = true;
          newCache.set(cacheKey(item.text, language, 'sentence'), { translation, pairs: null });
        }
        const swPerf = translated.perf;
        bilingualLog.content(
          `sentence batch: ${toTranslate.length} items, ${(performance.now() - t0).toFixed(0)}ms wall`,
          swPerf ? { providerMs: swPerf.providerMs, rateLimitWaitMs: swPerf.rateLimitWaitMs, swTotalMs: swPerf.totalMs } : 'no perf',
        );
      }
      if (newCache.size > 0) await translationCache.set(newCache);
    }

    for (const b of pending) this.translatedBlockIds.add(b.id);

    if (!injectedSomething && this.lastError) {
      this.showBanner(this.lastError);
      this.lastError = null;
    } else if (injectedSomething) {
      this.hideBanner();
    }
  }

  /**
   * Render one translated item from a cached or fresh result. Shared by the cache
   * fast-path and (for the gloss) the live align path.
   */
  private renderItem(
    item: { id: string; text: string; anchor: HTMLElement },
    translation: string,
    pairs: Array<{ source: string; target: string }> | null,
    cacheKeyForTrack: string,
  ): void {
    if (pairs && pairs.length > 0 && this.mode === 'word') {
      this.applyWordGloss(item, { id: item.id, text: item.text, pairs, translation });
    }
    if (!translation) return;
    const node = buildSentenceBlock(translation);
    item.anchor.after(node);
    this.track(cacheKeyForTrack, node);
  }

  /** Build a shimmering placeholder line shown while a block is translating. */
  private buildSkeletonLine(): HTMLElement {
    const skeleton = document.createElement('div');
    skeleton.className = 'avs-skeleton-line';
    skeleton.setAttribute('aria-hidden', 'true');
    return skeleton;
  }

  /** Remove every skeleton placeholder from the page and forget it (teardown). */
  private clearSkeletons(): void {
    for (const skeleton of this.skeletons.values()) skeleton.remove();
    this.skeletons.clear();
  }

  /** Render a persistent, dismissable banner explaining why nothing translated. */
  private showBanner(message: string): void {
    this.hideBanner();
    const banner = document.createElement('div');
    banner.className = 'avs-bilingual-banner';
    banner.setAttribute('role', 'alert');

    const icon = document.createElement('span');
    icon.className = 'avs-bilingual-banner-icon';
    icon.innerHTML = ICON_LANGUAGES;

    const text = document.createElement('span');
    text.className = 'avs-bilingual-banner-text';
    text.textContent = message;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'avs-bilingual-banner-close';
    close.innerHTML = ICON_CLOSE;
    close.setAttribute('aria-label', 'Dismiss');
    close.addEventListener('click', () => this.hideBanner());

    banner.append(icon, text, close);
    document.body.append(banner);
    this.banner = banner;
  }

  private hideBanner(): void {
    this.banner?.remove();
    this.banner = null;
  }

  /** Wrap matched source words in hoverable gloss spans (saved for undo). */
  private applyWordGloss(item: { id: string; text: string; anchor: HTMLElement }, result: WordAlignResult): void {
    const source = item.anchor;
    if (!this.hostOriginal.has(source)) {
      this.hostOriginal.set(source, source.innerHTML);
    }
    wrapWords(source, result);
  }

  private track(id: string, node: HTMLElement): void {
    const list = this.injected.get(id) ?? [];
    list.push(node);
    this.injected.set(id, list);
  }

  private async alignItems(
    items: Array<{ id: string; text: string }>,
  ): Promise<{ map: Map<string, WordAlignResult>; perf?: BilingualPerf }> {
    const out = new Map<string, WordAlignResult>();
    let perf: BilingualPerf | undefined;
    try {
      const settings = await settingsRepository.get();
      const language = settings.targetLanguage || 'English';
      const results = await sendMessage({
        type: 'align-words',
        payload: { paragraphs: items.map(({ id, text }) => ({ id, text })), language },
      });
      for (const result of results) {
        if (result.perf && !perf) perf = result.perf;
        out.set(result.id, result);
      }
    } catch (cause) {
      // Record the failure so the caller can surface an actionable message
      // instead of leaving the page silently monolingual.
      this.lastError = aiErrorMessage(cause);
    }
    return { map: out, perf };
  }

  private async translateItems(
    items: Array<{ id: string; text: string }>,
  ): Promise<{ map: Map<string, string>; perf?: BilingualPerf }> {
    const out = new Map<string, string>();
    let perf: BilingualPerf | undefined;
    try {
      const settings = await settingsRepository.get();
      const language = settings.targetLanguage || 'English';
      const result = await sendMessage({
        type: 'translate-article',
        payload: { paragraphs: items.map(({ id, text }) => ({ id, text })), language },
      });
      for (const item of result) {
        if (item.perf && !perf) perf = item.perf;
        out.set(item.id, item.translation);
      }
    } catch (cause) {
      this.lastError = aiErrorMessage(cause);
    }
    return { map: out, perf };
  }

  /** Map a block to (sentence or paragraph) source anchors on the live page. */
  private resolveTargets(block: ArticleBlock): Array<{ id: string; text: string; anchor: HTMLElement }> {
    const source = block.element instanceof HTMLElement ? block.element : null;
    if (!source) return [];

    if (this.alignment === 'sentence') {
      const sentences = splitIntoSentences(block.text);
      if (sentences.length <= 1) {
        return [{ id: block.id, text: block.text, anchor: source }];
      }
      const result: Array<{ id: string; text: string; anchor: HTMLElement }> = [];
      let index = 0;
      for (const sentence of sentences) {
        if (!sentence.trim()) continue;
        const anchor = this.findSentenceAnchor(source, sentence) ?? source;
        result.push({ id: `${block.id}#${index}`, text: sentence, anchor });
        index += 1;
      }
      return result;
    }
    return [{ id: block.id, text: block.text, anchor: source }];
  }

  private findSentenceAnchor(parent: HTMLElement, sentence: string): HTMLElement | null {
    const normalized = sentence.trim().slice(0, 24).replace(/"/g, '');
    if (!normalized) return null;
    // The shortest element that uniquely contains this sentence text — not the
    // block itself, which contains every sentence and would cause every
    // sentence line to stack at the same node.
    const candidates = document.evaluate(
      `.//*[contains(normalize-space(.), "${normalized}")]`,
      parent,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null,
    );
    let best: HTMLElement | null = null;
    for (let i = 0; i < candidates.snapshotLength; i += 1) {
      const el = candidates.snapshotItem(i);
      if (!(el instanceof HTMLElement)) continue;
      if (el === parent) continue;
      if (!best || el.textContent!.length < best.textContent!.length) best = el;
    }
    return best;
  }

  private buildControl(visible: boolean): void {
    const control = document.createElement('div');
    control.className = 'avs-inline-control';
    control.hidden = !visible;

    const label = document.createElement('span');
    label.className = 'avs-inline-control-label';
    label.innerHTML = `${ICON_LANGUAGES}<span>Bilingual</span>`;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'avs-inline-btn';
    toggle.innerHTML = ICON_BOOK_OPEN;
    toggle.title = 'Show/hide translations';
    toggle.setAttribute('aria-label', 'Show or hide translations');
    toggle.setAttribute('aria-pressed', 'true');
    toggle.addEventListener('click', () => {
      const next = !control.dataset.on || control.dataset.on === 'false';
      control.dataset.on = String(next);
      toggle.setAttribute('aria-pressed', String(next));
      for (const nodes of this.injected.values()) {
        for (const node of nodes) node.hidden = !next;
      }
    });
    control.dataset.on = 'true';

    const align = document.createElement('button');
    align.type = 'button';
    align.className = 'avs-inline-btn';
    align.innerHTML = this.mode === 'word' ? ICON_GLOSS_WORD : ICON_LANGUAGES;
    align.title = this.mode === 'word' ? 'Word-by-word gloss (click for sentence)' : 'Sentence translation (click for word-by-word)';
    align.setAttribute('aria-label', 'Switch bilingual mode: word-by-word or sentence');
    align.addEventListener('click', () => {
      const next: ReadingMode = this.mode === 'word' ? 'sentence' : 'word';
      void setReadingPreferences({ mode: next });
    });

    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'avs-inline-btn';
    refresh.innerHTML = ICON_REFRESH;
    refresh.title = 'Re-translate this page (bypass cache)';
    refresh.setAttribute('aria-label', 'Re-translate this page');
    refresh.addEventListener('click', () => void this.refresh());

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'avs-inline-btn';
    close.innerHTML = ICON_CLOSE;
    close.title = 'Close bilingual reading';
    close.setAttribute('aria-label', 'Close bilingual reading');
    close.addEventListener('click', () => this.close());

    control.append(label, toggle, align, refresh, close);
    document.body.append(control);
    this.control = control;
    this.modeButton = align;
  }

  private refreshControl(): void {
    if (!this.modeButton) return;
    this.modeButton.innerHTML = this.mode === 'word' ? ICON_GLOSS_WORD : ICON_LANGUAGES;
    this.modeButton.title =
      this.mode === 'word' ? 'Word-by-word gloss (click for sentence)' : 'Sentence translation (click for word-by-word)';
  }
}
