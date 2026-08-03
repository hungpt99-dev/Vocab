import { registerMessageHandlers } from '@/shared/messaging/router';
import { broadcast, sendToTab } from '@/shared/messaging/client';
import { createHandlers, defaultDeps, readActiveSelection, saveSelection } from './handlers';
import { settingsRepository } from '@/storage/settings-repository';

const CONTEXT_MENU_ID = 'avs-save-selection';

registerMessageHandlers(createHandlers());

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Save "%s" to vocabulary',
      contexts: ['selection'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  void handleCapture(tab?.id, info.selectionText ?? '', info.pageUrl ?? '', tab?.title ?? '');
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'save-selection') {
    void handleCapture();
    return;
  }
  if (command === 'toggle-bilingual-reading') {
    void toggleBilingualReading();
  }
});

/** Ask the active tab's content script to open or close bilingual reading. */
async function toggleBilingualReading(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (typeof tab?.id !== 'number') return;
  await sendToTab(tab.id, { type: 'toggle-bilingual-reading' });
}

/**
 * Save a selection captured from the context menu or a keyboard shortcut.
 * Falls back to asking the content script when the caller has no text.
 */
async function handleCapture(
  tabId?: number,
  selectionText = '',
  pageUrl = '',
  pageTitle = '',
): Promise<void> {
  const fromPage = await readActiveSelection();
  const word = (selectionText || fromPage?.word || '').trim();

  if (!word) {
    await notify(tabId, 'Select a word first, then save it.', 'error');
    return;
  }

  try {
    await saveSelection(defaultDeps, {
      word,
      sentence: fromPage?.sentence ?? '',
      sourceUrl: fromPage?.sourceUrl || pageUrl,
      sourceTitle: fromPage?.sourceTitle || pageTitle,
    });
    await notify(tabId, `Saved "${word}" to your vocabulary.`, 'success');
    await broadcast({ type: 'vocabulary-changed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save that word.';
    await notify(tabId, message, 'error');
  }
}

async function notify(
  tabId: number | undefined,
  message: string,
  variant: 'success' | 'error',
): Promise<void> {
  const targetId = tabId ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  if (typeof targetId !== 'number') return;
  await sendToTab(targetId, { type: 'show-toast', payload: { message, variant } });
}

// Keep content scripts in sync when the user changes settings.
settingsRepository.onChange(() => {
  void broadcast({ type: 'settings-changed' });
});
