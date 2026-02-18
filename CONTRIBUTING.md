# Contributing to GitChorus

Thank you for your interest in contributing to GitChorus! This guide will help you get started.

## Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** >= 9.0.0
- **Git**
- **Codex CLI** — `npm install -g @openai/codex` (needed for AI features at runtime)

### Platform-specific

- **Windows**: Visual Studio Build Tools with "Desktop development with C++" workload
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: `build-essential`, `python3`, `libsecret-1-dev`

## Getting Started

```bash
# Fork and clone the repository
git clone https://github.com/<your-username>/gitchorus.git
cd gitchorus

# Install dependencies
pnpm install

# Build shared packages (required before desktop/web)
pnpm build:packages

# Start development
pnpm dev
```

## Project Structure

```
gitchorus/
├── apps/
│   ├── desktop/       # Electron main process + NestJS backend
│   └── web/           # React frontend (loaded into Electron renderer)
├── packages/
│   └── shared/        # Shared types, constants, logger
├── scripts/           # Build and release scripts
└── docs/              # Additional documentation
```

## Development Workflow

1. Create a new branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```
2. Make your changes
3. Run checks:
   ```bash
   pnpm lint          # Lint
   pnpm format:check  # Check formatting
   pnpm typecheck     # Type check
   pnpm test          # Unit tests
   ```
4. Build to verify everything compiles:
   ```bash
   pnpm build
   ```
5. Submit a pull request targeting `main`

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/). Use these prefixes:

| Prefix     | Use for                                 |
| ---------- | --------------------------------------- |
| `feat`     | New features                            |
| `fix`      | Bug fixes                               |
| `refactor` | Code restructuring (no behavior change) |
| `ui`       | Visual/UI-only changes                  |
| `docs`     | Documentation updates                   |
| `chore`    | Build, tooling, dependency updates      |
| `test`     | Adding or updating tests                |
| `perf`     | Performance improvements                |
| `security` | Security fixes or hardening             |

Examples:

```
feat: add review chain visualization
fix: prevent duplicate socket listeners on reconnect
refactor: extract BaseLogService from log services
```

## Code Style

- **TypeScript strict mode** across all packages
- **ESLint + Prettier** for linting and formatting — run `pnpm lint` and `pnpm format` before committing
- **No `any` types** — use proper typing or `unknown` with type guards
- **Use the shared logger** (`createLogger` from `@gitchorus/shared`) instead of `console.log`
- **NestJS patterns** in the desktop backend (Injectable, modules, gateways)
- **Zustand** for frontend state management
- **Socket.io** for communication between NestJS backend and React frontend

## Architecture Notes

- `packages/shared` must be built before `apps/desktop` or `apps/web`
- The NestJS backend uses **dynamic port allocation** — never hardcode port numbers
- The AI agent runs in **read-only mode** — it can only use Read, Grep, Glob, and Bash tools
- Frontend socket is **lazy-initialized** — always use `getSocket()`, not a bare import
- When adding new socket consumers, guard `useEffect` bodies with `socketInitialized` from `useConnectionStore`

## Reporting Issues

- Use [GitHub Issues](https://github.com/Shironex/gitchorus/issues) to report bugs or request features
- Include steps to reproduce, expected vs actual behavior, and your OS/Node version
- Check existing issues before creating a new one

## License

By contributing to GitChorus, you agree that your contributions will be licensed under the [MIT License](LICENSE).
