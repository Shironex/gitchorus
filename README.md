<a name="top"></a>

<div align="center">
  <img src="assets/icon.png" alt="GitChorus" width="128" height="128" />
  <h1>GitChorus</h1>
  <p><strong>AI-powered code review and issue validation for your repositories</strong></p>

[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

</div>

> [!CAUTION]
>
> ## Project Discontinued (April 2026)
>
> **GitChorus is no longer actively maintained and this repository is now read-only.**
>
> GitChorus relies on the [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview), which is essentially a wrapper around Claude Code and uses your personal Claude credentials (Max plan subscription) to function. Anthropic has not provided clear guidance on whether using their SDK in third-party applications like this is permitted under the Max plan terms of service.
>
> While Anthropic has acknowledged this concern [on X](https://x.com) and stated they are "working on it," the [legal and compliance documentation](https://code.claude.com/docs/en/legal-and-compliance) has remained unchanged for over a month with no concrete resolution.
>
> **I don't want to risk users' accounts and subscriptions over an ambiguous policy**, so I've made the difficult decision to discontinue this project until the situation is fully resolved.
>
> ### What this means
>
> - **No new releases** will be published
> - **No issues or PRs** will be reviewed or merged
> - **Existing releases** remain available but are unsupported
> - The repository is **archived** (read-only)
>
> ### Future
>
> If Anthropic clarifies their SDK usage policy in a way that explicitly permits applications like GitChorus, or if an alternative provider SDK (such as OpenAI Codex CLI) becomes viable, this project may be revived. Until then, the code remains available under the MIT license for reference purposes.
>
> Thank you to everyone who used, contributed to, and supported GitChorus. It was a project I loved building and that genuinely improved my workflow. Hopefully it can come back one day.

## Table of Contents

- [About](#about)
- [Features](#features)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [License](#license)

## About

GitChorus is a desktop application that brings AI-powered code analysis directly to your local repositories. Point it at any GitHub-connected git repo and get structured, evidence-backed issue validation and PR reviews — powered by Claude's AI, running through your existing CLI subscription with zero API keys needed.

Unlike generic AI chat tools, GitChorus actually reads your codebase. The AI agent navigates your project files, understands your architecture, and produces findings backed by real code references — not hallucinated guesses.

## Features

| Feature                  | Description                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Issue Validation**     | AI agent reads your codebase to validate bug reports and assess feature requests with structured analysis |
| **PR Code Review**       | Comprehensive review with severity-categorized findings, code evidence, and suggested fixes               |
| **Streaming Progress**   | Watch the AI agent work in real-time — see which files it reads, which tools it uses                      |
| **GitHub Integration**   | Push validation summaries and review findings to GitHub with one click (inline PR comments included)      |
| **Review History**       | All validation and review results are persisted locally and survive app restarts                          |
| **Dashboard**            | Overview of open issues, PRs, quality score trends, and recent activity                                   |
| **Provider Abstraction** | Claude SDK as default provider, with architecture ready for Codex, Gemini, and other CLI-based providers  |
| **Configurable**         | Choose your model, review depth, default review action, and more from project settings                    |
| **Dark/Light Themes**    | Multiple theme options with syntax-highlighted code blocks via shiki                                      |
| **Cross-Platform**       | Native support for macOS, Windows, and Linux via Electron                                                 |
| **Auto-Updates**         | Built-in update detection and in-app installation                                                         |

## How It Works

### Issue Validation

1. Open a local git repository with a GitHub remote
2. Browse open issues from the connected repository
3. Click **Validate** on any issue — the AI agent spawns in read-only mode
4. Watch streaming progress as it analyzes your codebase
5. Get structured results: verdict, confidence, affected files, complexity, suggested approach
6. Push the analysis to GitHub as an issue comment with one click

### PR Review

1. Switch to the Pull Requests tab and select a PR
2. Click **Start Review** — the AI analyzes the diff with full codebase context
3. Get findings grouped by severity (Critical, Major, Minor, Nit) with:
   - Exact file and line references
   - Code snippets showing the problem
   - Suggested fixes
   - Category tags (security, logic, performance, style, codebase-fit)
4. Select findings and push as a proper GitHub PR review with inline comments

## Architecture

```
gitchorus/
├── apps/
│   ├── desktop/       # Electron + NestJS backend
│   └── web/           # React frontend
└── packages/
    └── shared/        # Shared types, constants, utilities
```

**Communication Flow:**

```
┌─────────────────────────────────────┐
│       Electron Main Process         │
│  ┌───────────────────────────────┐  │
│  │       NestJS Backend          │  │
│  │  Git │ GitHub │ Provider      │  │
│  │  Validation │ Review │ Settings│ │
│  └───────────────────────────────┘  │
│              │ WebSocket            │
└──────────────┼──────────────────────┘
               │
┌──────────────┼──────────────────────┐
│       Electron Renderer             │
│  ┌───────────────────────────────┐  │
│  │     React + Zustand           │  │
│  │  Dashboard │ Issues │ PRs     │  │
│  │  Settings  │ Review │ History │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Key Design Decisions:**

- **No API keys** — Uses Claude CLI subscription via the Claude Agent SDK, so there's nothing to configure
- **Read-only analysis** — The AI agent never writes code or makes changes, only reads and analyzes
- **Evidence-backed** — Every finding includes actual code references, not generic advice
- **Local-first** — All history and settings stored locally via electron-store
- **Dynamic ports** — The NestJS backend binds to an OS-assigned port at startup, avoiding conflicts with other applications

## Tech Stack

| Layer       | Technology                                 |
| ----------- | ------------------------------------------ |
| Desktop     | Electron 40                                |
| Backend     | NestJS 10, EventEmitter2                   |
| Frontend    | React 18, Zustand 5                        |
| AI Provider | Claude Agent SDK                           |
| Styling     | Tailwind CSS 4                             |
| Markdown    | ReactMarkdown, shiki (syntax highlighting) |
| Charts      | Recharts                                   |
| Build       | Vite, esbuild                              |
| IPC         | Socket.io                                  |
| Persistence | electron-store                             |

## License

This project is licensed under the [MIT License](LICENSE).

---

[Back to top](#top)
