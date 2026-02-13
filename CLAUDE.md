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

## Dynamic ports & socket architecture

The NestJS backend uses **dynamic port allocation** (`listen(0)`) — the OS assigns a free port at startup. This avoids port conflicts when running multiple Electron apps simultaneously.

**Port flow:**

```
NestJS listen(0) → OS assigns port → backend-port.ts stores it
  ├→ CSP headers (window.ts) — uses port for connect-src
  ├→ CORS config — regex matches any localhost port
  └→ IPC handler (app:get-backend-port) → preload → renderer → socket.ts
```

**Frontend socket is lazy-initialized.** The socket is NOT created at import time. Instead:

1. `useAppInitialization` fetches the port via `window.electronAPI.app.getBackendPort()`
2. Calls `initializeSocket(port)` to create the socket.io client
3. Sets `socketInitialized` in the connection store
4. Consumer hooks (`useValidationSocket`, `useReviewSocket`, `useSettings`) guard their effects with `if (!socketInitialized) return` — they only register socket listeners after the socket exists

**Key files:**

- `apps/desktop/src/main/backend-port.ts` — get/set backend port (avoids circular imports)
- `apps/web/src/lib/socket.ts` — `initializeSocket(port)` / `getSocket()` (lazy singleton)
- `apps/web/src/stores/useConnectionStore.ts` — `socketInitialized` flag gates consumer hooks

**When adding new socket consumers:** Always import `getSocket` (not a bare `socket`), and guard `useEffect` bodies with `socketInitialized` from `useConnectionStore`.

## Key gotchas

- **electron-builder.json** has strict schema validation — no unknown properties allowed, no `_comment` fields
- **asarUnpack** is required for `@anthropic-ai/claude-agent-sdk` — the SDK spawns child processes and needs filesystem access to cli.js, WASM files, and ripgrep binaries
- **Shell PATH** on macOS/Linux GUI apps is minimal — `shell-path.ts` resolves the full PATH at startup
- **Claude auth on macOS** uses Keychain, not credential files — detection falls back to checking `oauthAccount` in config
- The AI agent runs in **read-only mode** with `permissionMode: 'bypassPermissions'` — it can only use Read, Grep, Glob, and Bash tools
- **Backend port is dynamic** — never hardcode port numbers. Use `getBackendPort()` on the main process side and `getSocket()` on the frontend side
- **Vite dev server** runs on port **15173** (not the default 5173) to avoid conflicts with other projects

## Code style

- TypeScript strict mode across all packages
- Prettier for formatting, ESLint for linting
- NestJS patterns in desktop backend (Injectable, modules, gateways)
- Zustand for frontend state management
- Socket.io for IPC between NestJS backend and React frontend
