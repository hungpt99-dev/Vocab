# Release Process

How a versioned release of AI Vocabulary Saver is cut and verified. This is the manual procedure today
(see [Known limitations](KNOWN_LIMITATIONS.md) L9 — no automated store submission yet).

Related: [Deployment](DEPLOYMENT.md), [CHANGELOG](CHANGELOG.md), the
[Versioning](#versioning) policy below.

---

## Versioning

[Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`.

| Bump | When |
| --- | --- |
| `PATCH` | Backwards-compatible bug fixes, dependency bumps with no behaviour change |
| `MINOR` | New, backwards-compatible functionality (a new provider, a new feature) |
| `MAJOR` | Breaking changes — a settings or backup format change that older versions cannot read, or a permission model change |

The backup schema version (`BACKUP_SCHEMA_VERSION`) is independent of the package version and follows
its own forward-only rule: a new version may import older backups, but an older extension must refuse a
newer backup (it already does — `parseBackup` rejects `schemaVersion > supported`).

The manifest `version` and `package.json` `version` are always kept equal, because
`scripts/manifest.ts` reads the version from `package.json` at build time.

---

## Release checklist

Run top to bottom; do not skip a gate.

### 1. Prepare on a clean `main`

```bash
git checkout main
git pull --ff-only
git status           # must be clean
```

### 2. Run every gate

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

All must be green. A red gate means the release is not ready — fix forward, do not force.

### 3. Decide the version

Per the [Versioning](#versioning) table. If unsure, discuss in the issue.

### 4. Update the changelog

Move entries from **Unreleased** to a new `## [x.y.z] - YYYY-MM-DD` heading in
[CHANGELOG](CHANGELOG.md). Group under Added / Changed / Fixed / Removed. Write for users.

### 5. Bump the version

```bash
npm version <major|minor|patch> --no-git-tag-version
```

This updates `package.json`. The manifest version tracks it automatically on the next build. Commit the
bump:

```bash
git commit -am "chore: release vX.Y.Z"
git tag vX.Y.Z
```

### 6. Build the distributable

```bash
rm -rf dist
npm run build
npm run package        # produces ai-vocabulary-saver.zip
```

### 7. Verify the artifact

Load `dist/` into a clean Chrome profile and smoke-test the release notes' items:

- [ ] Save a word (menu, shortcut, popup).
- [ ] Highlighting appears and the hover card opens with keyboard focus.
- [ ] AI Explain works for the default provider.
- [ ] Export, then re-import with both merge and replace.
- [ ] No console errors on any surface.

### 8. Push and publish

```bash
git push origin main --follow-tags
```

Then, if publishing to the Chrome Web Store, follow [Deployment](DEPLOYMENT.md) to upload the zip and
submit for review. Tagged GitHub releases are created from the pushed tag.

### 9. Close the release

- Move the milestone to Done in Linear.
- Announce if the change is user-visible (a changelog link is enough).

---

## Hotfixes

A hotfix to a released version:

1. Branch from the release tag: `git switch -c fix/<issue> vX.Y.Z`.
2. Fix, test, document, update the changelog.
3. Bump the `PATCH` version.
4. Build and verify. If the fix must ship to the store, follow [Deployment](DEPLOYMENT.md).
5. Merge back to `main` (or rebase `main` onto the fix and fast-forward).
6. Tag and push: `git tag vX.Y.(Z+1) && git push origin main --follow-tags`.

Preserve the version order — never reuse or re-tag `vX.Y.Z`.

---

## Verification evidence

Every release records the gate results it was cut from:

- CI run URL (the `quality` and `e2e` jobs).
- The commit the tag points to.
- The `ai-vocabulary-saver.zip` artifact hash.

A release without these is not auditable and should not be shipped.
