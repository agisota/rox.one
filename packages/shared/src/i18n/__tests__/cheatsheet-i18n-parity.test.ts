import { describe, it, expect } from "bun:test";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// T240c — Cheatsheet i18n parity test
// Verifies cheatsheet.* keys are present and non-empty in all locale files.
// ---------------------------------------------------------------------------

const CHEATSHEET_KEYS = [
  "cheatsheet.title",
  "cheatsheet.section.composer",
  "cheatsheet.section.navigation",
  "cheatsheet.section.settings",
] as const;

const LOCALES_DIR = join(import.meta.dir, "../locales");
const localeFiles = readdirSync(LOCALES_DIR).filter((f) => f.endsWith(".json"));

const locales: Record<string, Record<string, string>> = {};
for (const file of localeFiles) {
  const lang = file.replace(".json", "");
  locales[lang] = JSON.parse(readFileSync(join(LOCALES_DIR, file), "utf-8"));
}

describe("cheatsheet i18n parity", () => {
  it("discovers exactly 8 locale files", () => {
    expect(localeFiles.length).toBe(8);
  });

  for (const [lang, translations] of Object.entries(locales)) {
    describe(`locale: ${lang}`, () => {
      for (const key of CHEATSHEET_KEYS) {
        it(`has key "${key}"`, () => {
          expect(Object.prototype.hasOwnProperty.call(translations, key)).toBe(true);
        });

        it(`"${key}" is not empty`, () => {
          const value = translations[key];
          expect(typeof value).toBe("string");
          expect((value as string).trim().length).toBeGreaterThan(0);
        });
      }
    });
  }
});
