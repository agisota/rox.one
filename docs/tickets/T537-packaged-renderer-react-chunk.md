# T537 — Cross-platform packaged launch compatibility

Status: DONE

## Problem
ROX.ONE packaged builds must not hang on the first loading screen or refuse to start on supported desktop platforms. The immediate macOS failure was a packaged renderer crash (`Cannot read properties of undefined (reading 'createContext')`) caused by a broken React/i18n Rollup chunk relationship. The broader release surface also needs explicit compatibility guards for:

- macOS Monterey 12.0 and newer, including Ventura, Sonoma, Sequoia, and Tahoe.
- Windows x64 installer/unpacked launch paths used by Windows 10/11 users.
- Linux x64 packages and launcher behavior for Ubuntu, Debian, Fedora, and NixOS.

## Acceptance criteria
- Production renderer build fails if React/i18n chunks form the known circular packaged-loader crash shape.
- Packaged macOS app smoke proves the app exits cleanly from headless startup and the UI smoke leaves the initial loader.
- macOS artifacts pin `LSMinimumSystemVersion=12.0` and `CFBundleIdentifier=com.rox.one`.
- Cross-platform packaged smoke harness supports macOS, Linux unpacked, and Windows unpacked executables.
- CI has an explicit cross-platform launch workflow for macOS Sequoia, Ubuntu 22.04/24.04, Windows hosted runners, and distro launcher guards for Debian/Fedora/NixOS.
- Linux installer wrapper preserves Debian/Ubuntu, Fedora, and NixOS launch remediation paths, including NixOS `appimage-run`.
- Worklog records failing proof, implementation, checks, and remaining risks/verification boundaries.
