import { describe, expect, it } from 'vitest';
import { parseTranslations } from './parse-translation';

describe('parseTranslations', () => {
  it('parses a clean translations array', () => {
    expect(parseTranslations('{"translations":["Hola","Mundo"]}', 2)).toEqual(['Hola', 'Mundo']);
  });

  it('tolerates a fenced JSON response', () => {
    const raw = '```json\n{"translations":["Hola","Mundo"]}\n```';
    expect(parseTranslations(raw, 2)).toEqual(['Hola', 'Mundo']);
  });

  it('collapses whitespace in each translation', () => {
    expect(parseTranslations('{"translations":["  Hola   mundo  "]}', 1)).toEqual(['Hola mundo']);
  });

  it('rejects a response without a translations array', () => {
    expect(() => parseTranslations('{"meaning":"x"}', 1)).toThrow(/translations array/);
  });

  it('rejects a count mismatch so columns cannot misalign', () => {
    expect(() => parseTranslations('{"translations":["Hola"]}', 2)).toThrow(/returned 1 translations/);
  });
});
