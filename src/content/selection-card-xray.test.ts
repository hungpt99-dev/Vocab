import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectionCard, type CardState } from './selection-card';
import { sendMessage } from '@/shared/messaging/client';
import type { Explanation } from '@/shared/types/vocabulary';
import type { XRayReadingResult } from '@/shared/types/xray';

vi.mock('@/shared/messaging/client', () => ({
  sendMessage: vi.fn(),
}));

function makeState(text: string, unit: CardState['unit'] = 'sentence'): CardState {
  return {
    text,
    sentence: text,
    sourceUrl: 'https://example.com',
    sourceTitle: 'Example',
    unit,
    rect: { top: 100, bottom: 114, left: 20, width: 50 },
  };
}

function explanationWithXRay(xray: XRayReadingResult): Explanation {
  return {
    meaning: xray.core.simpleMeaning,
    simpleExplanation: xray.core.simpleMeaning,
    translation: '',
    examples: [],
    synonyms: [],
    antonyms: [],
    relatedWords: [],
    pronunciation: '',
    collocations: [],
    grammar: '',
    xray,
    provider: 'openai',
    model: 'gpt-4o-mini',
    generatedAt: 0,
  };
}

const ENGLISH_XRAY: XRayReadingResult = {
  detectedLanguage: 'English',
  originalText: 'The report that the committee released yesterday has raised concerns.',
  core: {
    representation: 'The report → has raised → concerns',
    simpleMeaning: 'The report has caused concern.',
  },
  complexity: [
    {
      text: 'that the committee released yesterday',
      explanation: 'Extra information about the report.',
      relatesTo: 'the report',
    },
  ],
  relationships: [{ from: 'the committee', relation: 'released', to: 'the report' }],
  fullExplanation:
    'The committee released a report yesterday, and that report has now caused concern.',
};

