# T537 — Cross-platform packaged launch compatibility

Status: DONE

## Problem
ROX.ONE packaged builds must not hang on the first loading screen or refuse to start on supported desktop platforms. The immediate macOS failure was a packaged renderer crash (`Cannot read properties of undefined (reading 'createContext')`) caused by a broken React/i18n Rollup chunk relationship. The broader release surface also needs explicit compatibility guards for:

- macOS Sonoma 14.0 and newer, including Sonoma, Sequoia, and Tahoe.
- Windows x64 installer/unpacked launch paths used by Windows 10/11 users.
- Linux x64 packages and launcher behavior for Ubuntu, Debian, Fedora, and NixOS.

## Acceptance criteria
- Production renderer build fails if React/i18n chunks form the known circular packaged-loader crash shape.
- Packaged macOS app smoke proves the app exits cleanly from headless startup and the UI smoke leaves the initial loader.
- Installed `/Applications/ROX ONE.app` can be replaced by the rebuilt bundle and opens with the real user profile.
- macOS artifacts pin `LSMinimumSystemVersion=14.0` and `CFBundleIdentifier=com.rox.one`.
- Cross-platform packaged smoke harness supports macOS, Linux unpacked, and Windows unpacked executables.
- CI has an explicit cross-platform launch workflow for macOS Sequoia, Ubuntu 22.04/24.04, Windows hosted runners, and distro launcher guards for Debian/Fedora/NixOS.
- macOS white-window diagnostic workflow captures screenshots/logs on runnable Sonoma/Sequoia GitHub-hosted runners and records Ventura exact proof as VM/self-hosted/manual when hosted `macos-13` does not allocate.
- Linux installer wrapper preserves Debian/Ubuntu, Fedora, and NixOS launch remediation paths, including NixOS `appimage-run`.
- Worklog records failing proof, implementation, checks, and remaining risks/verification boundaries.
