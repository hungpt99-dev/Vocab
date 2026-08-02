## What and why

<!-- What does this change do, and what problem does it solve? Link the Linear issue. -->

Closes VOC-

## How

<!-- Notable implementation details, trade-offs, or anything a reviewer should look at first. -->

## Definition of Done

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run test` passes
- [ ] `npm run test:e2e` passes
- [ ] `npm run build` succeeds
- [ ] New behaviour is covered by tests
- [ ] Accessibility checked (keyboard reachable, accessible names, focus visible)
- [ ] No console errors in popup, options or an injected page
- [ ] No hardcoded design values — tokens only
- [ ] No duplicated logic introduced
- [ ] Documentation updated (see below)
- [ ] `docs/CHANGELOG.md` updated for user-visible changes

## Documentation impact

<!-- Tick every document this change affects, and confirm it was updated. -->

- [ ] None — this change is invisible to architecture, API, storage and tooling
- [ ] `docs/ARCHITECTURE.md` / `docs/SYSTEM_DESIGN.md`
- [ ] `docs/FOLDER_STRUCTURE.md`
- [ ] `docs/STORAGE.md` (schema or migration change)
- [ ] `docs/AI_PROVIDER.md` (provider added or contract changed)
- [ ] `docs/SECURITY.md` (permission or data-handling change)
- [ ] `docs/TESTING.md`
- [ ] `docs/DECISION_LOG.md` (new ADR for a significant decision)
- [ ] `README.md`
