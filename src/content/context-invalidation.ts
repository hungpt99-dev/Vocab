/**
 * Errors that are harmless once the extension's execution context has been torn
 * down (extension reload/update, or the MV3 service worker being killed). They
 * surface from in-flight or fire-and-forget chrome.* calls and, if unhandled,
 * spam the console with "Uncaught (in promise) Error: Extension context
 * invalidated." We detect and swallow them in a global unhandledrejection guard.
 */
export const CONTEXT_INVALIDATION_PATTERN =
  /Extension context invalidated|The extensions API|message channel closed|Could not establish connection/i;

export function isContextInvalidationError(reason: unknown): boolean {
  if (!reason) return false;
  const message =
    typeof reason === 'object' && 'message' in reason
      ? String((reason as { message: unknown }).message)
      : String(reason);
  return CONTEXT_INVALIDATION_PATTERN.test(message);
}
