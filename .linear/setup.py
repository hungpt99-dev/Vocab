#!/usr/bin/env python3
"""Bootstrap the Linear project, milestones and issue backlog for AI Vocabulary Saver."""
import json, os, sys, urllib.request

KEY = os.environ["LINEAR_API_KEY"]
TEAM = "546a43a3-c483-4412-a8ef-bd5fb0656fa0"
URL = "https://api.linear.app/graphql"


def gql(query, variables=None):
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Authorization": KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        out = json.load(r)
    if "errors" in out:
        raise SystemExit(json.dumps(out["errors"], indent=2))
    return out["data"]


def create_project(name, description):
    q = """mutation($i: ProjectCreateInput!){ projectCreate(input:$i){ project{ id name } } }"""
    return gql(q, {"i": {"name": name, "description": description, "teamIds": [TEAM]}})["projectCreate"]["project"]


def create_milestone(project_id, name, description, sort):
    q = """mutation($i: ProjectMilestoneCreateInput!){ projectMilestoneCreate(input:$i){ projectMilestone{ id name } } }"""
    return gql(q, {"i": {"projectId": project_id, "name": name,
                         "description": description, "sortOrder": sort}})["projectMilestoneCreate"]["projectMilestone"]


def create_label(name, color):
    q = """mutation($i: IssueLabelCreateInput!){ issueLabelCreate(input:$i){ issueLabel{ id name } } }"""
    try:
        return gql(q, {"i": {"teamId": TEAM, "name": name, "color": color}})["issueLabelCreate"]["issueLabel"]
    except SystemExit:
        d = gql("query($t:String!){ issueLabels(filter:{team:{id:{eq:$t}}}){ nodes{ id name } } }", {"t": TEAM})
        for n in d["issueLabels"]["nodes"]:
            if n["name"] == name:
                return n
        raise


def create_issue(**kw):
    q = """mutation($i: IssueCreateInput!){ issueCreate(input:$i){ issue{ id identifier title } } }"""
    kw["teamId"] = TEAM
    return gql(q, {"i": kw})["issueCreate"]["issue"]


