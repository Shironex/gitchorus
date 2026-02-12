---
name: address-pr-comments
description: Fetch and address all inline review comments on a GitHub PR
disable-model-invocation: true
argument-hint: "[pr-number or empty for current branch PR]"
allowed-tools: Bash(gh *), Read, Edit, Grep, Glob
---

# Address PR Review Comments

Fetch all unresolved inline review comments on a pull request and fix them.

## Step 1 — Resolve the PR number

- If `$ARGUMENTS` is provided, use that as the PR number.
- Otherwise, detect the PR for the current branch:
  ```
  gh pr view --json number --jq '.number'
  ```

## Step 2 — Fetch review comments

```
gh api repos/Shironex/gitchorus/pulls/{number}/comments
```

Parse each comment and extract:
| Field | Use |
|-------|-----|
| `body` | The reviewer's feedback — look for **Suggested fix** code blocks |
| `path` | File that needs changing |
| `line` / `original_line` | Approximate location in the file |
| `diff_hunk` | Surrounding diff context to locate the code |

## Step 3 — Categorise and summarise

Print a short summary for the user before making changes:

```
Found N review comments on PR #X:
1. [severity] file.tsx:L42 — one-line description
2. ...
```

Severity comes from the comment body (look for `[Critical]`, `[Minor]`, `[Nit]` prefixes the reviewer uses).

## Step 4 — Apply fixes

For each comment:

1. **Read** the target file (use the `path` field).
2. **Locate** the problematic code using `diff_hunk` + `line` as guide.
3. **Apply** the fix — prefer the reviewer's suggested fix when provided.
4. If the fix touches imports, check for unused imports and clean up.

## Step 5 — Verify

Run the project checks to make sure nothing broke:

```bash
pnpm --filter @gitchorus/web test -- --run   # frontend tests
pnpm lint                                      # linting
pnpm format                                    # formatting
```

If desktop code was changed, also run:
```bash
pnpm --filter @gitchorus/desktop test         # backend tests
```

## Step 6 — Commit & push

Stage only the files that were changed to address comments, then commit:

```
fix: address PR review comments

<one-line summary per comment addressed>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Push to the existing branch — it will update the open PR automatically.

## Rules

- **Do not** refactor or change code beyond what the review comment asks for.
- **Do not** add new features or tests unless a comment explicitly requests them.
- If a comment is ambiguous, ask the user before applying a fix.
- Always run checks before committing — never push broken code.
