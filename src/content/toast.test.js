import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showToast } from './toast';
beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
});
describe('showToast', () => {
    it('renders an accessible status message', () => {
        showToast('Saved!', 'success');
        const toast = document.getElementById('avs-toast');
        expect(toast.textContent).toBe('Saved!');
        expect(toast.dataset.variant).toBe('success');
        expect(toast.getAttribute('role')).toBe('status');
        expect(toast.getAttribute('aria-live')).toBe('polite');
    });
    it('reuses one element and updates the variant', () => {
        showToast('One', 'success');
        showToast('Two', 'error');
        expect(document.querySelectorAll('.avs-toast')).toHaveLength(1);
        expect(document.getElementById('avs-toast').dataset.variant).toBe('error');
    });
    it('removes itself after the timeout', () => {
        showToast('Bye');
        vi.advanceTimersByTime(3000);
        expect(document.getElementById('avs-toast')).toBeNull();
    });
});
