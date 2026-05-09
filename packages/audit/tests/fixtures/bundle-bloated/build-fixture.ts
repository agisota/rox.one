#!/usr/bin/env bun
// Writes a 250KB+ dist/main.js for the bundle-bloated fixture.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const fixtureDir = import.meta.dir;
const distDir = join(fixtureDir, "dist");
mkdirSync(distDir, { recursive: true });

// Generate > 250 000 bytes of content
const header = "/* generated bundle */\n";
const line = "var x = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';\n"; // ~60 bytes
const repeatCount = Math.ceil((250_000 - header.length) / line.length) + 10;
const content = header + line.repeat(repeatCount);

writeFileSync(join(distDir, "main.js"), content, "utf-8");
console.log(`wrote dist/main.js: ${content.length} bytes`);