const VIETNAMESE_XRAY: XRayReadingResult = {
  detectedLanguage: 'Vietnamese',
  originalText: 'Bản báo cáo mà ủy ban công bố hôm qua đã gây lo ngại.',
  core: {
    representation: 'Bản báo cáo → gây → lo ngại',
    simpleMeaning: 'Bản báo cáo đã gây ra lo ngại.',
  },
  complexity: [{ text: 'mà ủy ban công bố hôm qua', explanation: 'Bổ nghĩa cho bản báo cáo.' }],
  relationships: [],
  fullExplanation: 'Ủy ban công bố báo cáo hôm qua, và báo cáo đó hiện đang gây lo ngại.',
};

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('SelectionCard X-Ray Reading', () => {
  it('shows an X-Ray Reading button in the existing selection popup', () => {
    const card = new SelectionCard();
    card.show(makeState('anything'));
    const button = document.querySelector<HTMLButtonElement>('[data-action="xray"]');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBe('X-Ray Reading');
    // Existing actions must still be present.
    for (const id of ['generate', 'save', 'copy']) {
      expect(document.querySelector(`[data-action="${id}"]`)).not.toBeNull();
    }
    card.destroy();
  });

  it('emits the xray toolbar action when clicked', () => {
    const card = new SelectionCard();
    card.show(makeState('The report has raised concerns.'));
    const handler = vi.fn();
    document.addEventListener('avs-toolbar-action', handler);
    document.querySelector<HTMLButtonElement>('[data-action="xray"]')!.click();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: expect.objectContaining({ action: 'xray' }) }),
    );
    card.destroy();
  });

  it('requests the xray kind and never pins a source language', async () => {
    vi.mocked(sendMessage).mockResolvedValue(explanationWithXRay(ENGLISH_XRAY) as never);
    const card = new SelectionCard();
    const state = makeState(ENGLISH_XRAY.originalText);
    card.show(state);
    await card.showExplain(state, 'xray');

    const explainCall = vi
      .mocked(sendMessage)
      .mock.calls.map((call) => call[0] as { type: string; payload?: Record<string, unknown> })
      .find((message) => message.type === 'explain');
    expect(explainCall?.payload?.kind).toBe('xray');
    // Language-agnostic: the frontend does not tell the model what language it is.
    expect(explainCall?.payload).not.toHaveProperty('language');
    card.destroy();
  });

  it('renders core meaning, complexity and the reconstruction', async () => {
    vi.mocked(sendMessage).mockResolvedValue(explanationWithXRay(ENGLISH_XRAY) as never);
    const card = new SelectionCard();
    const state = makeState(ENGLISH_XRAY.originalText);
    card.show(state);
    await card.showExplain(state, 'xray');

    const body = document.querySelector('.avs-selection-card-body')!;
    const text = body.textContent ?? '';
    expect(text).toContain('Core Meaning');
    expect(text).toContain('The report → has raised → concerns');
    expect(text).toContain('What Makes It Complex?');
    expect(text).toContain('that the committee released yesterday');
    expect(text).toContain('Put It Together');
    expect(text).toContain('caused concern');
    expect(text).toContain('Detected language: English');
    card.destroy();
  });

  it('renders a non-English result through the very same code path', async () => {
    vi.mocked(sendMessage).mockResolvedValue(explanationWithXRay(VIETNAMESE_XRAY) as never);
    const card = new SelectionCard();
    const state = makeState(VIETNAMESE_XRAY.originalText);
    card.show(state);
    await card.showExplain(state, 'xray');

    const text = document.querySelector('.avs-selection-card-body')?.textContent ?? '';
    expect(text).toContain('Bản báo cáo → gây → lo ngại');
    expect(text).toContain('mà ủy ban công bố hôm qua');
    expect(text).toContain('Detected language: Vietnamese');
    card.destroy();
  });

  it('falls back to the plain explanation when no structured payload is returned', async () => {
    const plain = explanationWithXRay(ENGLISH_XRAY);
    delete (plain as { xray?: unknown }).xray;
    plain.meaning = 'A plain meaning.';
    vi.mocked(sendMessage).mockResolvedValue(plain as never);
    const card = new SelectionCard();
    const state = makeState('something');
    card.show(state);
    await card.showExplain(state, 'xray');
    expect(document.querySelector('.avs-selection-card-body')?.textContent).toContain(
      'A plain meaning.',
    );
    card.destroy();
  });

  it('shows a loading state while the request is in flight', () => {
    vi.mocked(sendMessage).mockReturnValue(new Promise(() => {}) as never);
    const card = new SelectionCard();
    const state = makeState('slow text');
    card.show(state);
    void card.showExplain(state, 'xray');
    expect(document.querySelector('.avs-selection-card-status')?.textContent).toBe(
      'X-raying this text…',
    );
    card.destroy();
  });

  it('prevents duplicate requests while one is in flight', () => {
    vi.mocked(sendMessage).mockReturnValue(new Promise(() => {}) as never);
    const card = new SelectionCard();
    const state = makeState('slow text');
    card.show(state);
    void card.showExplain(state, 'xray');
    void card.showExplain(state, 'xray');
    void card.showExplain(state, 'xray');
    const explainCalls = vi
      .mocked(sendMessage)
      .mock.calls.filter((call) => (call[0] as { type: string }).type === 'explain');
    expect(explainCalls).toHaveLength(1);
    card.destroy();
  });

  it('shows an error with a working retry button', async () => {
    vi.mocked(sendMessage).mockRejectedValue(new Error('boom'));
    const card = new SelectionCard();
    const state = makeState('bad');
    card.show(state);
    await card.showExplain(state, 'xray');

    const body = document.querySelector('.avs-selection-card-body')!;
    expect(body.textContent).toContain('boom');
    const retry = body.querySelector<HTMLButtonElement>('[data-action="retry"]');
    expect(retry).not.toBeNull();

    vi.mocked(sendMessage).mockResolvedValue(explanationWithXRay(ENGLISH_XRAY) as never);
    retry!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('.avs-selection-card-body')?.textContent).toContain(
      'Core Meaning',
    );
    card.destroy();
  });
});

const JAPANESE_XRAY: XRayReadingResult = {
  detectedLanguage: 'Japanese',
  originalText: '委員会が昨日公表した報告書が懸念を呼んでいる。',
  core: {
    representation: '報告書 → 呼んでいる → 懸念',
    simpleMeaning: '報告書が懸念を招いている。',
  },
  complexity: [{ text: '委員会が昨日公表した', explanation: '報告書を説明する連体修飾節。' }],
  relationships: [],
  fullExplanation: '委員会が昨日報告書を公表し、その報告書が今、懸念を招いている。',
  // Structure described with Japanese categories, not subject-verb-object.
  structure: '連体修飾節が「報告書」を修飾し、その報告書が主節の主語になっている。',
  grammar: '連体修飾節と、継続を表すテイル形。',
  why: '報告書を前に置くことで、委員会ではなく報告書が話題になる。',
  vocabulary: [{ term: '懸念を呼ぶ', note: '心配を引き起こす', kind: '慣用表現' }],
  difficulty: { cefr: 'B2', reason: '連体修飾節が長い。' },
  simplerVersion: '委員会が昨日報告書を出した。それが心配を招いている。',
};

