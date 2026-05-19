{
  description = "ROX.ONE rox-agent — NixOS AppImage flake";

  # ── inputs ──────────────────────────────────────────────────────────────────
  inputs = {
    nixpkgs.url     = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  # ── outputs ─────────────────────────────────────────────────────────────────
  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachSystem [ "x86_64-linux" ] (system:
      let
        pkgs = import nixpkgs { inherit system; };
        lib  = pkgs.lib;

        # ── release coordinates ──────────────────────────────────────────────
        # Bump `version` and `sha256` together on every new release.
        # See packaging/nixos/README.md for the exact nix-prefetch-url command.
        #
        # sha256 is set to lib.fakeSha256 intentionally: the first `nix build`
        # will fail with the correct hash printed in the error message — paste
        # that hash here and rebuild.
        version = "1.0.0-rc.7";
        sha256  = lib.fakeSha256;
        # ────────────────────────────────────────────────────────────────────

        roxAgent = pkgs.callPackage ./rox-agent.nix {
          inherit pkgs lib version sha256 system;
        };
      in {
        # ── packages ─────────────────────────────────────────────────────────
        packages = {
          rox-agent = roxAgent;
          default   = roxAgent;
        };

        # ── apps (nix run .#rox-agent) ───────────────────────────────────────
        apps = {
          rox-agent = flake-utils.lib.mkApp { drv = roxAgent; };
          default   = flake-utils.lib.mkApp { drv = roxAgent; };
        };

        # ── devShells ────────────────────────────────────────────────────────
        # `nix develop` drops you into a shell with rox-agent on PATH.
        # Useful for quick manual smoke testing: just run `rox-agent --help`.
        devShells.default = pkgs.mkShell {
          packages = [ roxAgent ];
          shellHook = ''
            echo "rox-agent ${version} available — run 'rox-agent' to launch."
          '';
        };
      }
    );
}
