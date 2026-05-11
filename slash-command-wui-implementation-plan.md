# Slash Command WUI Implementation Plan

Plan for implementing the remaining Pi TUI slash-command behavior in `pi-remote-control` while reusing existing web UI pieces and translating Pi terminal UI concepts into web-native dialogs, panels, and actions.

## Current state

The WUI already has a useful foundation:

- `PromptComposer` routes any input beginning with `/` to `SessionDashboard.onSlashCommand` instead of sending it to Pi as a normal prompt.
- `SessionDashboard` currently implements:
  - `/model` and alias `/models` by opening `ModelPicker`
  - `/session` and alias `/info` as a notice
  - `/new` via the existing create-session flow
  - `/name <name>` via `renameSession`
  - `/quit` and alias `/close` via the delete/close affordance
  - `/help` and `/hotkeys` as a notice
- Several parity-oriented components already exist but are not yet wired into the dashboard:
  - `ConfigurationPanel`
  - `SessionTree`
  - `ProjectExplorer`
  - `ShortcutHelp`
  - `ModelPicker`
  - `ExtensionUiHost`
  - `MessageTimeline` / `ToolCard`
- `src/shared/protocol.ts` already defines many operations needed for parity, including `compact`, `get_commands`, `fork`, `clone`, `switch_session`, and `export_html`, but the HTTP API and adapter do not yet expose most of them.

## TUI commands to cover

Public built-ins from Pi TUI:

| Command | TUI behavior | Current WUI status | Target WUI behavior |
| --- | --- | --- | --- |
| `/settings` | Open settings selector | Suggested but not implemented | Open configuration/settings modal or side panel |
| `/model [query]` | Open model selector, optionally prefiltered | Partially implemented | Reuse `ModelPicker`, support query prefill |
| `/scoped-models` | Enable/disable models for cycling | Not implemented | Model-scope multi-select modal inside config |
| `/export [path]` | Export HTML by default, JSONL by extension | Not implemented | Export dialog with default path and download/open result |
| `/import <path>` | Import JSONL and resume | Not implemented | Import dialog with path picker/text field and session activation |
| `/share` | Export/share as secret GitHub gist | Not implemented | Either explicit non-goal or guarded share dialog |
| `/copy` | Copy last assistant message | Not implemented | Clipboard action with toast |
| `/name <name>` | Set session display name | Implemented | Keep; also add input dialog for bare `/name` |
| `/session` | Show session info/stats | Minimal notice | Rich session info modal using stats |
| `/changelog` | Show changelog entries | Not implemented | Markdown modal showing Pi/package changelog |
| `/hotkeys` | Show all keyboard shortcuts | Minimal notice + `?` dialog | Open `ShortcutHelp` programmatically or unify help modal |
| `/fork` | Select previous user message and fork to new file | Not implemented | Fork-message picker using `SessionTree`/selector |
| `/clone` | Duplicate current active branch into new session | Not implemented | Confirmation + adapter clone op + activate new session |
| `/tree` | Navigate current session tree | Suggested but not implemented | Open `SessionTree` modal backed by server tree API |
| `/login` | Configure provider auth | Not implemented | Auth modal using config panel/auth flow |
| `/logout` | Remove provider auth | Not implemented | Auth modal or provider selector + confirmation |
| `/new` | Start fresh session | Implemented as create session | Keep; confirm if current active session is streaming |
| `/compact [instructions]` | Manual compaction | Suggested but not implemented | Compact dialog/action with progress, custom instructions |
| `/resume` | Browse/select saved sessions | Not implemented as slash command | Open session picker and activate selected session |
| `/reload` | Reload keybindings/extensions/skills/prompts/themes | Not implemented | Resource reload action with diagnostics |
| `/quit` | Quit app | WUI close/delete analog | Clarify semantics: close/dispose session vs disconnect |

Hidden/debug TUI commands (`/debug`, `/arminsayshi`, `/dementedelves`) should remain out of WUI parity unless explicitly needed for development.

Dynamic commands also need support:

- Prompt template commands loaded from `.pi/prompts` / user prompts
- Extension commands registered by `pi.registerCommand`
- Skill commands such as `/skill:<name>` when enabled

These should be discovered through `get_commands` and executed through the normal Pi prompt path, not hardcoded as WUI built-ins.