const FULL_XRAY: XRayReadingResult = {
  ...ENGLISH_XRAY,
  structure: 'One main clause; a relative clause modifies the subject.',
  grammar: 'Relative clause plus present perfect.',
  meaning: 'The publication has produced worry among readers.',
  why: 'Fronting the report makes it the topic, not the committee.',
  vocabulary: [
    { term: 'raise concerns', note: 'to cause worry', kind: 'collocation' },
    { term: 'release', note: 'to publish officially' },
  ],
  difficulty: { cefr: 'B2', reason: 'Embedded clause and abstract nouns.' },
  simplerVersion: 'The committee published a report yesterday. People are worried.',
};

describe('SelectionCard X-Ray whole-sentence anatomy (VOC-122)', () => {
  async function renderFull(xray: XRayReadingResult): Promise<HTMLElement> {
    vi.mocked(sendMessage).mockResolvedValue(explanationWithXRay(xray) as never);
    const card = new SelectionCard();
    const state = makeState(xray.originalText);
    card.show(state);
    await card.showExplain(state, 'xray');
    return document.querySelector<HTMLElement>('.avs-selection-card-body')!;
  }

  it('renders every anatomy section', async () => {
    const body = await renderFull(FULL_XRAY);
    const labels = [...body.querySelectorAll('.avs-xray-summary')].map((s) => s.textContent);
    expect(labels).toEqual([
      'Structure',
      'Grammar',
      'Meaning',
      'Why it is written this way',
      'Vocabulary',
      'Simpler version',
    ]);
    const text = body.textContent ?? '';
    expect(text).toContain('a relative clause modifies the subject');
    expect(text).toContain('present perfect');
    expect(text).toContain('produced worry among readers');
    expect(text).toContain('makes it the topic');
    expect(text).toContain('raise concerns');
    expect(text).toContain('collocation');
    expect(text).toContain('People are worried');
  });

  it('keeps the sections collapsed so the panel stays compact', async () => {
    const body = await renderFull(FULL_XRAY);
    const sections = [...body.querySelectorAll<HTMLDetailsElement>('.avs-xray-section')];
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.every((s) => !s.open)).toBe(true);
    // The core summary is NOT hidden behind a disclosure.
    expect(body.textContent).toContain('The report → has raised → concerns');
  });

  it('shows the CEFR difficulty as a glanceable chip, outside the sections', async () => {
    const body = await renderFull(FULL_XRAY);
    const chip = body.querySelector('.avs-xray-cefr');
    expect(chip?.textContent).toBe('B2');
    expect(chip?.closest('.avs-xray-section')).toBeNull();
    expect(body.textContent).toContain('Embedded clause and abstract nouns.');
  });

  it('omits sections the model did not return', async () => {
    const body = await renderFull(ENGLISH_XRAY);
    expect(body.querySelector('.avs-xray-section')).toBeNull();
    expect(body.querySelector('.avs-xray-cefr')).toBeNull();
    // The VOC-121 view still renders in full.
    expect(body.textContent).toContain('Core Meaning');
    expect(body.textContent).toContain('Put It Together');
  });

  it('renders anatomy for a third language through identical code', async () => {
    const body = await renderFull(JAPANESE_XRAY);
    const text = body.textContent ?? '';
    // Japanese grammatical categories survive verbatim; nothing is anglicised.
    expect(text).toContain('連体修飾節');
    expect(text).toContain('テイル形');
    expect(text).toContain('懸念を呼ぶ');
    expect(text).toContain('慣用表現');
    expect(text).toContain('Detected language: Japanese');
    expect(body.querySelector('.avs-xray-cefr')?.textContent).toBe('B2');
    // Same section labels as English: one universal frontend, no per-language branch.
    const labels = [...body.querySelectorAll('.avs-xray-summary')].map((s) => s.textContent);
    expect(labels).toContain('Structure');
    expect(labels).toContain('Vocabulary');
  });

  it('drops the vocabulary section when there are no items', async () => {
    const body = await renderFull({ ...FULL_XRAY, vocabulary: [] });
    const labels = [...body.querySelectorAll('.avs-xray-summary')].map((s) => s.textContent);
    expect(labels).not.toContain('Vocabulary');
    expect(labels).toContain('Structure');
  });
});
