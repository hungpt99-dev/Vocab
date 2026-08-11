/**
 * Domain matching helpers shared between the content-script entry and the
 * inline reader. Kept in its own module so neither imports the other — the
 * two previously formed a circular dependency (index → inline-reader → index)
 * that broke module evaluation in ESM contexts.
 */

/**
 * Whether `hostname` matches any entry in `domains`. Each domain is matched as a
 * bare hostname or as a subdomain of it, with a leading `www.` ignored on both
 * sides so `example.com` and `www.example.com` are equivalent.
 */
export function matchesDomain(hostname: string, domains: readonly string[]): boolean {
  const host = hostname.replace(/^www\./i, '').toLowerCase();
  return domains.some((raw) => {
    // A stored rule may be a bare hostname or a full URL the user pasted; normalise it.
    const domain = raw
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./i, '')
      .toLowerCase();
    return domain !== '' && (host === domain || host.endsWith(`.${domain}`));
  });
}