## Key design principle: translate, do not embed, TUI components

Pi TUI components are terminal components: they render fixed-width ANSI lines and handle raw key input. The WUI should not try to mount those components directly in the browser. Instead, translate their interaction patterns into reusable React components:

| TUI pattern/component | Web translation | Candidate existing/reusable WUI component |
| --- | --- | --- |
| `SelectList` / selector dialogs | Searchable list modal with keyboard + touch support | New `SearchableSelectDialog`; reuse `ModelPicker` patterns |
| `SettingsList` | Settings/config side panel with toggles/selects | `ConfigurationPanel`, expanded and integrated |
| `BorderedLoader` | Blocking/non-blocking progress modal or toast with abort | New `ProgressDialog` / existing notices |
| `LoginDialog` / `OAuthSelector` | Auth provider modal + API key/OAuth states | `ConfigurationPanel` auth section |
| `ModelSelectorComponent` | Searchable model modal | `ModelPicker` |
| `ScopedModelsSelectorComponent` | Multi-select model modal | Extend `ModelPicker` or new `ScopedModelsDialog` |
| `SessionSelectorComponent` | Session resume picker | Existing session sidebar + new `ResumeSessionDialog` |
| `TreeSelectorComponent` | Branch tree modal/side panel | `SessionTree` |
| `UserMessageSelectorComponent` | Fork-from-message picker | Reuse `SearchableSelectDialog` or `SessionTree` filtered to user entries |
| `Markdown` | Markdown modal/document viewer | New `MarkdownDialog` |
| `ctx.ui.confirm/input/editor/select` | Generic extension/WUI dialogs | `ExtensionUiHost` plus shared dialog primitives |

The reusable target is a small WUI dialog toolkit rather than one-off command UIs.

## Architecture changes

### 1. Replace the hardcoded slash switch with a command registry

Create a browser-side command registry, for example:

```text
src/web/commands/
  slash-command-registry.ts
  builtin-slash-commands.ts
  slash-command-types.ts
```

Suggested types:

```ts
interface SlashCommandDefinition {
  name: string;
  aliases?: readonly string[];
  description: string;
  source: "wui-built-in" | "pi-built-in" | "extension" | "prompt" | "skill";
  argumentHint?: string;
  available?: (ctx: CommandContext) => boolean;
  run: (ctx: CommandContext, argv: string) => Promise<void> | void;
}
```

Goals:

- Centralize command metadata for autocomplete, `/help`, and dispatch.
- Keep WUI built-ins separate from dynamic Pi commands.
- Allow commands to open modals, call APIs, set notices, or pass through to Pi.
- Make `/help` render from the registry instead of a hardcoded string.

### 2. Expand the WUI API surface

Extend `SessionDashboardApi` and `HttpSessionDashboardApi` with focused methods instead of routing everything through `prompt`:

```ts
compact(sessionId, customInstructions?)
exportSession(sessionId, outputPath?, format?)
importSession(path, cwd?)
getSessionStats(sessionId)
getLastAssistantText(sessionId)
getCommands(sessionId)
getSessionTree(sessionId)
navigateTree(sessionId, entryId, options)
forkSession(sessionId, entryId)
cloneSession(sessionId)
resumeSession(sessionFile)
reloadResources(sessionId?)
listAuthProviders()
loginProvider(provider, options)
logoutProvider(provider)
listSettings()
updateSetting(key, value)
listScopedModels(sessionId)
setScopedModels(sessionId, models)
```

Keep path-sensitive operations behind server-side allowlists:

- Import/export paths must pass explicit policy checks.
- Session files must stay under allowed session roots.
- Project/cwd operations must stay under allowed project roots.
- Sharing must be opt-in and should clearly disclose what leaves the machine.

### 3. Extend the Pi adapter boundary

`PiSessionHandle` currently covers only state, messages, prompting, abort, naming, and model selection. Add capabilities in small groups:

```ts
interface PiSessionHandle {
  compact(customInstructions?: string): Promise<CompactionResult>;
  exportHtml(outputPath?: string): Promise<{ path: string }>;
  getLastAssistantText(): Promise<string | null>;
  getStats(): Promise<SessionStatsDetail>;
  getCommands(): Promise<readonly SlashCommandInfo[]>;
  getTree(): Promise<SessionTreeData>;
  navigateTree(entryId: string, options: NavigateTreeOptions): Promise<NavigateTreeResult>;
  fork(entryId: string): Promise<ForkResult>;
  clone(): Promise<CloneResult>;
  reloadResources(): Promise<ResourceReloadResult>;
}
```

