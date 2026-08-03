import { describe, expect, it } from 'vitest';
import { AiError, aiErrorMessage } from './types';

describe('aiErrorMessage', () => {
  it('gives an actionable message for the no-provider case', () => {
    const err = new AiError('unknown_provider', 'No active AI provider is configured.');
    expect(aiErrorMessage(err)).toMatch(/Settings/i);
  });

  it('pass through other AiError messages', () => {
    expect(aiErrorMessage(new AiError('timeout', 'Request timed out.'))).toBe('Request timed out.');
  });

  it('falls back to a generic message for non-Error values', () => {
    expect(aiErrorMessage('weird')).toBe('The AI request failed.');
    expect(aiErrorMessage(undefined)).toBe('The AI request failed.');
  });

  it('uses the message of a plain Error', () => {
    expect(aiErrorMessage(new Error('boom'))).toBe('boom');
  });
});
