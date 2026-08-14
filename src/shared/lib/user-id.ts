import { createId } from './id';

const USER_ID_KEY = 'avs:user-id';

/**
 * Stable per-install identity used to scope vocabulary concepts.
 *
 * The app is local-first and single-owner per browser profile, but a stable id
 * lets the `(userId, familyId)` uniqueness guarantee be meaningful and future-
 * proofs the schema for multi-profile or sync scenarios. The id is generated
 * once and persisted; it never leaves the device.
 */
export async function getUserId(): Promise<string> {
  const stored = await chrome.storage.local.get(USER_ID_KEY);
  const existing = stored[USER_ID_KEY] as string | undefined;
  if (existing && existing.trim()) return existing;
  const fresh = createId();
  await chrome.storage.local.set({ [USER_ID_KEY]: fresh });
  return fresh;
}
