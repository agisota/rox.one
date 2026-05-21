# Security Policy

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in ROX.ONE, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please send an email to: **security@rox.one**

Include the following information:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (optional)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Initial Assessment**: We will provide an initial assessment within 7 days
- **Resolution Timeline**: We aim to resolve critical issues within 30 days

### Scope

This policy applies to:
- The ROX.ONE desktop application
- The `@rox-one/*` npm packages
- Official ROX.ONE repositories

### Out of Scope

- Third-party dependencies (report to their maintainers)
- Social engineering attacks
- Denial of service attacks

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest | :x:               |

We only provide security updates for the latest version. Please keep your installation up to date.

## Security Best Practices

When using ROX.ONE:

1. **Keep credentials secure**: Never commit `.env` files or credentials
2. **Use environment variables**: Store secrets in environment variables
3. **Review permissions**: Be cautious with "Execute" permission mode
4. **Update regularly**: Keep the application updated

## Supply-chain hardening

### Workflow action pinning

Every `uses:` reference under `.github/workflows/` MUST be pinned to a full 40-character commit SHA, with a `# v<version>` comment naming the resolved semver. Example:

```yaml
- uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
```

Why: floating tags (`@v4`) are a known compromise vector — a tag-move attack on a popular action ships malicious code to every consumer on next CI run, and our release workflow has `contents: write` permission.

Enforcement:
- `bun run validate:workflow-pins` ([scripts/validate-workflow-pins.ts](scripts/validate-workflow-pins.ts)) fails CI if any workflow re-introduces a floating tag.
- Renovate is configured to keep the pins fresh (`helpers:pinGitHubActionDigests` preset in `.github/renovate.json`).

### Release feed worker

The Cloudflare Worker at `infra/cloudflare/rox-one-release-feed.worker.ts` proxies private GitHub release assets. Two non-obvious safeguards must be preserved:

1. **`redirect: 'manual'` on the asset-fetch path.** Workers' default fetch retains `Authorization` across cross-origin redirects (unlike browsers), which would leak the `GITHUB_RELEASE_TOKEN` PAT to S3 when GitHub 302s an asset download. The second hop strips the header.
2. **Upstream-header whitelist (`UPSTREAM_PASSTHROUGH_HEADERS`)** — only `content-length`, `etag`, `accept-ranges` cross from S3 to the public response. Without it, `Set-Cookie` and `x-amz-*` headers would be edge-cached and replayed to every downloader.

Regression tests in [infra/__tests__/rox-one-release-feed-worker.test.ts](infra/__tests__/rox-one-release-feed-worker.test.ts) assert both invariants by name.

### Linux Chromium sandbox

**Why the sandbox matters.** Chromium's renderer sandbox isolates each tab/renderer process from the host OS via Linux namespaces and seccomp-bpf. Without it, any RCE in the renderer (e.g. XSS in chat, malicious link opening a crafted page) grants the attacker full access to the host user account -- reading `~/.ssh`, exfiltrating secrets, persisting malware.

**Why AppImage normally can't preserve SUID.** A standard AppImage launch mounts the payload under `/tmp/.mount_ROX-XXXX` on every run. The kernel strips the SUID bit from files inside that mount, so `chrome-sandbox` (which must be owned by root with mode `4755`) loses its elevated permissions on every launch. The historical workaround was `--no-sandbox`, which eliminates the sandbox entirely.

**What we do instead.** The launcher runs `--appimage-extract` once on first launch, writing a persistent extracted directory to `~/.rox/app/squashfs-root/`. Binaries in that directory are regular files on the filesystem -- SUID sticks. The launcher then prompts for a single `sudo` to `chown root:root` and `chmod 4755` the `chrome-sandbox` binary. On all subsequent launches the SUID check is a no-op (mode already `4755`) and the app runs with the full sandbox enabled.

**What the user sees on first launch.**

```
First-time launch: extracting AppImage to enable sandbox...
Requesting one-time sudo to set SUID on chrome-sandbox (needed for security sandbox)...
[sudo] password for <user>:
```

**How to verify.** After first launch, confirm the sandbox binary has the correct owner and SUID mode:

```bash
ls -la ~/.rox/app/squashfs-root/chrome-sandbox
# Expected: -rwsr-xr-x 1 root root ... chrome-sandbox
#           ^ mode 4755, owned by root
```

**Fallback.** If `--appimage-extract` fails (e.g. insufficient disk space), the launcher falls back to `--no-sandbox` with a warning on stderr. This preserves app availability while signalling that sandbox protection is degraded.

### Install script verification (recommended for security-conscious users)

The `curl | bash` and `irm | iex` patterns from the README pipe a script through a single Cloudflare worker that also serves the binary it downloads. This is a **circular trust model** — anyone who compromises the worker can ship both a malicious script and a matching SHA-512 manifest simultaneously.

If you prefer to verify before executing, download the script, check the SHA-256 against the canonical value published here, then execute:

```bash
# macOS / Linux
curl -fsSL https://app.rox.one/install-app.sh -o install-app.sh
EXPECTED="47712ee72ca826f564b1e680fa6f6c5bcf6e084170e2ece1c6400310d241d0a8"
ACTUAL=$(sha256sum install-app.sh | cut -d' ' -f1)
[ "$EXPECTED" = "$ACTUAL" ] && bash install-app.sh || echo "SHA mismatch — abort"
```

```powershell
# Windows
Invoke-WebRequest -Uri https://app.rox.one/install-app.ps1 -OutFile install-app.ps1 -UseBasicParsing
$Expected = "b020c28ac16ff283fece02efc15a0cdaa29844aca70f0d0f8b385c0ebc799b69"
$Actual = (Get-FileHash install-app.ps1 -Algorithm SHA256).Hash.ToLower()
if ($Expected -eq $Actual) { . .\install-app.ps1 } else { Write-Error "SHA mismatch — abort" }
```

**Canonical SHA-256 (v1.0.3 install scripts):**

| File | SHA-256 |
|---|---|
| `install-app.sh` | `47712ee72ca826f564b1e680fa6f6c5bcf6e084170e2ece1c6400310d241d0a8` |
| `install-app.ps1` | `b020c28ac16ff283fece02efc15a0cdaa29844aca70f0d0f8b385c0ebc799b69` |

These values are updated on every release; check the [latest tag](https://github.com/agisota/rox.one/releases/latest) for current SHAs. The release workflow also prints them to the GitHub Actions step summary so you can cross-reference.

For higher assurance, fetch from `raw.githubusercontent.com` directly (different trust anchor than `app.rox.one`):

```bash
curl -fsSL https://raw.githubusercontent.com/agisota/rox.one/main/scripts/install-app.sh -o install-app.sh
```

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who report valid vulnerabilities (with their permission).
