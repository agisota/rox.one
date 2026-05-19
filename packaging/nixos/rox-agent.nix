# packaging/nixos/rox-agent.nix
#
# Thin wrapper around appimageTools.wrapType2 that makes the ROX.ONE
# AppImage runnable on NixOS.  NixOS lacks the FHS layout (/lib, /usr,
# dynamic-linker path at /lib64/ld-linux-x86-64.so.2) that AppImages
# assume, so we delegate to Nixpkgs' built-in shim instead of building
# from source.
#
# Usage (from flake.nix):
#   pkgs.callPackage ./rox-agent.nix { version = "1.0.0-rc.7"; sha256 = "..."; }
#
# To update sha256 after each release:
#   nix-prefetch-url \
#     https://github.com/agisota/rox-one-terminal/releases/download/v<VER>/ROX-ONE-x86_64.AppImage
# Paste the printed hash into the sha256 field in flake.nix.

{ pkgs
, lib
, version
, sha256
, system ? builtins.currentSystem
  # Override src to use a local file during CI (avoids chicken-and-egg sha
  # mismatch when the release doesn't exist yet).  In normal usage, leave
  # this at null and src is derived from version + sha256 automatically.
, src ? null
}:

let
  pname = "rox-agent";

  resolvedSrc = if src != null then src else pkgs.fetchurl {
    url = "https://github.com/agisota/rox-one-terminal/releases/download/v${version}/ROX-ONE-x86_64.AppImage";
    inherit sha256;
  };

  # Runtime libraries Electron typically dlopen at startup.
  # libsecret  — OS keychain / credential storage (SecretService API)
  # libnotify  — desktop notifications
  # glib       — GLib/GIO base (pulled in transitively but listed explicitly
  #               for clarity and forward-compat if the transitive dep changes)
  extraPkgs = ps: with ps; [
    libsecret
    libnotify
    glib
    at-spi2-atk
    cups
    dbus
    expat
    fontconfig
    freetype
    gtk3
    nspr
    nss
    pango
    xorg.libX11
    xorg.libXcomposite
    xorg.libXcursor
    xorg.libXdamage
    xorg.libXext
    xorg.libXfixes
    xorg.libXi
    xorg.libXrandr
    xorg.libXrender
    xorg.libXtst
    xorg.libxcb
  ];
in

pkgs.appimageTools.wrapType2 {
  inherit pname version;
  src = resolvedSrc;
  extraPkgs = extraPkgs;

  meta = with lib; {
    description = "ROX.ONE AI terminal — NixOS AppImage wrapper";
    longDescription = ''
      ROX.ONE is an AI-powered terminal application.  This derivation wraps
      the upstream AppImage release with appimageTools.wrapType2 so it runs
      correctly on NixOS without an FHS layout.

      The sha256 hash must be updated for each new release; see the sha-bump
      procedure in packaging/nixos/README.md.
    '';
    homepage = "https://rox.one";
    license = licenses.unfree;   # proprietary binary; source is not bundled
    platforms = [ "x86_64-linux" ];
    mainProgram = pname;
  };
}
