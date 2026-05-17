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

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who report valid vulnerabilities (with their permission).
