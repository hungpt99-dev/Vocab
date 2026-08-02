import { describe, expect, it } from 'vitest';
import { getProvider, listProviders } from './registry';
import { AI_PROVIDER_IDS } from '@/shared/types/settings';
import { AiError } from './types';
describe('registry', () => {
    it('exposes a provider for every declared id', () => {
        for (const id of AI_PROVIDER_IDS) {
            expect(getProvider(id).id).toBe(id);
        }
    });
    it('lists all providers with labels and defaults', () => {
        const providers = listProviders();
        expect(providers).toHaveLength(AI_PROVIDER_IDS.length);
        for (const provider of providers) {
            expect(provider.label).toBeTruthy();
            expect(provider.defaultModel).toBeTruthy();
            expect(provider.defaultBaseUrl).toMatch(/^https?:\/\//);
        }
    });
    it('throws for an unknown provider', () => {
        // @ts-expect-error deliberately invalid id
        expect(() => getProvider('nope')).toThrow(AiError);
    });
});