For `SdkPiAdapter`, many of these map directly to SDK/RPC concepts:

- `session.compact(customInstructions)` for `/compact`
- `session.exportToHtml` or exported session utilities for `/export`
- `session.messages` for `/copy` and stats
- `pi.getCommands()` / RPC `get_commands` equivalent for dynamic commands
- `AgentSessionRuntime` for replacement flows: `/new`, `/resume`, `/fork`, `/clone`, `/import`
- `session.navigateTree(...)` and `SessionManager.getTree()` for `/tree`
- `SettingsManager`, `AuthStorage`, `ModelRegistry`, and `DefaultResourceLoader.reload()` for settings/auth/reload

Important adapter decision:

- The current WUI is multi-session, while Pi TUI has one active runtime that gets replaced for `/new`, `/resume`, `/fork`, `/clone`, and `/import`.
- For simple WUI behavior, these commands can create/open/activate sessions in the dashboard.
- For exact extension lifecycle behavior, use `createAgentSessionRuntime()` and preserve the same lifecycle events Pi TUI emits. This is especially important for extension hooks like `session_before_switch`, `session_before_fork`, and `session_shutdown`.

Recommended approach:

1. Implement non-replacement commands with the existing per-session handle.
2. Introduce a runtime-aware adapter for tree/fork/clone/import/resume once the simpler commands are stable.
3. Keep the mock adapter feature-complete enough for unit/e2e tests.

### 4. Prefer WebSocket/RPC-compatible operation names

`src/shared/protocol.ts` already models a richer Pi-like protocol than the current HTTP API. Avoid inventing incompatible names. The HTTP endpoints can be REST-shaped, but internally they should map to the same operation names:

- `compact`
- `get_commands`
- `fork`
- `clone`
- `get_fork_messages`
- `switch_session`
- `export_html`
- `set_thinking_level`
- `cycle_thinking_level`

This makes it easier to move the browser from HTTP+SSE to WebSocket later.

## Command-by-command implementation notes

### `/settings`

Reuse:

- `ConfigurationPanel`
- `ModelPicker` for model sub-flow
- `ShortcutHelp`/hotkey data

Needed:

- Integrate `ConfigurationPanel` into `SessionDashboard` as a modal/side sheet.
- Add server endpoints for settings read/update.
- Add resource diagnostics and theme lists from Pi resource loader/settings manager.
- Split the current all-in-one `ConfigurationPanel` into tabs if it becomes too large: Auth, Models, Tools, Settings, Resources, Packages, Themes.

First cut:

- Open configuration panel with currently mocked/static data replaced by real models and basic settings.
- Make unsafe package management controls read-only or hidden until package security work is done.

### `/model [query]`

Reuse:

- `ModelPicker`

Needed:

- Add optional initial search query prop to `ModelPicker`.
- Parse `/model sonnet` and prefill search with `sonnet`.
- Show unavailable models with reasons if `ModelRegistry` can expose them.
- Update active session state after selection.

### `/scoped-models`

Reuse:

- `ModelPicker` filtering/search UI
- `ConfigurationPanel` model section

Needed:

- Multi-select model dialog.
- Server support for enabled/scoped model list.
- Persist to Pi settings where appropriate.
- Clarify WUI equivalent of TUI model cycling if cycling shortcuts are added later.

### `/compact [instructions]`

Reuse:

- Notice/progress UI
- `MessageTimeline` support for compaction summary events

Needed:

- Add adapter `compact` method.
- Add `/api/sessions/:id/compact`.
- Show a confirmation or editor dialog when no inline instructions are supplied.
- Show progress while compacting; support abort if SDK exposes abort compaction.
- Refresh messages/state after completion.

First cut:

- `/compact` opens a small dialog with optional custom instructions.
- `/compact focus on files` starts immediately with those instructions.

### `/session`

Reuse:

- Existing session card data
- `RemoteStatusPanel` patterns if useful

Needed:

