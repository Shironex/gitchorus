# CLAUDE.md

Project context for AI assistants working on GitChorus.

## Project overview

GitChorus is an Electron desktop app for AI-powered code review and issue validation. It uses the Claude Agent SDK to spawn read-only AI agents that analyze codebases.

## Monorepo structure

```
apps/desktop/    # Electron main process + NestJS backend
apps/web/        # React frontend (loaded into Electron renderer)
packages/shared/ # Shared types, constants, logger
```

## Key commands

```bash
pnpm dev                    # Start development (all packages)
pnpm build                  # Build all packages
pnpm test                   # Run all tests
pnpm lint                   # Lint all packages
pnpm format                 # Format all packages

# Desktop-specific
pnpm --filter @gitchorus/desktop build    # Build desktop
pnpm --filter @gitchorus/desktop test     # 360 unit tests
pnpm --filter @gitchorus/desktop package:mac    # Package for macOS
pnpm --filter @gitchorus/desktop package:win    # Package for Windows
pnpm --filter @gitchorus/desktop package:linux  # Package for Linux

# Version bumping (all packages at once)
./scripts/bump-version.sh patch|minor|major|<version>
```

## Build order

`packages/shared` must be built before `apps/desktop` or `apps/web`:

```bash
pnpm --filter @gitchorus/shared build && pnpm --filter @gitchorus/desktop build
```

## Important docs

- **[docs/packaging.md](docs/packaging.md)** — Electron packaging gotchas: asar unpacking, electron-builder schema rules, shell PATH resolution, Claude CLI detection, platform-specific notes

## Key gotchas

- **electron-builder.json** has strict schema validation — no unknown properties allowed, no `_comment` fields
- **asarUnpack** is required for `@anthropic-ai/claude-agent-sdk` — the SDK spawns child processes and needs filesystem access to cli.js, WASM files, and ripgrep binaries
- **Shell PATH** on macOS/Linux GUI apps is minimal — `shell-path.ts` resolves the full PATH at startup
- **Claude auth on macOS** uses Keychain, not credential files — detection falls back to checking `oauthAccount` in config
- The AI agent runs in **read-only mode** with `permissionMode: 'bypassPermissions'` — it can only use Read, Grep, Glob, and Bash tools

## Code style

- TypeScript strict mode across all packages
- Prettier for formatting, ESLint for linting
- NestJS patterns in desktop backend (Injectable, modules, gateways)
- Zustand for frontend state management
- Socket.io for IPC between NestJS backend and React frontend
