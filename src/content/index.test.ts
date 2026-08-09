import { describe, expect, it } from 'vitest';
import { matchesDomain } from './index';

describe('matchesDomain', () => {
  it('matches an exact hostname', () => {
    expect(matchesDomain('example.com', ['example.com'])).toBe(true);
  });

  it('matches a subdomain of a configured domain', () => {
    expect(matchesDomain('news.example.com', ['example.com'])).toBe(true);
  });

  it('does not match an unrelated domain', () => {
    expect(matchesDomain('example.org', ['example.com'])).toBe(false);
  });

  it('does not match when the configured domain is a subdomain of the host', () => {
    // "example.com" host should NOT match a rule for "sub.example.com".
    expect(matchesDomain('example.com', ['sub.example.com'])).toBe(false);
  });

  it('ignores a leading www. on both sides', () => {
    expect(matchesDomain('www.example.com', ['example.com'])).toBe(true);
    expect(matchesDomain('example.com', ['www.example.com'])).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesDomain('Example.COM', ['example.com'])).toBe(true);
  });

  it('accepts full URLs and bare hostnames in the rule', () => {
    expect(matchesDomain('blog.example.com', ['https://example.com/path'])).toBe(true);
  });

  it('returns false for an empty rule list', () => {
    expect(matchesDomain('example.com', [])).toBe(false);
  });

  it('skips blank rule entries', () => {
    expect(matchesDomain('example.com', ['', '  '])).toBe(false);
  });
});