- Server `get_session_stats` endpoint.
- Modal showing session file, cwd, id, name, model, message counts, token usage, cost, context usage, hot/cold status.
- Copy buttons for session ID/file path.

### `/copy`

Reuse:

- Browser clipboard API
- Existing notice/toast

Needed:

- API method `getLastAssistantText(sessionId)` or compute from loaded messages.
- Use `navigator.clipboard.writeText` with fallback to selection/download.
- Notice on success/failure.

This is a good early command because it is mostly client-side.

### `/hotkeys` and `/help`

Reuse:

- `ShortcutHelp`
- New command registry metadata

Needed:

- Let `ShortcutHelp` be opened programmatically, not only with `?`.
- `/help` should show a command palette/help dialog generated from the registry plus dynamic `get_commands` results.
- `/hotkeys` should show keyboard shortcuts; `/help` should show commands and shortcuts.

### `/changelog`

Reuse:

- New `MarkdownDialog`

Needed:

- Server endpoint to expose Pi changelog and app version/changelog.
- Render markdown safely. Avoid raw HTML unless sanitized.

First cut:

- Display `node_modules/@earendil-works/pi-coding-agent/CHANGELOG.md` text through a server endpoint.

### `/tree`

Reuse:

- `SessionTree`

Needed:

- Adapter support for `SessionManager.getTree()`, labels, current leaf, and tree navigation.
- API methods:
  - `getSessionTree(sessionId)`
  - `navigateTree(sessionId, entryId, { summary, customInstructions, label })`
  - `setTreeLabel(sessionId, entryId, label?)`
- Convert Pi session entries to `SessionTreeEntry`.
- Show branch-summary choices using existing `SessionTree` controls.
- After navigating to a user/custom message, prefill `PromptComposer` with restored text.

Implementation detail:

- The existing `SessionTree` component already models filters, labels, fork, clone, navigation, and custom summary instructions. Start by wiring it into a modal and backing it with mock adapter data.

### `/fork`

Reuse:

- `SessionTree` filtered to user entries, or a new `SearchableSelectDialog`
- Existing session activation/list refresh logic

Needed:

- API `getForkMessages(sessionId)`.
- API `forkSession(sessionId, entryId)`.
- Activate the created fork session and prefill the selected user message if Pi returns it.
- Respect extension cancellation when runtime-aware adapter exists.

### `/clone`

Reuse:

- Confirmation dialog
- Existing create/open session UI patterns

Needed:

- API `cloneSession(sessionId)`.
- Activate new cloned session.
- Show cancellation/error states.

### `/resume`

Reuse:

- Existing session sidebar search/sort/filter behavior
- New `ResumeSessionDialog` extracted from sidebar logic if needed

Needed:

- Slash command opens a session picker focused on the current project/session root.
- Selecting a session calls existing open/cold-session path or new `switch_session` operation.
- Decide whether `/resume` means “activate in dashboard” or “replace the active Pi runtime.” For WUI multi-session, activation is acceptable for first cut; for exact Pi lifecycle, use runtime switch.

### `/new`

Reuse:

- Existing create session dialog

Needed:

- If active session is streaming, warn or queue action.
- Optionally copy current cwd as default.
- If runtime-aware adapter is adopted, expose Pi `new_session` semantics as distinct from dashboard “create a brand-new independent session.”

### `/export [path]`

Reuse:

- New `ExportDialog`
- Browser download link

Needed:

- API `exportSession(sessionId, outputPath?, format?)`.
- HTML default. Consider JSONL once adapter can export raw session file safely.
- If no path supplied, server can create a file under a configured export directory and return a path/URL.
- Browser download endpoint should stream the generated file.

Security:

- Do not let browser write arbitrary host paths by default.
- Prefer a configured export root or generated temp file.

### `/import <path>`

Reuse:

- New `ImportDialog`
- Existing session activation

Needed:

- Server path policy for import file.
- Adapter/runtime support for `importFromJsonl`.
- Error UI for invalid/missing JSONL.
- After import, list/activate imported session.

First cut:

- Text path field only. Browser file upload can come later if useful.

### `/share`

Needed decision:

- Either declare explicit non-goal for private self-hosted WUI, or implement behind a clear opt-in setting.

If implemented:

- Confirmation dialog describing exactly what will be uploaded.
- GitHub token/auth state checks.
- Server endpoint wrapping Pi share/export behavior.
- Audit log entry.

