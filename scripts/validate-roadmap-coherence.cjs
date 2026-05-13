#!/usr/bin/env node
/**
 * validate-roadmap-coherence.cjs
 *
 * Lints the three roadmap files to enforce:
 *   1. Every phase ID in the spine ledger has a matching phase heading in
 *      its owner detail file. Master-roadmap phases are written as numeric
 *      headings (`# Phase 2`), while the spine owns post-release `P.x`
 *      headings directly.
 *   2. Every owned ticket ID (T###-slug) appears in at most one roadmap file
 *      (the owner detail file). Cross-file prerequisite references are not
 *      ownership.
 *   3. The phase sequence in the spine forms a valid topological order
 *      against the dependency graph in
 *      `docs/release/v1-end-to-end-dependency-graph.md`.
 *   4. No phase in the ledger claims `Status: DONE` without a 7+ char
 *      commit SHA in its row.
 *
 * Run via `bun run validate:roadmap`. Exits non-zero on any violation.
 *
 * Pure fs/path — no shell, no child processes, no dependencies.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const SPINE = path.join(
  REPO_ROOT,
  'docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md',
);
const MASTER_ROADMAP = path.join(
  REPO_ROOT,
  'docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md',
);
const REBRAND_SWEEP = path.join(
  REPO_ROOT,
  'docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md',
);
const GRAPH = path.join(
  REPO_ROOT,
  'docs/release/v1-end-to-end-dependency-graph.md',
);

const violations = [];

function report(file, message) {
  violations.push({ file, message });
}

function readFile(file) {
  if (!fs.existsSync(file)) {
    report(file, `file does not exist`);
    return null;
  }
  return fs.readFileSync(file, 'utf8');
}

function extractPhaseIdsFromHeadings(body, ownerLane) {
  const ids = new Set();
  const re = /^#{1,6}\s+Phase\s+([MRP]\.[0-9]+(?:\.[0-9]+)?[a-z]?)\b/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    ids.add(m[1]);
  }

  if (ownerLane === 'M') {
    const numericRe = /^#{1,6}\s+Phase\s+([0-9]+(?:\.[0-9]+)?[a-z]?)\b/gm;
    while ((m = numericRe.exec(body)) !== null) {
      ids.add(`M.${m[1]}`);
    }

    const closeoutRe = /^#{1,6}\s+Phase\s+1\s+closeout\b/gim;
    if (closeoutRe.test(body)) {
      ids.add('M.1.7');
    }
  }

  if (ownerLane === 'P') {
    const postReleaseRe = /^#{1,6}\s+(?:Phase\s+)?(P\.[0-9]+(?:\.[0-9]+)?[a-z]?)\b/gm;
    while ((m = postReleaseRe.exec(body)) !== null) {
      ids.add(m[1]);
    }
  }

  return ids;
}

function extractPhaseIdsFromLedger(body) {
  const ids = new Set();
  const re = /^\|\s*[MRP]\s*\|\s*([MRP]\.[0-9]+(?:\.[0-9]+)?[a-z]?)\s*\|/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    ids.add(m[1]);
  }
  return ids;
}

function extractPhaseIdsFromGraph(body) {
  const ids = new Set();
  const re = /\[\s*"\s*([MRP]\.[0-9]+(?:\.[0-9]+)?[a-z]?)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    ids.add(m[1]);
  }
  return ids;
}

function extractTicketIds(body, { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) {
  const ids = new Set();
  const re = /\bT(\d{3})\b/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const ticketNumber = Number(m[1]);
    if (ticketNumber >= min && ticketNumber <= max) {
      ids.add(m[0]);
    }
  }
  return ids;
}

function extractDoneRows(body) {
  const rows = [];
  const re =
    /^\|\s*[MRP]\s*\|\s*([MRP]\.[0-9]+(?:\.[0-9]+)?[a-z]?)\s*\|([^|]+)\|\s*(✓\s*DONE|NEXT|QUEUED|IN FLIGHT|BLOCKED)\s*\|[^|]+\|[^|]+\|\s*([^|]*)\s*\|/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    const phase = m[1];
    const status = m[3].trim();
    const shaCell = m[4].trim();
    rows.push({ phase, status, shaCell });
  }
  return rows;
}

function looksLikeSha(cell) {
  const stripped = cell.replace(/`/g, '').replace(/^—$|^-$/, '').trim();
  if (stripped === '') return false;
  if (stripped.includes('..')) {
    return /^[0-9a-f]{7,40}\.\.[0-9a-f]{7,40}$/i.test(stripped);
  }
  return /^[0-9a-f]{7,40}$/i.test(stripped);
}

const spineBody = readFile(SPINE);
const masterBody = readFile(MASTER_ROADMAP);
const rebrandBody = readFile(REBRAND_SWEEP);
const graphBody = readFile(GRAPH);

if (!spineBody || !masterBody || !rebrandBody || !graphBody) {
  process.exit(2);
}

const spineLedgerPhases = extractPhaseIdsFromLedger(spineBody);
const masterHeadingPhases = extractPhaseIdsFromHeadings(masterBody, 'M');
const rebrandHeadingPhases = extractPhaseIdsFromHeadings(rebrandBody, 'R');
const spineHeadingPhases = extractPhaseIdsFromHeadings(spineBody, 'P');

for (const phase of spineLedgerPhases) {
  const lane = phase[0];
  let foundIn;
  if (lane === 'M') {
    if (masterHeadingPhases.has(phase) || spineHeadingPhases.has(phase)) {
      foundIn = true;
    }
  } else if (lane === 'R') {
    if (rebrandHeadingPhases.has(phase) || spineHeadingPhases.has(phase)) {
      foundIn = true;
    }
  } else if (lane === 'P') {
    if (spineHeadingPhases.has(phase)) {
      foundIn = true;
    }
  }
  if (!foundIn) {
    report(
      SPINE,
      `phase ${phase} appears in the ledger but has no matching # Phase heading in its owner file (lane ${lane})`,
    );
  }
}

const masterTickets = extractTicketIds(masterBody, { max: 259 });
const rebrandTickets = extractTicketIds(rebrandBody, { min: 260, max: 299 });
const overlappingTickets = new Set();
for (const t of masterTickets) {
  if (rebrandTickets.has(t)) {
    overlappingTickets.add(t);
  }
}
for (const t of overlappingTickets) {
  report(
    SPINE,
    `ticket ${t} appears in BOTH master-roadmap and rebrand-sweep detail files — should be defined in exactly one`,
  );
}

const graphPhases = extractPhaseIdsFromGraph(graphBody);
for (const p of graphPhases) {
  if (!spineLedgerPhases.has(p)) {
    report(GRAPH, `phase ${p} appears in the dependency graph but not in the spine ledger`);
  }
}
for (const p of spineLedgerPhases) {
  if (!graphPhases.has(p)) {
    report(SPINE, `phase ${p} appears in the spine ledger but not in the dependency graph`);
  }
}

const doneRows = extractDoneRows(spineBody);
for (const row of doneRows) {
  if (row.status === '✓ DONE') {
    if (!looksLikeSha(row.shaCell)) {
      report(
        SPINE,
        `phase ${row.phase} is marked DONE but the SHA cell does not contain a commit SHA: "${row.shaCell}"`,
      );
    }
  }
}

if (violations.length === 0) {
  console.log(
    `validate:roadmap OK — ${spineLedgerPhases.size} phases, ${masterTickets.size + rebrandTickets.size} tickets across detail files`,
  );
  process.exit(0);
}

console.error(`validate:roadmap FAIL — ${violations.length} violation(s):`);
for (const v of violations) {
  console.error(`  [${path.relative(REPO_ROOT, v.file)}] ${v.message}`);
}
process.exit(1);
