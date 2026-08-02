import { describe, expect, it, vi } from 'vitest';
import { dispatch } from './router';
const sender = {};
describe('dispatch', () => {
    it('routes to the matching handler and wraps the result', async () => {
        const handler = vi.fn(async () => null);
        const result = await dispatch({ 'get-selection': handler }, { type: 'get-selection' }, sender);
        expect(handler).toHaveBeenCalled();
        expect(result).toEqual({ ok: true, data: null });
    });
    it('rejects malformed messages', async () => {
        expect(await dispatch({}, 'nonsense', sender)).toEqual({ ok: false, error: 'Malformed message.' });
        expect(await dispatch({}, null, sender)).toEqual({ ok: false, error: 'Malformed message.' });
    });
    it('rejects unknown message types', async () => {
        const result = await dispatch({}, { type: 'mystery' }, sender);
        expect(result).toEqual({ ok: false, error: 'Unhandled message type: mystery' });
    });
    it('converts thrown errors into failed results', async () => {
        const handler = vi.fn(async () => {
            throw new Error('boom');
        });
        expect(await dispatch({ 'get-selection': handler }, { type: 'get-selection' }, sender)).toEqual({
            ok: false,
            error: 'boom',
        });
    });
    it('preserves an error code when present', async () => {
        const handler = vi.fn(async () => {
            const error = Object.assign(new Error('nope'), { code: 'missing_api_key' });
            throw error;
        });
        expect(await dispatch({ explain: handler }, { type: 'explain' }, sender)).toEqual({
            ok: false,
            error: 'nope',
            code: 'missing_api_key',
        });
    });
    it('handles non-Error throwables', async () => {
        const handler = vi.fn(async () => {
            throw 'string failure';
        });
        const result = await dispatch({ 'get-selection': handler }, { type: 'get-selection' }, sender);
        expect(result).toEqual({ ok: false, error: 'Unexpected error.' });
    });
});
