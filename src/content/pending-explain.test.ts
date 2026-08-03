import { afterEach, describe, expect, it } from 'vitest';
import { setPendingExplain, takePendingExplain } from './pending-explain';

afterEach(() => {
  void chrome.storage.local.remove('avs:pending-explain');
});

describe('pending-explain', () => {
  it('stores and consumes the pending explain once', async () => {
    await setPendingExplain({ word: 'serendipity', context: 'A sentence.', kind: 'word' });

    const first = await takePendingExplain();
    expect(first).toEqual({ word: 'serendipity', context: 'A sentence.', kind: 'word' });

    const second = await takePendingExplain();
    expect(second).toBeNull();
  });

  it('tolerates a missing context', async () => {
    await setPendingExplain({ word: 'hello' });
    const value = await takePendingExplain();
    expect(value).toEqual({ word: 'hello' });
  });
});
