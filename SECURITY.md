# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in GitChorus, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, email: **support@taketach.pl**

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **48 hours** — acknowledgment of your report
- **7 days** — initial assessment and action plan

## Scope

Security issues relevant to GitChorus include:

- **Electron IPC / preload / context isolation** — bypasses that could allow renderer-to-main escalation
- **CSP bypasses** — content security policy circumvention in the renderer
- **Command injection** — via AI agent spawning, git commands, or shell execution
- **WebSocket input validation** — malicious payloads through Socket.io messages
- **Dependency vulnerabilities** — critical CVEs in direct dependencies
- **GitHub token handling** — token leakage or misuse in API calls

## Current Security Measures

GitChorus implements the following security measures:

- `nodeIntegration: false` and `contextIsolation: true` in Electron
- Content Security Policy (CSP) headers configured per dynamic backend port
- CORS restrictions with regex-based origin matching
- `execFile` with argument arrays (not shell string interpolation) for subprocess spawning
- External links open in the system browser, not the Electron window
- AI agent runs in read-only mode with restricted tool access
- SHA validation with hex-character regex before passing to git commands
