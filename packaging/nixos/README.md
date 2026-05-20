# ROX.ONE on NixOS — AppImage Flake

NixOS does not provide the FHS filesystem layout (`/lib`, `/usr/lib`,
`/lib64/ld-linux-x86-64.so.2`) that AppImages expect.  This flake wraps
the upstream ROX.ONE AppImage with `pkgs.appimageTools.wrapType2` so the
binary runs correctly without any manual patching.

---

## Quick start

### Run without installing

```sh
nix run github:agisota/rox.one?dir=packaging/nixos
```

### Install into your profile

```sh
nix profile install github:agisota/rox.one?dir=packaging/nixos
```

After installation `rox-agent` is on your `PATH`.

### Development / smoke-test shell

```sh
nix develop github:agisota/rox.one?dir=packaging/nixos
rox-agent --help
```

---

## How it works

`flake.nix` calls `rox-agent.nix`, which delegates to
`pkgs.appimageTools.wrapType2`.  The wrapper:

1. Mounts the AppImage's embedded SquashFS in a temporary directory.
2. Patches the ELF interpreter paths via `patchelf`.
3. Injects the extra shared libraries listed in `extraPkgs` (libsecret,
   libnotify, GTK3, NSS, X11 libs, etc.) into `LD_LIBRARY_PATH`.
4. Produces a standard Nix derivation whose `bin/rox-agent` executable
   can be run directly.

No `--no-sandbox` flag, no `appimage-run`, no root access required.

---

## Updating the sha256 after a new release

The `sha256` field in `flake.nix` must be pinned to the exact AppImage
bytes for each release.  The placeholder `lib.fakeSha256` is intentional:
Nix will fail with the correct hash printed in the error output the first
time you build with a new version string.

**Step-by-step:**

1. Edit `flake.nix` and bump `version` to the new release tag (e.g.
   `"1.0.0-rc.8"`).

2. Run `nix-prefetch-url` to obtain the real sha256:

   ```sh
   nix-prefetch-url \
     https://github.com/agisota/rox.one/releases/download/v1.0.0-rc.8/ROX-ONE-x86_64.AppImage
   ```

   The command prints a base32 Nix hash, for example:

   ```
   1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. Replace the `sha256` value in `flake.nix`:

   ```nix
   sha256 = "1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
   ```

4. Run `nix build .#rox-agent` to verify the derivation builds cleanly.

5. Commit `flake.nix` (only `version` and `sha256` change).  The lock
   file (`flake.lock`) should also be committed after running
   `nix flake update` if any inputs changed.

> **Why not auto-update?**  Automated sha256 bumping requires the new
> AppImage to exist on the release page before the flake is committed —
> creating a chicken-and-egg ordering problem with the release pipeline.
> Manual bumping after each release is the correct, safe approach for v1.

---

## Requirements

- Nix 2.18+ with flake support enabled.

  Add to `/etc/nix/nix.conf` (or `~/.config/nix/nix.conf`):

  ```
  experimental-features = nix-command flakes
  ```

  Or pass `--extra-experimental-features 'nix-command flakes'` to each
  `nix` invocation.

- NixOS 24.05 or any NixOS / nix-on-Linux with x86_64 architecture.

---

## Known limitations

- **x86_64-linux only.**  An `aarch64-linux` build is not provided in v1
  because the upstream AppImage is x86_64 only.  Add `"aarch64-linux"` to
  the `eachSystem` list in `flake.nix` once an aarch64 AppImage is
  published.

- **sha256 is not locked in `flake.lock`.**  The AppImage URL is fetched
  at build time via `fetchurl`, not tracked by `flake.lock`.  Pinning is
  done via the explicit `sha256` attribute instead.

- **Electron sandbox on NixOS.**  Some NixOS kernel configurations disable
  user namespaces, which Electron's built-in sandbox relies on.  If
  ROX.ONE fails with a sandbox error, add `--no-sandbox` via:

  ```sh
  rox-agent --no-sandbox
  ```

  Or set `ELECTRON_DISABLE_SANDBOX=1` in your environment.  This is a
  known upstream Electron/NixOS integration issue unrelated to this flake.

- **Wayland.**  ROX.ONE inherits Electron's Wayland support.  Pass
  `--ozone-platform=wayland` or set `NIXOS_OZONE_WL=1` if running under a
  Wayland compositor.
