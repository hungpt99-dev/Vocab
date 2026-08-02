const TOAST_ID = 'avs-toast';
const VISIBLE_MS = 2600;

let timer: ReturnType<typeof setTimeout> | undefined;

/** Show a transient status message in the bottom-right of the page. */
export function showToast(message: string, variant: 'success' | 'error' = 'success'): void {
  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.className = 'avs-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.append(toast);
  }

  toast.dataset.variant = variant;
  toast.textContent = message;

  clearTimeout(timer);
  timer = setTimeout(() => toast?.remove(), VISIBLE_MS);
}
