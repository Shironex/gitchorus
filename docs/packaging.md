# Electron Packaging Guide

Production packaging gotchas and decisions for GitChorus.

## asar and asarUnpack

Electron bundles the app into `app.asar` — a single archive file. Code inside it can be `require()`'d by Node but **cannot be executed directly** by `spawn()` or `execFile()`.

The Codex SDK wraps the Codex CLI and executes a native `codex` binary under the hood. In packaged builds, that binary must live on the real filesystem (not inside `app.asar`).

**Solution:** `asarUnpack` in `electron-builder.json` extracts matched files to `app.asar.unpacked/` alongside `app.asar`:

```json
"asarUnpack": [
  "node_modules/@openai/codex/**/*",
  "node_modules/@openai/codex-*/**/*"
]
```

At runtime, the app resolves the unpacked platform binary path from `app.asar.unpacked`:

```typescript
path.join(
  process.resourcesPath,
  'app.asar.unpacked',
  'node_modules',
  '@openai',
  'codex-darwin-arm64', // platform package varies by OS/arch
  'vendor',
  'aarch64-apple-darwin',
  'codex',
  'codex'
);
```

This is passed to the SDK as `codexPathOverride`. In development (`!app.isPackaged`), the override is omitted so the SDK uses default resolution.

### onlyLoadAppFromAsar fuse

The `electronFuses.onlyLoadAppFromAsar: true` setting restricts Electron's **app code loading** to the asar archive (security hardening). This does **not** conflict with `asarUnpack` — the unpacked files are accessed by our code via `fs`/`spawn`, not by Electron's module loader.

## electron-builder.json strict schema

`electron-builder.json` is validated against a strict JSON schema. **No unknown properties are allowed** — this means:

- No `_comment` fields (JSON has no comment syntax)
- No custom metadata keys
- Every property must match the [electron-builder configuration schema](https://www.electron.build/configuration)

If you need to document config decisions, do it in this file or in code comments, not in the JSON.

## Shell PATH resolution

Electron GUI apps on macOS/Linux inherit a minimal PATH (`/usr/bin:/bin:/usr/sbin:/sbin`) because they don't source the user's shell profile. This means tools like `codex`, `gh`, `git`, and `node` installed via homebrew, nvm, or npm global won't be found.

**Solution:** `shell-path.ts` runs at startup, spawns a login shell, extracts the full PATH, and updates `process.env.PATH`. This runs once before any child processes are spawned.

- Windows GUI apps inherit the correct PATH, so this is a no-op on Windows
- Falls back through `/bin/zsh` -> `/bin/bash` -> `/bin/sh` if the user's default shell fails
- Fish shell gets special handling (`-l -i -c` instead of `-ilc`)

## Codex CLI detection

The app needs to find the Codex CLI binary and verify authentication. This is handled by `codex-detection.ts`:

- **PATH lookup first** (`which codex`), then checks common install locations
- **Auth check**: runs `codex login status` and validates logged-in state from CLI output

## Platform-specific notes

| Concern     | macOS                                | Windows                     | Linux                               |
| ----------- | ------------------------------------ | --------------------------- | ----------------------------------- |
| Shell PATH  | Resolved at startup via login shell  | No-op (inherits full PATH)  | Resolved at startup via login shell |
| Codex auth  | Checked through `codex login status` | Checked through CLI command | Checked through CLI command         |
| App targets | DMG, ZIP                             | NSIS installer              | AppImage, DEB                       |

## Version bumping

Use the monorepo version script to keep all packages in sync:

```bash
./scripts/bump-version.sh patch   # 0.1.2 -> 0.1.3
./scripts/bump-version.sh minor   # 0.1.2 -> 0.2.0
./scripts/bump-version.sh major   # 0.1.2 -> 1.0.0
./scripts/bump-version.sh 1.0.0   # explicit version
```

This updates `package.json` in the root, `apps/desktop`, `apps/web`, and `packages/shared`.
