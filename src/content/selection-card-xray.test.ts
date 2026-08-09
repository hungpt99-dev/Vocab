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