Recommendation:

- Mark as deferred/non-goal until local parity is complete.

### `/login` and `/logout`

Reuse:

- `ConfigurationPanel` auth section
- `ExtensionUiHost` dialog primitives if OAuth/API key flows use extension UI requests

Needed:

- Server provider auth inventory from `ModelRegistry`/`AuthStorage`.
- API key save/remove operations.
- OAuth initiation and callback/code flow. If Pi SDK exposes provider OAuth callbacks, translate those to web dialogs.
- Warnings for subscription/extra-usage auth.

First cut:

- `/login` opens Configuration/Auth tab.
- `/logout` opens provider selector + confirmation.
- API-key based providers first; OAuth second.

### `/reload`

Reuse:

- `ConfigurationPanel` resource diagnostics section

Needed:

- Adapter/resource-loader reload method.
- API `reloadResources(sessionId?)` returning diagnostics for extensions, skills, prompts, themes, context files.
- Refresh command suggestions after reload by calling `get_commands`.
- Refresh theme/settings/model data.

### Dynamic extension/prompt/skill commands

Reuse:

- Existing `PromptComposer` slash routing
- `ExtensionUiHost` for extension UI requests

Needed:

- Add `getCommands(sessionId)` to API.
- Merge built-in WUI commands and dynamic commands for autocomplete.
- If a slash command is not a WUI built-in but exists in dynamic commands, pass it through to `api.prompt(sessionId, originalText)` so Pi expands/executes it.
- If a slash command is neither built-in nor dynamic, show an unknown-command message with a suggestion to send as plain text.

Important:

- Pi docs say built-in interactive commands are not included in `get_commands`; WUI must keep its own built-in registry.
- Dynamic extension commands can trigger UI requests. Ensure `ExtensionUiHost` is connected to the active session event stream before enabling this broadly.

## Reusable WUI components to create or extract

### `DialogShell`

Shared modal shell with:

- title
- close button
- mobile-friendly layout
- escape/click-outside handling
- focus trap
- optional footer actions

Use for model picker, settings, tree, export/import, compact, session info, command help.

### `SearchableSelectDialog`

Web translation of TUI `SelectList`:

- query field
- keyboard navigation
- touch-friendly rows
- optional descriptions/badges
- empty state
- async loading/error state

Use for `/resume`, `/fork`, `/login` provider choice, `/logout` provider choice, command palette/help.

### `ConfirmDialog`, `InputDialog`, `EditorDialog`

Shared with `ExtensionUiHost` if possible.

Use for:

- `/compact` instructions
- `/name` bare invocation
- `/clone` confirmation
- `/share` confirmation
- `/import` path
- extension UI requests

### `MarkdownDialog`

Use for:

- `/changelog`
- export preview/help
- rich command docs

### `ProgressDialog` / operation toast

Use for:

- compaction
- export/import
- reload
- share
- OAuth waiting states

Should support cancellation when backend supports it.

## Suggested implementation phases

### Phase 1 — Command registry and low-risk commands

Deliverables:

- Add browser command registry and replace `SessionDashboard` switch.
- Add command metadata-driven autocomplete/help.
- Implement or improve:
  - `/copy`
  - `/help`
  - `/hotkeys`
  - `/model [query]`
  - `/session` rich modal using current state, with stats added if easy
  - `/settings` opens integrated `ConfigurationPanel` with available current data
- Add dynamic `get_commands` mock shape but do not require real SDK support yet.

Tests:

- Unit tests for command parsing/registry dispatch.
- `SessionDashboard` tests for each command opening the correct modal/action.
- Accessibility checks via Testing Library roles.

### Phase 2 — Adapter/API parity for session-local operations

Deliverables:

- Extend `PiSessionHandle`, `SessionRegistry`, HTTP API, and mock adapter.
- Implement:
  - `/compact`
  - `/export`
  - `/changelog`
  - `/reload` resource refresh skeleton
  - dynamic prompt/template/skill command pass-through
- Show compaction/reload/export progress and errors.

Tests:

- Mock adapter tests for new methods.
- HTTP API tests for success, invalid path, unknown session.
- UI tests for progress/error states.

### Phase 3 — Tree, fork, clone, resume

Deliverables:

