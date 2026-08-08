/**
 * First-run onboarding flag, stored in chrome.storage.local (shared across all
 * extension contexts, unlike localStorage). A single dismiss writes the flag so
 * the coachmark never reappears.
 */
const ONBOARDING_KEY = 'avs:onboarded';

export async function isOnboarded(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(ONBOARDING_KEY);
    return Boolean(result[ONBOARDING_KEY]);
  } catch {
    return false;
  }
}

export async function markOnboarded(): Promise<void> {
  try {
    await chrome.storage.local.set({ [ONBOARDING_KEY]: true });
  } catch {
    // Best-effort; the coachmark just re-shows next time if this fails.
  }
}
