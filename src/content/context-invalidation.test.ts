import { describe, expect, it } from 'vitest';
import { isContextInvalidationError } from './context-invalidation';

describe('isContextInvalidationError', () => {
  it('matches the classic Extension context invalidated rejection', () => {
    expect(isContextInvalidationError(new Error('Uncaught (in promise) Error: Extension context invalidated.'))).toBe(true);
  });

  it('matches message-channel-closed and connection failures', () => {
    expect(isContextInvalidationError(new Error('The message channel closed before a response was received.'))).toBe(true);
    expect(isContextInvalidationError(new Error('Could not establish connection. Receiving end does not exist.'))).toBe(true);
  });

  it('matches a plain-string rejection with the error text', () => {
    expect(isContextInvalidationError('Extension context invalidated')).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isContextInvalidationError(new Error('No response from the extension background worker.'))).toBe(false);
    expect(isContextInvalidationError(new Error('network timeout'))).toBe(false);
    expect(isContextInvalidationError(null)).toBe(false);
    expect(isContextInvalidationError(undefined)).toBe(false);
  });
});
