import { describe, expect, it, vi } from 'vitest';
import { AiLinguisticAnalyzer, IdentityLinguisticAnalyzer } from './ai-linguistic-analyzer';
import type { Settings } from '@/shared/types/settings';
import type { AiProvider } from '@/ai/types';

// A mutable holder so each test can install a different provider implementation
// while the (hoisted) registry mock stays stable.
const providerHolder: { current: AiProvider } = { current: {} as AiProvider };

vi.mock('@/ai/registry', () => ({
  getProvider: () => providerHolder.current,
}));

function fakeProvider(completeText: string): AiProvider {
  return {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o',
    defaultBaseUrl: '',
    requiresApiKey: true,
    explain: vi.fn(),
    translate: vi.fn(),
    align: vi.fn(),
    complete: vi.fn(async () => completeText),
  } as unknown as AiProvider;
}

const SETTINGS_WITH_KEY: Settings = {
  providers: [
    { id: 'p1', type: 'openai', name: 'OpenAI', apiKey: 'test-key', baseUrl: '', model: 'gpt-4o', enabled: true },
  ],
  activeProviderId: 'p1',
  targetLanguage: { code: 'en-US', name: 'English' },
  highlightEnabled: true,
  highlightColor: '#fff',
  autoExplainOnSave: false,
  readingMode: 'everywhere',
  allowedDomains: [],
  popupShowTranslation: true,
  popupShowSimplify: true,
  popupDefaultTab: 'library',
  explainPromptTemplate: '',
  readingExperience: { showOriginal: true, showTranslation: true, width: 320, fontSize: 16, spacing: 1.5 },
  radar: { goal: '' },
};

// No active provider at all -> runWithFallback throws `unknown_provider`.
const SETTINGS_NO_ACTIVE: Settings = { ...SETTINGS_WITH_KEY, activeProviderId: 'missing' };

describe('AiLinguisticAnalyzer', () => {
  it('prompts the model and parses the linguistic JSON', async () => {
    providerHolder.current = fakeProvider(
      '```json\n{"singular":"book","lemma":"book","partOfSpeech":"noun","familyId":"book","confident":true}\n```',
    );

    const analyzer = new AiLinguisticAnalyzer(async () => SETTINGS_WITH_KEY);
    const result = await analyzer.analyze('books', 'I read many books.');

    const complete = providerHolder.current.complete as unknown as { mock: { calls: unknown[][] } };
    expect(complete.mock.calls.length).toBe(1);
    const [system, user] = complete.mock.calls[0] as [string, string];
    expect(system).toContain('multilingual linguistic analyzer');
    expect(user).toContain('books');
    expect(user).toContain('I read many books.');
    expect(result).toMatchObject({
      singular: 'book',
      lemma: 'book',
      partOfSpeech: 'noun',
      familyId: 'book',
      confident: true,
    });
  });

  it('falls back to a non-destructive identity when no AI provider is configured', async () => {
    const analyzer = new AiLinguisticAnalyzer(async () => SETTINGS_NO_ACTIVE);
    const result = await analyzer.analyze('livre', 'un livre');
    expect(result.lemma).toBe('livre');
    expect(result.familyId).toBe('livre');
    expect(result.confident).toBe(false);
  });

  it('falls back to identity when the model returns unparseable output', async () => {
    providerHolder.current = fakeProvider('Sorry, I cannot do that.');
    const analyzer = new AiLinguisticAnalyzer(async () => SETTINGS_WITH_KEY);
    const result = await analyzer.analyze('本');
    expect(result.lemma).toBe('本');
    expect(result.confident).toBe(false);
  });
});

describe('IdentityLinguisticAnalyzer', () => {
  it('returns the word as its own lemma/family without any AI', async () => {
    const analyzer = new IdentityLinguisticAnalyzer();
    const result = await analyzer.analyze('Sách');
    expect(result).toMatchObject({ lemma: 'Sách', familyId: 'sách', confident: false });
  });
});
