# Electron Packaging Guide

Production packaging gotchas and decisions for GitChorus.

## asar and asarUnpack

Electron bundles the app into `app.asar` — a single archive file. Code inside it can be `require()`'d by Node but **cannot be executed directly** by `spawn()` or `execFile()`.

The Claude Agent SDK spawns a child Node process running `cli.js` and also needs filesystem access to WASM files and platform-specific ripgrep binaries. All of these must live on the real filesystem.

**Solution:** `asarUnpack` in `electron-builder.json` extracts matched files to `app.asar.unpacked/` alongside `app.asar`:

```json
"asarUnpack": ["node_modules/@anthropic-ai/claude-agent-sdk/**/*"]
```

At runtime, the unpacked `cli.js` path is resolved via:

```typescript
path.join(
  process.resourcesPath,
  'app.asar.unpacked',
  'node_modules',
  '@anthropic-ai',
  'claude-agent-sdk',
  'cli.js'
);
```

This is passed to the SDK as `pathToClaudeCodeExecutable`. In development (`!app.isPackaged`), the option is omitted so the SDK uses its default resolution.

### onlyLoadAppFromAsar fuse

The `electronFuses.onlyLoadAppFromAsar: true` setting restricts Electron's **app code loading** to the asar archive (security hardening). This does **not** conflict with `asarUnpack` — the unpacked files are accessed by our code via `fs`/`spawn`, not by Electron's module loader.

## electron-builder.json strict schema

`electron-builder.json` is validated against a strict JSON schema. **No unknown properties are allowed** — this means:

- No `_comment` fields (JSON has no comment syntax)
- No custom metadata keys
- Every property must match the [electron-builder configuration schema](https://www.electron.build/configuration)

If you need to document config decisions, do it in this file or in code comments, not in the JSON.

## Shell PATH resolution

Electron GUI apps on macOS/Linux inherit a minimal PATH (`/usr/bin:/bin:/usr/sbin:/sbin`) because they don't source the user's shell profile. This means tools like `claude`, `gh`, `git`, and `node` installed via homebrew, nvm, or npm global won't be found.

**Solution:** `shell-path.ts` runs at startup, spawns a login shell, extracts the full PATH, and updates `process.env.PATH`. This runs once before any child processes are spawned.

- Windows GUI apps inherit the correct PATH, so this is a no-op on Windows
- Falls back through `/bin/zsh` -> `/bin/bash` -> `/bin/sh` if the user's default shell fails
- Fish shell gets special handling (`-l -i -c` instead of `-ilc`)

## Claude CLI detection

The app needs to find the Claude CLI binary and verify authentication. This is handled by `claude-detection.ts`:

- **PATH lookup first** (`which claude`), then checks common install locations
- **Auth check**: reads `~/.claude/.credentials.json` or `~/.claude/credentials.json` for OAuth tokens. On macOS, tokens are in Keychain, so it falls back to checking `oauthAccount` in `~/.claude/.claude.json`

## Platform-specific notes

| Concern           | macOS                                           | Windows                     | Linux                                         |
| ----------------- | ----------------------------------------------- | --------------------------- | --------------------------------------------- |
| Shell PATH        | Resolved at startup via login shell             | No-op (inherits full PATH)  | Resolved at startup via login shell           |
| Claude CLI tokens | Stored in Keychain; config has `oauthAccount`   | Stored in credential files  | Stored in credential files                    |
| Ripgrep binary    | `vendor/ripgrep/arm64-darwin/` or `x64-darwin/` | `vendor/ripgrep/x64-win32/` | `vendor/ripgrep/arm64-linux/` or `x64-linux/` |
| App targets       | DMG, ZIP                                        | NSIS installer              | AppImage, DEB                                 |

## Version bumping

Use the monorepo version script to keep all packages in sync:

```bash
./scripts/bump-version.sh patch   # 0.1.2 -> 0.1.3
./scripts/bump-version.sh minor   # 0.1.2 -> 0.2.0
./scripts/bump-version.sh major   # 0.1.2 -> 1.0.0
./scripts/bump-version.sh 1.0.0   # explicit version
```

This updates `package.json` in the root, `apps/desktop`, `apps/web`, and `packages/shared`.
