import { existsSync } from "node:fs";
import { join } from "node:path";
import { discoverRoutes } from "../discovery.ts";
import type { Finding, Probe, ProbeContext } from "../probe.ts";
import { computeFindingId, FINDING_SCHEMA_VERSION } from "../probe.ts";

export const runtimeStatesProbe: Probe = {
  name: "runtime-states",
  phase: "A.2",
  applicableTo: () => true,
  async run(ctx: ProbeContext): Promise<Finding[]> {
    if (!ctx.playwright) return [];
    const routes = discoverRoutes(ctx.surface, ctx.surfaceRoot);
    const indexFile = join(ctx.surfaceRoot, "index.html");
    if (routes.length === 0 && !existsSync(indexFile)) return [];

    const findings: Finding[] = [];
    const now = new Date().toISOString();

    const targets = routes.length > 0
      ? routes.map((r) => `file://${ctx.surfaceRoot}/src/pages${r === "/" ? "/index" : r}.html`)
      : [`file://${indexFile}`];

    for (const url of targets) {
      const page = await ctx.playwright.newPage();
      try {
        await page.goto(url, { waitUntil: "networkidle" });

        // Check interactive elements for :hover/:focus/:disabled CSS rules
        const interactiveSelectors = ["button", "a[href]", "input", "select", "textarea"];
        for (const sel of interactiveSelectors) {
          const handles = await page.locator(sel).all();
          for (const handle of handles) {
            const hasFocusStyle = await handle.evaluate((el: Element) => {
              const sheets = Array.from((el.ownerDocument ?? document).styleSheets);
              for (const sheet of sheets) {
                try {
                  const rules = Array.from((sheet as CSSStyleSheet).cssRules ?? []);
                  for (const rule of rules) {
                    const text = (rule as CSSRule).cssText ?? "";
                    if (
                      text.includes(":hover") ||
                      text.includes(":focus") ||
                      text.includes(":disabled")
                    ) {
                      const tag = el.tagName.toLowerCase();
                      if (text.toLowerCase().includes(tag) || text.includes("*")) {
                        return true;
                      }
                    }
                  }
                } catch {
                  // Cross-origin stylesheet — skip
                }
              }
              return false;
            });

            if (!hasFocusStyle) {
              const outerHtml = await handle.evaluate((el) => el.outerHTML);
              const id = computeFindingId({
                probe: "runtime-states",
                rule: "state:missing-interactive-states",
                file: url,
                line: 0,
              });
              findings.push({
                schemaVersion: FINDING_SCHEMA_VERSION,
                id,
                probe: "runtime-states",
                surface: ctx.surface,
                phase: "A.2",
                severity: "medium",
                rule: "state:missing-interactive-states",
                location: { file: url, selector: sel },
                message: `Interactive element <${sel}> has no :hover, :focus, or :disabled CSS rule`,
                evidence: { codeSnippet: outerHtml },
                suggestedFix: "Add :hover, :focus-visible, and :disabled CSS rules for interactive elements",
                confidence: 0.7,
                vdiImpact: { quality: 0.5, risk: 0.3, readiness: 0.4 },
                firstSeen: now,
                lastSeen: now,
              });
              break; // one finding per selector type per page
            }
          }
        }

        // Check for empty lists with no empty-state markup
        const lists = await page.locator("ul, ol, [role=list]").all();
        for (const list of lists) {
          const childCount = await list.evaluate((el) => el.children.length);
          if (childCount === 0) {
            // Look for sibling or nearby element with empty-state class
            const hasEmptyState = await list.evaluate((el: Element) => {
              const parent = el.parentElement;
              if (!parent) return false;
              const siblings = Array.from(parent.children);
              return siblings.some((sib: Element) => {
                const cls = (sib as HTMLElement).className ?? "";
                return (
                  cls.includes("empty") ||
                  cls.includes("no-results") ||
                  cls.includes("placeholder") ||
                  (sib.getAttribute("aria-label") ?? "").toLowerCase().includes("empty")
                );
              });
            });

            if (!hasEmptyState) {
              const outerHtml = await list.evaluate((el) => el.outerHTML);
              const id = computeFindingId({
                probe: "runtime-states",
                rule: "state:missing-empty-state",
                file: url,
                line: 0,
              });
              findings.push({
                schemaVersion: FINDING_SCHEMA_VERSION,
                id,
                probe: "runtime-states",
                surface: ctx.surface,
                phase: "A.2",
                severity: "low",
                rule: "state:missing-empty-state",
                location: { file: url, selector: "ul, ol, [role=list]" },
                message: "List is empty and has no nearby empty-state element",
                evidence: { codeSnippet: outerHtml },
                suggestedFix: "Add an empty-state element (class containing 'empty' or 'no-results') as a sibling",
                confidence: 0.7,
                vdiImpact: { quality: 0.4, risk: 0.2, readiness: 0.3 },
                firstSeen: now,
                lastSeen: now,
              });
              break; // one finding per page
            }
          }
        }

        // Check forms for error-state mechanism
        const forms = await page.locator("form").all();
        for (const form of forms) {
          const hasErrorMechanism = await form.evaluate((el: Element) => {
            // Check for aria-invalid on any input
            const inputs = Array.from(el.querySelectorAll("input, select, textarea"));
            if (inputs.some((i: Element) => i.hasAttribute("aria-invalid"))) return true;
            // Check for [role=alert] anywhere in form
            if (el.querySelector("[role=alert]")) return true;
            // Check for elements with error/invalid class names
            const all = Array.from(el.querySelectorAll("*"));
            return all.some((child: Element) => {
              const cls = (child as HTMLElement).className ?? "";
              return cls.includes("error") || cls.includes("invalid");
            });
          });

          if (!hasErrorMechanism) {
            const outerHtml = await form.evaluate((el) => el.outerHTML);
            const id = computeFindingId({
              probe: "runtime-states",
              rule: "state:missing-error-state",
              file: url,
              line: 0,
            });
            findings.push({
              schemaVersion: FINDING_SCHEMA_VERSION,
              id,
              probe: "runtime-states",
              surface: ctx.surface,
              phase: "A.2",
              severity: "medium",
              rule: "state:missing-error-state",
              location: { file: url, selector: "form" },
              message: "Form has no error-state mechanism (aria-invalid, role=alert, or .error/.invalid class)",
              evidence: { codeSnippet: outerHtml.slice(0, 500) },
              suggestedFix: "Add aria-invalid to inputs and a [role=alert] element for form validation errors",
              confidence: 0.7,
              vdiImpact: { quality: 0.5, risk: 0.4, readiness: 0.4 },
              firstSeen: now,
              lastSeen: now,
            });
            break; // one finding per page
          }
        }
      } finally {
        await page.close();
      }
    }

    return findings;
  },
};