- Wire `SessionTree` into a modal.
- Add tree APIs and mock data.
- Implement:
  - `/tree`
  - `/fork`
  - `/clone`
  - `/resume`
- Decide and document WUI semantics for activation vs true runtime replacement.

Tests:

- Unit tests for tree data conversion.
- UI tests for filtering, selecting, summary options, labels, fork/clone.
- E2E mock-session flow: create session, send prompts, fork/clone/resume.

### Phase 4 — Auth/settings/scoped models

Deliverables:

- Auth provider inventory.
- API-key login/logout.
- OAuth flow if practical.
- Scoped models multi-select.
- Real settings read/update for high-value settings.
- Resource diagnostics surfaced in ConfigurationPanel.

Tests:

- Auth path tests with fake providers.
- Settings persistence tests using temp agent/project dirs.
- Missing credentials/unavailable model UI tests.

### Phase 5 — Import/share/package-adjacent workflows

Deliverables:

- `/import` JSONL with path policy.
- `/share` either implemented behind explicit opt-in or documented as non-goal.
- Package/resource management decisions moved from ConfigurationPanel placeholder to real secure implementation or hidden.

Tests:

- Import valid/invalid JSONL.
- Path traversal denial.
- Share disabled-by-default behavior.

## Server/API route sketch

Keep existing routes, then add:

```text
GET  /api/sessions/:id/stats
GET  /api/sessions/:id/last-assistant-text
GET  /api/sessions/:id/commands
POST /api/sessions/:id/compact
POST /api/sessions/:id/export
GET  /api/sessions/:id/tree
POST /api/sessions/:id/tree/navigate
POST /api/sessions/:id/tree/label
GET  /api/sessions/:id/fork-messages
POST /api/sessions/:id/fork
POST /api/sessions/:id/clone
POST /api/sessions/switch
POST /api/sessions/import
GET  /api/config
POST /api/config/settings
POST /api/config/reload
GET  /api/auth/providers
POST /api/auth/login
POST /api/auth/logout
GET  /api/changelog
```

Long term, consider moving these to the existing WebSocket protocol once the WUI is ready for full-duplex command handling.

## Testing strategy

- Keep the mock adapter deterministic and feature-complete for every new command.
- Unit-test command registry independently from React.
- Unit-test each dialog component independently.
- Add dashboard integration tests for slash-command entry points.
- Add server tests for path policies and session lifecycle operations.
- Add Playwright smoke tests for mobile-sized viewport command flows.
- Do not require real LLM/API credentials for default tests.

## Security and product guardrails

- Browser must never request arbitrary host paths without server policy approval.
- Import/export/share need explicit UI warnings and safe defaults.
- Package install/remove should remain hidden or disabled until trust model is designed.
- Auth changes should distinguish environment credentials from stored credentials.
- Share/upload must be opt-in and audit-friendly.
- Commands that mutate sessions (`/compact`, `/tree`, `/fork`, `/clone`, `/import`, `/new`, `/resume`) should confirm when risk is high or when active work is streaming.
- Every keyboard shortcut should have a visible touch equivalent.

## Open questions

1. Should `/quit` delete/dispose the active session, close the browser connection, or stop the server? Current WUI behavior maps it to close/delete; this should be renamed or clarified.
2. Should `/resume`, `/new`, `/fork`, `/clone`, and `/import` use exact Pi runtime replacement semantics or WUI multi-session activation semantics?
3. Should `/share` be supported at all in a private Tailscale-first app?
4. Should `/export` allow arbitrary output paths, or only download/generated export locations?
5. Should the WUI eventually consume Pi RPC mode directly instead of maintaining an SDK adapter?
6. How much of package management belongs in this WUI, given the security implications of installing executable extensions remotely?

## Recommended first PR

A small first PR should avoid SDK/runtime complexity:

1. Add `src/web/commands/` with a command registry.
2. Replace the `handleSlashCommand` switch with registry dispatch.
3. Add `DialogShell`, `SearchableSelectDialog`, and a command help dialog.
4. Improve `/model [query]` and `/help`.
5. Implement `/copy` using loaded messages or a simple API method.
6. Wire `/settings` to open `ConfigurationPanel` with available current data, even if some sections are read-only.

This creates the reusable web-native command surface that the harder adapter-backed commands can plug into later.
