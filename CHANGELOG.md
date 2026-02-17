# Changelog

All notable changes to this project will be documented in this file.

## 0.6.1 (2026-02-18)

### Bug Fixes

- **Step count text wrapping** — Fixed step count ("N steps") wrapping to two lines in the AgentActivityStats bar by adding `whitespace-nowrap` (#45)
- **Shared duration formatter** — Extracted `formatDuration(seconds)` utility that formats durations as `45s`, `2m 15s`, or `1h 5m`, replacing inline formatting across 3 components (#45)

### Maintenance

- **Dependency updates** — Bumped `@anthropic-ai/claude-agent-sdk` 0.2.39→0.2.42, `lucide-react` 0.563.0→0.564.0, `tailwind-merge` 3.4.0→3.4.1, `typescript-eslint` 8.55.0→8.56.0, `electron` 40.4.0→40.4.1, `jsdom` 28.0.0→28.1.0, `wait-on` 9.0.3→9.0.4 (#46)

## 0.6.0 (2026-02-17)

### New Features

- **Project persistence and switching** — Last opened project is auto-restored on app startup using `electron-store` (zero backend changes — `recentProjects` key was already whitelisted). WelcomeView shows a recent projects list with relative timestamps and remove buttons for quick reconnection. TopBar displays the active project name with a switch button that shows a confirmation dialog when validations or reviews are in progress. All downstream stores (issues, reviews, validations) are cleared on project switch (#41)

## 0.5.0 (2026-02-14)

### New Features

- **Multi-agent review pipeline (Experimental)** — New review mode that delegates to 4 specialized sub-agents (Context/haiku, Code Quality, Code Patterns, Security & Performance) running in parallel via the Claude Agent SDK's native sub-agent support. An orchestrator aggregates findings with weighted scoring, deduplication, and TypeScript validation. Includes a Review Mode toggle in settings, sub-agent score breakdown in ReviewSummary, and agent attribution badges on FindingCard. Marked as experimental — not fully tested and may produce inconsistent results (#34)
- **Improved issue validation formatting** — Extracted formatting logic into dedicated `validationFormatter.ts` utility, added verdict-appropriate alert headers (`[!TIP]`/`[!WARNING]`/`[!CAUTION]`), compact metadata tables, confidence bars, complexity emoji, and collapsible language-hinted code evidence blocks (#35)

### Bug Fixes

- **PR reviews stuck in Pending state** — Fixed two bugs causing reviews to be created in PENDING (draft) state on GitHub: `listPrReviews` was accidentally POSTing instead of GETing (creating empty pending reviews on every check), and `spawnGhApiWithStdin` was missing `Content-Type: application/json` header causing GitHub to ignore the event field. Added defensive response state validation (#39, #36)
- **Sub-agent security hardening** — Removed Bash from sub-agent tools to prevent prompt injection via arbitrary command execution, added `<user-content>` delimiters to all review prompts, and capped turn budgets at `MAX_ALLOWED_TURNS` (#34)
- **Runtime validation for AI output** — Added type guards, `Array.isArray` checks, and finite number validation to both single-agent and multi-agent review result parsing instead of blind `as` casts (#34)
- **Concurrent abort controller** — Added `acquireAbortController()` guard to prevent concurrent review operations from sharing the same AbortController instance (#34)
- **Single-agent max turns cap** — Capped `explicitMaxTurns` with `MAX_ALLOWED_TURNS` in the review method for defense-in-depth (#34)
- **Review module cleanup** — Moved `reviewMode` decision to provider layer via `reviewAuto()` method, removing `SettingsModule` from `ReviewModule` to match `ValidationModule` pattern (#34)

### Refactoring

- **Extracted shared helpers** — Extracted `processAgentMessages`/`extractStructuredOutput` helpers and `BASE_FINDING_ITEM_SCHEMA` constant, eliminating ~120 lines of duplication between single-agent and multi-agent review paths (#34)
- **Agent display constants** — Extracted shared agent display constants to `agent-display.ts` for consistent UI rendering (#34)

### Maintenance

- **Debug logging in dev mode** — Enabled `LOG_LEVEL=debug` by default in development mode for easier debugging of the review flow

### Testing

- 31 new tests — 22 for multi-agent review pipeline, 9 for PR review push fixes

## 0.4.0 (2026-02-14)

### New Features

- **PR re-review with review chains** — Re-review a PR with full context from the previous review. The AI receives the prior findings, score, and incremental diff (commit-to-commit) to fairly assess whether issues were addressed. Results include chain metadata: `reviewSequence`, `previousScore`, `isReReview`, and `addressedFindings` with per-finding status (addressed / partially-addressed / unaddressed / new-issue). UI shows a sequence indicator ("Review #N"), previous score comparison, and a "Previous Findings Status" section with 8-status breakdown (#28, #30)
- **Re-review chaining from history** — Clicking "Re-review" on a completed review automatically chains from the latest history entry for that PR and repository, skipping the discard confirmation dialog. Falls back to a fresh review with confirmation if no history exists (#30)
- **Cross-PC review detection** — When switching machines, GitChorus now auto-detects previously posted reviews on GitHub by searching for the `<!-- gitchorus-review -->` marker, parsing quality score and verdict, and importing them to local history so re-reviews can chain from them (#33)
- **Improved PR review formatting** — GitHub review comments now use severity-based alert syntax (`[!CAUTION]`, `[!WARNING]`, etc.), language-hinted code blocks for syntax highlighting, and a compact summary table with severity-sorted findings. Inline comments are posted on the exact diff line for reliable positioning (#32)

### Refactoring

- **BaseLogService extraction** — Extracted shared `BaseLogService` abstract class from `ValidationLogService` and `ReviewLogService`, eliminating ~60 lines of duplicated JSONL file logging, rotation, and retention logic (#27)

### Bug Fixes

- **Review stuck at StructuredOutput** — Added missing `break` after capturing the result message in the Claude Agent SDK `for await` loop, preventing the UI from hanging while waiting for the subprocess to fully terminate (#33)
- **Duplicate getById() call** — Eliminated redundant `historyService.getById()` call in review result enrichment by hoisting `previousEntry` to a `let` variable and reusing it (#30)
- **Stale reReviewContext** — Fixed orphaned map entries when `queueReReview` was called for an already-queued PR by adding an early return guard (#30)
- **Cross-repo history collision** — History entry lookup in `ReviewView` now filters by `repositoryFullName` to prevent chaining from the wrong repository's review (#30)
- **Inconsistent re-review metadata** — When a previous review entry is deleted between queue and completion, the result is now correctly treated as an initial review instead of being marked `isReReview` with missing sequence data (#30)
- **SHA validation for git diff** — Added hex-character regex validation on commit SHAs before passing to `git diff` for defense-in-depth (#30)
- **Array.reverse() mutation** — Changed `entries.reverse()` to `[...entries].reverse()` in `getReviewChain` to avoid in-place mutation (#30)

### Maintenance

- **Community health files** — Added CODE_OF_CONDUCT.md, CONTRIBUTING.md, SECURITY.md, and switched to MIT license (#31)

### Testing

- 81 new unit tests for the review module: `ReviewService` (14), `ReviewGateway` (33), `ReviewHistoryService` (19), `ReviewView` (5), `GithubService` (6), SHA validation (4) — total test count: 510

## 0.3.0 (2026-02-13)

### New Features

- **Dynamic port allocation** — NestJS backend now uses `listen(0)` for OS-assigned ports, eliminating port conflicts when running multiple Electron instances. Port flows through CSP headers, CORS config, and IPC to the renderer's lazy-initialized socket (#24)
- **Unified detail views with agent activity hero** — Issue and PR detail views share a single layout with an animated hero section showing real-time agent activity, streaming steps, and progress visualization (#23)
- **Husky pre-commit hook** — Added missing `.husky/pre-commit` that triggers `lint-staged` on commits (eslint --fix + prettier --write on staged files) and `.editorconfig` for editor-level formatting defaults (#26)

### Bug Fixes

- **Agent max_turns error handling** — Detect when Claude agent hits the turn limit and surface a user-friendly error with model-aware turn limits instead of a generic failure (#25)
- **CSS custom properties typing** — Use `as` instead of `satisfies` for CSS custom property objects to fix TypeScript compilation errors (#23)
- **Agent hero when queued** — Show the agent activity hero immediately when status is queued and steps start arriving, instead of waiting for a running status (#23)

## 0.2.0 (2026-02-12)

### Bug Fixes

- **Critical: Incorrect model IDs** — Opus and Haiku model IDs were wrong, causing API calls to fail. Corrected to `claude-opus-4-6` and `claude-haiku-4-5-20251001` with migration logic for persisted settings (#19)
- **Dark theme syntax highlighting** — Code blocks used light theme colors on dark themes because `applyThemeToDOM()` only added the theme name class (e.g., `dracula`) but not the `dark` class required by Shiki CSS and Tailwind `dark:` variants. Now correctly toggles `dark` class based on `isDark` metadata (#20)
- **Error messages hidden at bottom** — Validation and review error alerts were rendered below progress steps and results, requiring users to scroll to see them. Moved error alerts to the top of the scrollable content area in both `ValidationPanel` and `ReviewView` (#21)

### New Features

- **Splash screen** — Branded splash screen shown during app initialization with smooth fade-out transition, replacing the blank white flash on startup (#14)
- **Confirmation dialog for Re-review/Re-validate** — Prevents accidental loss of existing analysis results by showing an AlertDialog when users click Re-review or Re-validate. Retry (error) and Run Again (cancelled) skip the dialog since there are no results to discard. Includes a reusable `ConfirmDialog` shared component (#22)
- **Review depth configuration** — Increased review depth settings range for more granular control over AI analysis thoroughness

### Testing

- 39 frontend unit tests (up from 0) covering dark theme toggling, error message positioning, and confirmation dialog behavior

## 0.1.3 (2026-02-12)

### Performance

- **Vite manual chunks** — Split recharts (479KB), markdown ecosystem (342KB), and socket.io into separate chunks, reducing main bundle from 1,274KB to 332KB (#11)
- **List virtualization** — Added `@tanstack/react-virtual` to IssueListView and PRListView with dynamic measurement, reducing DOM nodes for large lists (#11)
- **Lazy load QualityChart** — Dashboard's recharts-heavy chart is now code-split via `React.lazy` with skeleton fallback (#11)
- **Lazy load SettingsModal** — Only mounted when settings are open, removed from initial bundle (#12)
- **Lazy load GithubPushPreview** — Only mounted when push modal is open (#12)

### Bug Fixes

- **Loading UX flash** — Fixed empty state ("No issues" / "No pull requests") briefly appearing when switching tabs before data loads. Root cause: `setError(null)` was resetting loading state before the async fetch completed (#12)
- **Suspense fallback blanks** — Added proper fallback overlays with Loader2 spinners for all lazy-loaded components (#11, #12)

### UI Improvements

- **Refresh button spinners** — Refresh buttons now swap between `RefreshCw` (idle) and spinning `Loader2` (loading) for clearer visual feedback (#12)

## 0.1.2 (2026-02-12)

### Bug Fixes

- **Claude Agent SDK asar packaging** — SDK's `cli.js`, WASM files, and ripgrep binaries are now extracted from the asar archive via `asarUnpack` so they can be executed by `spawn()` in production builds (#10)
- **Production CLI path resolution** — Added `pathToClaudeCodeExecutable` option pointing to the unpacked `cli.js` path when `app.isPackaged` is true, fixing `MODULE_NOT_FOUND` errors in packaged Electron app (#10)
- **CLI path caching & validation** — Cached the resolved CLI path (computed once at runtime) and added `fs.existsSync` check with error logging for clearer diagnostics if the file is missing (#10)

## 0.1.1 (2026-02-12)

### Bug Fixes

- **Stderr capture for Claude SDK** — Added `stderr` callback to both `validate()` and `review()` methods; on failure the last 20 stderr lines are appended to the error message so the root cause surfaces (#8)
- **SDK assistant error handling** — Detect `SDKAssistantMessage.error` field (`authentication_failed`, `billing_error`, `rate_limit`, etc.) and throw user-friendly error messages immediately (#8)
- **E2E smoke test fix** — `data-testid="app-ready"` was never rendered by any component; added to `App.tsx` root div gated on WebSocket connection status (#8)
- **Error message mutation** — Create new Error instances instead of mutating `error.message` to avoid breaking upstream error handling (#8)

### New Features

- **Review log service** — JSONL file logging for PR reviews (mirrors `ValidationLogService`) with daily rotation and 7-day retention (#8)
- **`review:log-entries` WebSocket event** — Retrieve recent review log entries via socket for debugging (#8)

### Maintenance

- **Bump dependencies** — Updated CI actions, desktop, and web dependencies (#7)
- **Prettier formatting** — Fixed formatting inconsistencies and removed stale `WorktreeService` from integration tests

## 0.1.0 (2026-02-12)

Initial release of GitChorus — AI-powered code review and issue validation for GitHub repositories.

### Features

- **Repository Connection** — Open a local git repository via folder picker, auto-detect GitHub remote (owner/repo)
- **Issue Validation** — List open issues from connected GitHub repo, trigger AI-powered validation that reads the codebase to confirm bugs, identify affected files, estimate complexity, and suggest approach
- **PR Code Review** — List open PRs, trigger AI review analyzing changes for security, quality, logic, and codebase-fit issues with severity-grouped findings and code evidence
- **Streaming Progress** — Real-time streaming progress during AI analysis with SDK message parsing, step-by-step logs, and collapsible sections
- **GitHub Push (Issues)** — Push validation summaries to GitHub as issue comments with preview modal, section-level editing, and Edit/Preview tabs
- **GitHub Push (PRs)** — Push review findings as proper GitHub PR reviews with inline comments on specific files/lines
- **Validation History** — Locally persisted validation results with staleness detection and re-run prompt
- **Review History** — Locally persisted review results that survive app restarts, auto-hydrated on repository connect
- **Dashboard** — Project overview with stats cards, quality score trend chart (recharts), and clickable activity feed
- **Settings** — Configurable provider/model selection, review depth, and default review action with electron-store persistence
- **Provider Abstraction** — Claude Agent SDK as default provider with extensible provider registry for future CLI-based providers (Codex, Gemini)
- **Markdown Rendering** — Rich markdown display with remark-gfm, remark-breaks (GitHub-matching newline behavior), and shiki syntax highlighting (JavaScript regex engine for CSP compatibility)
- **Dark/Light Themes** — Multiple theme options inherited from production architecture
- **Cross-Platform** — Native macOS, Windows, and Linux builds via Electron 40
- **Auto-Updates** — Built-in update detection and in-app installation via electron-builder

### Bug Fixes

- **Infinite re-render loops** — Fixed Zustand selector instability in PRListView and ReviewView using stable module-level constants and useMemo
- **Shiki WASM CSP violation** — Switched from WASM to JavaScript regex engine for syntax highlighting compatibility with Electron's Content Security Policy
- **Socket listener duplication** — Fixed tripled progress logs caused by duplicate socket listener registration
- **Shiki timing bug** — Fixed syntax highlighting not applying on initial render

### Architecture

- Forked from Omniscribe's production Electron + NestJS + React architecture
- Monorepo with pnpm workspaces: `apps/desktop`, `apps/web`, `packages/shared`
- WebSocket communication via Socket.io between NestJS backend and React frontend
- Local-first persistence with electron-store (validation history, review history, settings)
- Tab-based navigation without router

### Stats

- 36 commits
- 286 files changed — +46,478 lines
- Built in 2 days (2026-02-11 → 2026-02-12)
