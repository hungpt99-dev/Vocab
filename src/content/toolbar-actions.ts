import { sendMessage } from '@/shared/messaging/client';
import type { PopoverAnchor, SelectionPopover } from './selection-popover';
import type { MoreMenu } from './more-menu';
import type { ToolbarActionId } from './toolbar';
import { showToast } from './toast';
import { ICON_SETTINGS } from './icons';

export interface ToolbarActionDeps {
  /** Viewport rect to anchor the result popover to (the selection). */
  getAnchor: () => PopoverAnchor;
  /** The toolbar's More button, which anchors the dropdown menu. */
  getMoreButton: () => HTMLElement | null;
  popover: SelectionPopover;
  menu: MoreMenu;
  hideToolbar: () => void;
}

/**
 * Route a toolbar action to the existing message bus / handlers. The content
 * script only sends typed messages; every AI call happens in the service
 * worker, so no provider knowledge leaks into the page.
 */
export async function handleToolbarAction(
  action: ToolbarActionId,
  text: string,
  deps: ToolbarActionDeps,
): Promise<void> {
  switch (action) {
    case 'copy':
      await copySelection(text, deps.hideToolbar);
      return;
    case 'save':
      await saveToVocabulary(deps.hideToolbar);
      return;
    case 'explain':
    case 'translate':
      await openResultPopover(action, text, deps);
      return;
    case 'more':
      openMoreMenu(deps);
      return;
  }
}

async function copySelection(text: string, hideToolbar: () => void): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  } catch {
    showToast('Could not copy', 'error');
  }
  hideToolbar();
}

/** Save the current selection with its surrounding context (S6 flow). */
async function saveToVocabulary(hideToolbar: () => void): Promise<void> {
  try {
    const entry = await sendMessage({ type: 'save-current-selection' });
    if (entry) {
      showToast(`Saved "${entry.word}" to your vocabulary.`, 'success');
    } else {
      showToast('No selection to save.', 'error');
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Could not save that word.', 'error');
  }
  hideToolbar();
}

/** Open the result popover, asking the service worker for the data. */
async function openResultPopover(
  action: 'explain' | 'translate',
  text: string,
  deps: ToolbarActionDeps,
): Promise<void> {
  deps.hideToolbar();
  await deps.popover.show({
    title: action === 'explain' ? 'Explain' : 'Translate',
    anchor: deps.getAnchor(),
    load: async () => {
      if (action === 'explain') {
        const explanation = await sendMessage({ type: 'explain', payload: { word: text } });
        return { kind: 'explain', explanation };
      }
      const translation = await sendMessage({ type: 'translate', payload: { text } });
      return { kind: 'translate', translation };
    },
  });
}

function openMoreMenu(deps: ToolbarActionDeps): void {
  const anchor = deps.getMoreButton();
  if (!anchor) return;
  deps.menu.toggle(anchor, [
    {
      label: 'Open settings',
      icon: ICON_SETTINGS,
      run: () => {
        deps.hideToolbar();
        void sendMessage({ type: 'open-options' });
      },
    },
  ]);
}