def main():
    project = create_project(
        "AI Vocabulary Saver",
        "Local-first Chrome MV3 extension for saving vocabulary while browsing. "
        "React + TypeScript + Vite + Dexie + Tailwind. BYO AI API key, no backend, no auth, no cloud.")
    print("project", project)

    ms_defs = [
        ("M1 - Foundation", "Repo scaffold, tooling, CI-quality gates, MV3 shell loadable in Chrome.", 1.0),
        ("M2 - Core Capture & Storage", "Dexie storage layer, capture via context menu/popup/shortcut.", 2.0),
        ("M3 - Library & Highlighting", "Vocabulary library CRUD UI and on-page highlighting with hover card.", 3.0),
        ("M4 - AI & Settings", "Multi-provider AI abstraction, AI Explain, settings, import/export.", 4.0),
        ("M5 - Hardening & Release", "E2E, a11y, docs, production build, release candidate.", 5.0),
    ]
    ms = {}
    for name, desc, sort in ms_defs:
        m = create_milestone(project["id"], name, desc, sort)
        ms[name.split(" ")[0]] = m["id"]
        print("milestone", m)

    labels = {}
    for name, color in [("epic", "#6e79f0"), ("foundation", "#4cb782"), ("storage", "#f2c94c"),
                        ("capture", "#eb5757"), ("library", "#bb87fc"), ("highlight", "#f2994a"),
                        ("ai", "#26b5ce"), ("settings", "#95a2b3"), ("quality", "#0f783c"),
                        ("docs", "#5e6ad2")]:
        labels[name] = create_label(name, color)["id"]
    print("labels ok")

    def dod(extra=""):
        return ("\n\n**Definition of Done**\n"
                "- [ ] TypeScript type-check passes (`npm run typecheck`)\n"
                "- [ ] ESLint passes (`npm run lint`)\n"
                "- [ ] Unit tests written and passing (`npm run test`)\n"
                "- [ ] Production build succeeds (`npm run build`)\n"
                "- [ ] No duplicated logic, no dead code, no console errors\n"
                "- [ ] Accessibility reviewed (keyboard + ARIA)\n"
                "- [ ] Docs/CHANGELOG updated\n" + extra)

    # (title, description, priority, milestone, labels, estimate)
    issues = [
        ("EPIC: Foundation & Tooling",
         "Umbrella epic for project scaffolding, build pipeline and quality gates.", 1, "M1", ["epic", "foundation"], 8),
        ("Scaffold Vite + React + TypeScript project",
         "Initialise the repository with Vite, React 18, TypeScript strict mode and a feature-based folder "
         "structure (`src/features`, `shared`, `storage`, `ai`, `content`, `background`, `popup`, `options`).\n\n"
         "**Acceptance Criteria**\n- `npm run dev` and `npm run build` work\n- TS strict mode on\n"
         "- Path alias `@/` resolves to `src/`\n- Folder structure matches the architecture spec", 1, "M1",
         ["foundation"], 3),
        ("Configure TailwindCSS design system",
         "Add Tailwind with a small design-token layer used by popup and options.\n\n**Acceptance Criteria**\n"
         "- Tailwind builds into popup and options bundles\n- Shared Button/Input/Badge primitives exist\n"
         "- Dark-mode friendly palette", 2, "M1", ["foundation"], 2),
        ("Set up ESLint, Prettier and type-check scripts",
         "Flat ESLint config with TypeScript + React hooks rules; npm scripts lint/typecheck/format.\n\n"
         "**Acceptance Criteria**\n- `npm run lint` exits 0 on a clean tree\n- `npm run typecheck` exits 0", 1,
         "M1", ["foundation", "quality"], 2),
        ("Set up Vitest with jsdom and coverage",
         "Unit test runner configured with jsdom environment, fake-indexeddb and chrome API mocks.\n\n"
         "**Acceptance Criteria**\n- `npm run test` runs a sample suite\n- chrome.* global is mockable", 1, "M1",
         ["foundation", "quality"], 2),
        ("Chrome MV3 manifest and multi-entry build",
         "Author `manifest.json` (MV3) with service worker, content script, popup, options, commands and "
         "contextMenus/storage permissions; wire a multi-entry Vite build that emits a loadable `dist/`.\n\n"
         "**Acceptance Criteria**\n- `dist/` loads in chrome://extensions with no errors\n"
         "- Popup, options, background and content script all resolve", 1, "M1", ["foundation"], 3),

        ("EPIC: Storage Layer",
         "Umbrella epic for the local-first Dexie/IndexedDB persistence layer.", 1, "M2", ["epic", "storage"], 8),
        ("Define domain models and Dexie schema",
         "Model `VocabularyEntry` (id, word, phrase, sentence, sourceUrl, note, tags, favorite, aiExplanation, "
         "createdAt, updatedAt) and `Settings`. Create the Dexie database with indexes on word, createdAt, "
         "favorite and tags.\n\n**Acceptance Criteria**\n- Types exported from `src/storage`\n"
         "- Multi-entry index on tags\n- Unique lowercase word key", 1, "M2", ["storage"], 3),
        ("Implement VocabularyRepository CRUD + search",
         "Repository abstraction over Dexie: add, update, remove, get, list, search (word/sentence/note/tag), "
         "toggleFavorite, bulk import/export. No Dexie types leak to the UI.\n\n**Acceptance Criteria**\n"
         "- Full unit coverage with fake-indexeddb\n- Case-insensitive search\n- Deduplicates on identical word",
         1, "M2", ["storage"], 5),
        ("Implement SettingsRepository with defaults",
         "Persist settings (provider, apiKey, model, baseUrl, highlightColor, highlightEnabled) with sane "
         "defaults and partial updates.\n\n**Acceptance Criteria**\n- Returns defaults when empty\n"
         "- Partial update merges", 2, "M2", ["storage", "settings"], 2),

        ("EPIC: Word Capture",
         "Umbrella epic for saving a selection via context menu, popup button and keyboard shortcut.", 1, "M2",
         ["epic", "capture"], 8),
        ("Background service worker and message bus",
         "Typed message bus between content script, popup, options and the service worker; central command "
         "handlers.\n\n**Acceptance Criteria**\n- Typed request/response contract\n- Unknown messages rejected "
         "safely\n- Unit tested handlers", 1, "M2", ["capture"], 3),
        ("Context-menu capture of selected text",
         "Register a `contextMenus` entry on selection that saves the word plus surrounding sentence and URL.\n\n"
         "**Acceptance Criteria**\n- Menu only shows on selection\n- Sentence extracted from the content script\n"
         "- Duplicate save updates instead of inserting", 1, "M2", ["capture"], 3),
        ("Keyboard shortcut capture",
         "MV3 `commands` entry (Ctrl+Shift+S / Cmd+Shift+S) that saves the current selection.\n\n"
         "**Acceptance Criteria**\n- Declared in manifest\n- Works without the popup open\n"
         "- No-op with a friendly toast when nothing is selected", 2, "M2", ["capture"], 2),
        ("Popup save button for current selection",
         "Popup reads the active tab selection and offers a save form (word, note, tags).\n\n"
         "**Acceptance Criteria**\n- Prefills from selection\n- Validation on empty word\n- Optimistic UI", 2,
         "M2", ["capture", "library"], 3),

        ("EPIC: Vocabulary Library",
         "Umbrella epic for browsing, searching, editing, deleting, favouriting and tagging entries.", 1, "M3",
         ["epic", "library"], 8),
        ("Library list with search and filters",
         "Virtualised-friendly list with debounced search, favourite filter and tag filter.\n\n"
         "**Acceptance Criteria**\n- Debounced 250ms search\n- Empty and loading states\n- Keyboard navigable",
         1, "M3", ["library"], 5),
        ("Edit, delete and favourite entries",
         "Inline edit form, delete with confirmation, favourite toggle.\n\n**Acceptance Criteria**\n"
         "- Optimistic updates with rollback on error\n- Confirm before destructive delete\n- ARIA labels on all "
         "icon buttons", 1, "M3", ["library"], 3),
        ("Tag management",
         "Add/remove tags per entry and filter the library by tag.\n\n**Acceptance Criteria**\n"
         "- Tags normalised lowercase and de-duplicated\n- Tag chips removable by keyboard", 2, "M3",
         ["library"], 3),

        ("EPIC: On-page Highlighting",
         "Umbrella epic for highlighting saved vocabulary on every page with a hover card.", 1, "M3",
         ["epic", "highlight"], 8),
        ("Content script DOM scanner and highlighter",
         "Walk text nodes (skipping script/style/inputs/contenteditable), wrap matches in a highlight span, and "
         "observe mutations for dynamic pages.\n\n**Acceptance Criteria**\n- No layout shift\n"
         "- Word-boundary matching, case-insensitive\n- MutationObserver batched via requestIdleCallback\n"
         "- Never rewrites the same node twice", 1, "M3", ["highlight"], 5),
        ("Hover card with meaning, note and saved date",
         "Accessible hover/focus card showing meaning, note and created date, positioned within the viewport.\n\n"
         "**Acceptance Criteria**\n- Shows on hover and keyboard focus\n- `role=tooltip` + aria-describedby\n"
         "- Auto-flips near viewport edges", 1, "M3", ["highlight"], 3),
        ("Highlight colour and enable/disable respected live",
         "Content script reacts to settings changes without a page reload.\n\n**Acceptance Criteria**\n"
         "- Colour applied via CSS custom property\n- Disabling removes all highlights cleanly", 2, "M3",
         ["highlight", "settings"], 2),

        ("EPIC: AI Explain",
         "Umbrella epic for the multi-provider AI abstraction and the Explain feature.", 1, "M4", ["epic", "ai"], 8),
        ("Provider-agnostic AI client abstraction",
         "Define `AiProvider` interface (`explain(word, context) -> Explanation`) plus a registry and a shared "
         "prompt/response schema. No provider-specific code outside its adapter.\n\n**Acceptance Criteria**\n"
         "- Interface + registry unit tested\n- Errors normalised to `AiError`\n- Timeout and abort support", 1,
         "M4", ["ai"], 5),
        ("OpenAI-compatible adapters (OpenAI, OpenRouter, LM Studio, Ollama)",
         "Single chat-completions adapter parameterised by base URL/auth to cover the OpenAI-compatible "
         "providers.\n\n**Acceptance Criteria**\n- One adapter, four presets\n- Custom base URL supported\n"
         "- Tested with mocked fetch", 1, "M4", ["ai"], 3),
        ("Gemini and Anthropic adapters",
         "Native adapters for Google Gemini and Anthropic Messages APIs.\n\n**Acceptance Criteria**\n"
         "- Correct auth headers per provider\n- Responses mapped to the shared Explanation schema\n"
         "- Tested with mocked fetch", 1, "M4", ["ai"], 3),
        ("Explanation schema and rendering",
         "Explanation contains meaning, simpleExplanation, examples[], synonyms[], pronunciation and "
         "collocations[]; render it in popup and hover card, and cache it on the entry.\n\n"
         "**Acceptance Criteria**\n- Robust JSON parsing with fallback\n- Cached result reused, refresh available\n"
         "- Loading and error states", 1, "M4", ["ai", "library"], 5),

        ("EPIC: Settings, Import & Export",
         "Umbrella epic for the options page and data portability.", 2, "M4", ["epic", "settings"], 5),
        ("Options page for provider, key and appearance",
         "Options UI to pick provider/model/base URL, store the API key locally, set highlight colour and "
         "toggle highlighting.\n\n**Acceptance Criteria**\n- Key stored locally only, masked input\n"
         "- Connection test button\n- Labelled form controls", 1, "M4", ["settings"], 3),
        ("Export and import vocabulary as JSON",
         "Download all entries as versioned JSON and import with merge/replace strategy plus validation.\n\n"
         "**Acceptance Criteria**\n- Round-trip export→import is lossless\n- Invalid files rejected with a clear "
         "error\n- Schema version recorded", 2, "M4", ["settings", "storage"], 3),

        ("EPIC: Quality, E2E and Release",
         "Umbrella epic for end-to-end tests, accessibility, documentation and the production release.", 1, "M5",
         ["epic", "quality"], 8),
        ("Playwright E2E suite against the built extension",
         "Launch Chromium with the unpacked extension and cover: save a word, see it in the library, see it "
         "highlighted, edit and delete it.\n\n**Acceptance Criteria**\n- Runs against `dist/`\n"
         "- Deterministic, no arbitrary sleeps\n- `npm run test:e2e` green", 1, "M5", ["quality"], 5),
        ("Accessibility and responsive popup pass",
         "Audit keyboard traversal, focus rings, ARIA roles, contrast; make the popup responsive 320–420px.\n\n"
         "**Acceptance Criteria**\n- All interactive elements reachable by keyboard\n- No missing labels\n"
         "- Popup usable at 320px width", 2, "M5", ["quality"], 3),
        ("Documentation set",
         "Write and keep current: README, ARCHITECTURE, DECISIONS, CHANGELOG, ROADMAP, CONTRIBUTING.\n\n"
         "**Acceptance Criteria**\n- All six files present and accurate\n- README covers install-in-Chrome steps",
         2, "M5", ["docs"], 3),
        ("Production build and release candidate",
         "Verify the production build, zip the artefact and confirm a clean load in Chrome with zero console "
         "errors.\n\n**Acceptance Criteria**\n- `npm run build` clean\n- Zip artefact produced\n"
         "- No console errors in any surface", 1, "M5", ["quality"], 2),
    ]

    created = []
    epic_id = None
    for title, desc, prio, milestone, labs, est in issues:
        payload = dict(title=title, description=desc + dod(), priority=prio,
                       projectId=project["id"], projectMilestoneId=ms[milestone],
                       labelIds=[labels[l] for l in labs], estimate=est)
        if title.startswith("EPIC:"):
            epic_id = None
        elif epic_id:
            payload["parentId"] = epic_id
        issue = create_issue(**payload)
        if title.startswith("EPIC:"):
            epic_id = issue["id"]
        created.append((issue["identifier"], title))
        print(issue["identifier"], title)

    with open(os.path.join(os.path.dirname(__file__), "backlog.json"), "w") as f:
        json.dump({"project": project, "milestones": ms, "issues": created}, f, indent=2)
    print("total issues:", len(created))


if __name__ == "__main__":
    main()
