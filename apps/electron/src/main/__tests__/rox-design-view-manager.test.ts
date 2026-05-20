import { describe, expect, it } from "bun:test";
import {
  getRoxDesignNavigationDecision,
  sanitizeRoxDesignBounds,
  scaleRoxDesignBounds,
} from "../rox-design-view-policy";
import {
  ROX_DESIGN_EMBED_CSS,
  buildRoxDesignEmbedBootstrapScript,
  resolveRoxDesignContentZoomFactor,
} from "../rox-design-embed-skin";

describe("RoxDesignViewManager helpers", () => {
  it("sanitizes renderer-provided host bounds", () => {
    expect(
      sanitizeRoxDesignBounds({ x: 10.8, y: -4, width: 320.6, height: 240.2 }),
    ).toEqual({
      x: 11,
      y: 0,
      width: 321,
      height: 240,
    });
    expect(
      sanitizeRoxDesignBounds({ x: Number.NaN, y: 2, width: 0, height: 100 }),
    ).toBeNull();
  });

  it("scales CSS-pixel bounds to Electron DIP bounds with the host zoom factor", () => {
    expect(
      scaleRoxDesignBounds({ x: 100, y: 50, width: 1000, height: 600 }, 0.8),
    ).toEqual({
      x: 80,
      y: 40,
      width: 800,
      height: 480,
    });
  });

  it("uses compact embedded zoom so Open Design fits inside the ROX pane", () => {
    expect(resolveRoxDesignContentZoomFactor({ width: 1200 })).toBe(0.6);
    expect(resolveRoxDesignContentZoomFactor({ width: 1700 })).toBe(0.64);
    expect(resolveRoxDesignContentZoomFactor({ width: 2100 })).toBe(0.68);
  });

  it("ships a ROX dark embedded skin for the Open Design surface", () => {
    expect(ROX_DESIGN_EMBED_CSS).toContain("data-rox-embedded='true'");
    expect(ROX_DESIGN_EMBED_CSS).toContain("--bg-app: #05070d");
    expect(ROX_DESIGN_EMBED_CSS).toContain("--accent: #22d3ee");
    expect(ROX_DESIGN_EMBED_CSS).toContain(".app-chrome-header");
    expect(ROX_DESIGN_EMBED_CSS).toContain("display: none !important");
    expect(ROX_DESIGN_EMBED_CSS).toContain(".entry-tab-content");
    expect(ROX_DESIGN_EMBED_CSS).toContain(".prompt-template-card");
    expect(ROX_DESIGN_EMBED_CSS).toContain(".newproj-card");
    expect(ROX_DESIGN_EMBED_CSS).toContain(".workspace");
    expect(ROX_DESIGN_EMBED_CSS).toContain(".settings-section");
    expect(ROX_DESIGN_EMBED_CSS).toContain(".privacy-consent-banner");
    expect(ROX_DESIGN_EMBED_CSS).toContain("pointer-events: none !important");
  });

  it("injects durable Rox Design branding and embed markers", () => {
    const script = buildRoxDesignEmbedBootstrapScript(0.68);
    expect(script).toContain("Rox Design");
    expect(script).toContain("Open\\s+Design");
    expect(script).toContain("__ROX_DESIGN_EMBED_OBSERVER__");
    expect(script).toContain("__ROX_DESIGN_EMBED_INTERVAL__");
    expect(script).toContain("root.dataset.roxEmbedded = 'true'");
    expect(script).toContain("theme: 'dark'");
    expect(script).toContain("root.dataset.roxEmbedPolished = 'true'");
    expect(script).toContain("privacyDecisionAt");
    expect(script).toContain(
      "telemetry: { metrics: false, content: false, artifactManifest: false }",
    );
    expect(script).toContain("fetch('/api/app-config'");
    expect(script).toContain("dismissPrivacyConsent");
  });

  it("allows same-origin navigation and externalizes cross-origin http(s)", () => {
    expect(
      getRoxDesignNavigationDecision(
        "https://design.t/app",
        "https://design.t/projects/1",
      ),
    ).toEqual({ action: "allow" });
    expect(
      getRoxDesignNavigationDecision(
        "https://design.t/app",
        "https://example.com/",
      ),
    ).toEqual({ action: "external", url: "https://example.com/" });
    expect(
      getRoxDesignNavigationDecision(
        "https://design.t/app",
        "file:///tmp/nope",
      ),
    ).toEqual({ action: "deny" });
  });
});
