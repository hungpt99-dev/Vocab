import { ICON_CLOSE, ICON_BOOK_OPEN } from './icons';

const BAR_ID = 'avs-bilingual-bar';

/**
 * A slim fixed bar shown at the top of the page while bilingual (inline) reading
 * is enabled. It reflects the active state and lets the user turn the mode off
 * without opening the popup. While the page is activating (translations being
 * injected), it shows a loading spinner.
 */
export class BilingualBar {
  private element: HTMLElement | null = null;
  private spinner: HTMLElement | null = null;

  show(targetLanguage: string, onClose: () => void, loading = false): void {
    if (!this.element) {
      const bar = document.createElement('div');
      bar.id = BAR_ID;
      bar.className = 'avs-bilingual-bar';
      bar.setAttribute('role', 'status');

      const label = document.createElement('span');
      label.className = 'avs-bilingual-bar-label';
      label.innerHTML = `${ICON_BOOK_OPEN}<span>Bilingual · ${escapeHtml(targetLanguage)}</span>`;

      const spinner = document.createElement('span');
      spinner.className = 'avs-spinner';
      spinner.setAttribute('aria-hidden', 'true');

      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'avs-bilingual-bar-close';
      close.setAttribute('aria-label', 'Turn off bilingual mode');
      close.innerHTML = ICON_CLOSE;
      close.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      });

      bar.append(label, spinner, close);
      // Prepend (not fixed-overlay) so it occupies layout space at the top of the
      // page and pushes content down instead of covering it. Sticky keeps it
      // visible while scrolling.
      (document.body ?? document.documentElement).prepend(bar);
      this.element = bar;
      this.spinner = spinner;
    } else {
      const span = this.element.querySelector('span');
      if (span) span.textContent = `Bilingual · ${targetLanguage}`;
      this.element.hidden = false;
    }
    this.setLoading(loading);
  }

  setLoading(loading: boolean): void {
    if (!this.element) return;
    this.element.classList.toggle('avs-bilingual-bar--loading', loading);
    this.element.setAttribute('aria-busy', loading ? 'true' : 'false');
    if (this.spinner) this.spinner.style.display = loading ? '' : 'none';
  }

  hide(): void {
    if (this.element) this.element.hidden = true;
  }
}

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
