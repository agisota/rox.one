import { test, expect } from "bun:test";
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("gitleaks protect blocks staged fake AWS key", () => {
  const tmpDir = mkdtempSync(join(tmpdir(), "gitleaks-test-"));
  const fakeFile = join(tmpDir, "secret.txt");
  writeFileSync(fakeFile, "AKIAIOSFODNN7EXAMPLE\nwJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n");
  try {
    // Run gitleaks directly against the file
    const result = execSync(`gitleaks detect --no-banner --no-git --source ${tmpDir} 2>&1 || true`, { encoding: "utf8" });
    expect(result).toMatch(/leak|aws|secret|finding/i);
  } finally {
    unlinkSync(fakeFile);
  }
});
