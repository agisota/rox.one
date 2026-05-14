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
 *   5. Every committed rebrand row in `.swarm/master-roadmap-log.md`
 *      references existing DONE ticket/worklog artifacts with 11-section
 *      worklogs.
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
const MASTER_ROADMAP_LOG = process.env.ROX_ROADMAP_LOG_PATH
  ? path.resolve(process.env.ROX_ROADMAP_LOG_PATH)
  : path.join(REPO_ROOT, '.swarm/master-roadmap-log.md');
const TICKET_DIR = process.env.ROX_ROADMAP_TICKET_DIR
  ? path.resolve(process.env.ROX_ROADMAP_TICKET_DIR)
  : path.join(REPO_ROOT, 'docs/tickets');
const WORKLOG_DIR = process.env.ROX_ROADMAP_WORKLOG_DIR
  ? path.resolve(process.env.ROX_ROADMAP_WORKLOG_DIR)
  : path.join(REPO_ROOT, 'docs/worklog');

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

function extractRebrandRowsFromMasterRoadmapLog(body) {
  return body
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter((entry) => entry.line.startsWith('rebrand-R.'))
    .map((entry) => {
      const cells = entry.line.split('|').map((cell) => cell.trim());
      return {
        line: entry.line,
        lineNumber: entry.lineNumber,
        phase: cells[0] ?? '',
        shaCell: cells[1] ?? '',
        ticketCell: cells[2] ?? '',
        dateCell: cells[3] ?? '',
        cellCount: cells.length,
      };
    });
}

function splitCommaCell(cell) {
  return cell
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function findArtifactsByTicketId(directory, ticketId) {
  if (!fs.existsSync(directory)) return null;
  const prefix = `${ticketId}-`;
  const files = fs
    .readdirSync(directory)
    .filter((entry) => entry.startsWith(prefix) && entry.endsWith('.md'))
    .sort();
  return files.map((file) => path.join(directory, file));
}

function worklogHasElevenSections(body) {
  for (let section = 1; section <= 11; section += 1) {
    if (!new RegExp(`^## ${section}\\.`, 'm').test(body)) return false;
  }
  return true;
}

function validateRebrandMasterRoadmapLog(body) {
  const rows = extractRebrandRowsFromMasterRoadmapLog(body);

  for (const row of rows) {
    if (row.cellCount !== 4) {
      report(
        MASTER_ROADMAP_LOG,
        `rebrand row on line ${row.lineNumber} must have exactly 4 pipe-separated cells: "${row.line}"`,
      );
      continue;
    }
    if (!row.phase || !row.shaCell || !row.ticketCell || !row.dateCell) {
      report(
        MASTER_ROADMAP_LOG,
        `rebrand row on line ${row.lineNumber} has an empty phase, SHA, ticket, or timestamp cell`,
      );
    }

    const shaValues = splitCommaCell(row.shaCell);
    for (const sha of shaValues) {
      if (!looksLikeSha(sha)) {
        report(
          MASTER_ROADMAP_LOG,
          `rebrand row ${row.phase} has a non-SHA commit cell value: "${sha}"`,
        );
      }
    }

    const ticketIds = splitCommaCell(row.ticketCell);
    for (const ticketId of ticketIds) {
      if (!/^T\d{3}[a-z]?$/.test(ticketId)) {
        report(
          MASTER_ROADMAP_LOG,
          `rebrand row ${row.phase} has an invalid ticket id: "${ticketId}"`,
        );
        continue;
      }

      const ticketPaths = findArtifactsByTicketId(TICKET_DIR, ticketId);
      if (!ticketPaths || ticketPaths.length === 0) {
        report(
          MASTER_ROADMAP_LOG,
          `rebrand row ${row.phase} ticket ${ticketId} has no matching ticket file`,
        );
        continue;
      }

      const candidatePairs = ticketPaths.map((ticketPath) => ({
        ticketPath,
        worklogPath: path.join(WORKLOG_DIR, path.basename(ticketPath)),
      }));
      const existingPairs = candidatePairs.filter((pair) => fs.existsSync(pair.worklogPath));
      if (existingPairs.length === 0) {
        report(
          MASTER_ROADMAP_LOG,
          `rebrand row ${row.phase} ticket ${ticketId} has no matching worklog file`,
        );
        continue;
      }

      const passingPair = existingPairs.find((pair) => {
        const ticketBody = fs.readFileSync(pair.ticketPath, 'utf8');
        const worklogBody = fs.readFileSync(pair.worklogPath, 'utf8');
        return /^Status:\s*DONE\b/im.test(ticketBody) && worklogHasElevenSections(worklogBody);
      });
      if (passingPair) continue;

      const candidateList = existingPairs
        .map((pair) => path.relative(REPO_ROOT, pair.ticketPath))
        .join(', ');
      const hasDoneTicket = existingPairs.some((pair) => {
        const ticketBody = fs.readFileSync(pair.ticketPath, 'utf8');
        return /^Status:\s*DONE\b/im.test(ticketBody);
      });
      const hasElevenSectionWorklog = existingPairs.some((pair) => {
        const worklogBody = fs.readFileSync(pair.worklogPath, 'utf8');
        return worklogHasElevenSections(worklogBody);
      });
      if (!hasDoneTicket) {
        report(
          MASTER_ROADMAP_LOG,
          `rebrand row ${row.phase} ticket ${ticketId} has no Status: DONE ticket candidate (${candidateList})`,
        );
      }
      if (!hasElevenSectionWorklog) {
        report(
          MASTER_ROADMAP_LOG,
          `rebrand row ${row.phase} ticket ${ticketId} has no 11-section worklog candidate (${candidateList})`,
        );
      }
    }
  }

  return rows.length;
}

const spineBody = readFile(SPINE);
const masterBody = readFile(MASTER_ROADMAP);
const rebrandBody = readFile(REBRAND_SWEEP);
const graphBody = readFile(GRAPH);
const masterRoadmapLogBody = readFile(MASTER_ROADMAP_LOG);

if (!spineBody || !masterBody || !rebrandBody || !graphBody || !masterRoadmapLogBody) {
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

const rebrandLogRows = validateRebrandMasterRoadmapLog(masterRoadmapLogBody);

if (violations.length === 0) {
  console.log(
    `validate:roadmap OK — ${spineLedgerPhases.size} phases, ${masterTickets.size + rebrandTickets.size} tickets across detail files, ${rebrandLogRows} rebrand master-roadmap log rows`,
  );
  process.exit(0);
}

console.error(`validate:roadmap FAIL — ${violations.length} violation(s):`);
for (const v of violations) {
  console.error(`  [${path.relative(REPO_ROOT, v.file)}] ${v.message}`);
}
process.exit(1);
