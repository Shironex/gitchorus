# Changelog

All notable changes to this project will be documented in this file.

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
