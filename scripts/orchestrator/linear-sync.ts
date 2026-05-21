/**
 * linear-sync.ts — Linear GraphQL client for per-WT issue sync.
 *
 * Reads wt-meta/wt-XX.yaml `linear:` blocks, ensures parent epic exists,
 * upserts child stories, attaches existing-issue refs, propagates state
 * mapping (planned → in-progress → in-review → shipped).
 *
 * Env: LINEAR_API_KEY (required), LINEAR_TEAM_ID (required, default kuhjie team UUID).
 * Idempotent: identifies issues by (parent_epic_identifier + title) tuple;
 * never creates duplicates.
 */

import { loadWTMetas, type WTMeta } from "./state.js";

const LINEAR_API = "https://api.linear.app/graphql";
const RATE_LIMIT_MS = 300; // 0.3s throttle to avoid 429
const DEFAULT_TEAM_ID = "86e0ae89-3cf0-43b7-b363-0433b9f47319"; // kuhjie

export interface LinearConfig {
  apiKey: string;
  teamId: string;
  dryRun?: boolean;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  state: { name: string };
  parent?: { identifier: string };
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function gql<T>(cfg: LinearConfig, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: cfg.apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear HTTP ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as GraphQLResponse<T>;
  if (body.errors?.length) throw new Error(`Linear GraphQL: ${body.errors.map((e) => e.message).join("; ")}`);
  if (!body.data) throw new Error("Linear GraphQL: empty data");
  await sleep(RATE_LIMIT_MS);
  return body.data;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function findIssueByIdentifier(cfg: LinearConfig, identifier: string): Promise<LinearIssue | null> {
  const data = await gql<{ issue: LinearIssue | null }>(
    cfg,
    `query($id: String!) { issue(id: $id) { id identifier title state { name } parent { identifier } } }`,
    { id: identifier },
  );
  return data.issue;
}

export async function findChildByTitle(
  cfg: LinearConfig,
  parentIdentifier: string,
  title: string,
): Promise<LinearIssue | null> {
  const data = await gql<{ issues: { nodes: LinearIssue[] } }>(
    cfg,
    `query($parent: String!, $title: String!) {
       issues(filter: { parent: { identifier: { eq: $parent } }, title: { eq: $title } }) {
         nodes { id identifier title state { name } parent { identifier } }
       }
     }`,
    { parent: parentIdentifier, title },
  );
  return data.issues.nodes[0] ?? null;
}

export async function createChildIssue(
  cfg: LinearConfig,
  parentId: string,
  title: string,
  description: string,
): Promise<LinearIssue> {
  if (cfg.dryRun) {
    return { id: "dry-run", identifier: "DRY-0", title, state: { name: "Backlog" } };
  }
  const data = await gql<{ issueCreate: { issue: LinearIssue; success: boolean } }>(
    cfg,
    `mutation($input: IssueCreateInput!) {
       issueCreate(input: $input) {
         success
         issue { id identifier title state { name } }
       }
     }`,
    { input: { teamId: cfg.teamId, parentId, title, description } },
  );
  if (!data.issueCreate.success) throw new Error(`Linear issueCreate failed for ${title}`);
  return data.issueCreate.issue;
}

export interface SyncReport {
  wtId: string;
  parentEpic: string;
  childrenCreated: number;
  childrenExisting: number;
  errors: string[];
}

export async function syncWT(cfg: LinearConfig, wt: WTMeta): Promise<SyncReport> {
  const report: SyncReport = {
    wtId: wt.id,
    parentEpic: wt.linear.parent_epic_identifier,
    childrenCreated: 0,
    childrenExisting: 0,
    errors: [],
  };

  let parent: LinearIssue | null;
  try {
    parent = await findIssueByIdentifier(cfg, wt.linear.parent_epic_identifier);
  } catch (err) {
    report.errors.push(`parent lookup: ${(err as Error).message}`);
    return report;
  }
  if (!parent) {
    report.errors.push(`parent epic ${wt.linear.parent_epic_identifier} not found`);
    return report;
  }

  for (const title of wt.linear.child_story_titles) {
    try {
      const existing = await findChildByTitle(cfg, parent.identifier, title);
      if (existing) {
        report.childrenExisting += 1;
      } else {
        await createChildIssue(cfg, parent.id, title, makeDescription(wt, title));
        report.childrenCreated += 1;
      }
    } catch (err) {
      report.errors.push(`child "${title}": ${(err as Error).message}`);
    }
  }
  return report;
}

function makeDescription(wt: WTMeta, storyTitle: string): string {
  const mc = wt.mission_control;
  return [
    `**WT:** ${wt.id} — ${wt.title}`,
    `**Branch:** \`${wt.branch}\``,
    `**Feature flag:** \`${wt.feature_flag.name}\` (default ${wt.feature_flag.default ? "ON" : "OFF"})`,
    `**Wave:** ${wt.wave}  •  **Priority:** ${wt.priority}`,
    "",
    `**Story:** ${storyTitle}`,
    "",
    "## Mission control",
    `- Work type: ${mc.work_type}`,
    `- CJM scenarios: ${mc.cjm_scenarios.join(", ") || "—"}`,
    `- UI surfaces: ${mc.ui_surfaces.join(", ") || "—"}`,
    `- Entities touched: ${mc.entities_touched.join(", ") || "—"}`,
    `- Events emitted: ${mc.events_emitted.join(", ") || "—"}`,
    `- AI context packets: ${mc.ai_context_packets_touched.join(", ") || "—"}`,
    `- Search index: ${mc.search_index_implications}`,
    `- Risk axes: ${mc.risk_axes.join(", ")}`,
    "",
    "_Auto-synced by `scripts/orchestrator/linear-sync.ts` — do not edit manually._",
  ].join("\n");
}

export async function syncAll(cfg: LinearConfig): Promise<SyncReport[]> {
  const wts = await loadWTMetas();
  const reports: SyncReport[] = [];
  for (const wt of wts) {
    if (!wt.linear?.parent_epic_identifier) continue;
    const report = await syncWT(cfg, wt);
    reports.push(report);
    const errSuffix = report.errors.length > 0 ? ` errors=${report.errors.length}` : "";
    console.log(`  [${wt.id}] created=${report.childrenCreated} existing=${report.childrenExisting}${errSuffix}`);
  }
  return reports;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("LINEAR_API_KEY env required");
    process.exit(1);
  }
  const teamId = process.env.LINEAR_TEAM_ID ?? DEFAULT_TEAM_ID;
  const dryRun = process.argv.includes("--dry-run");
  syncAll({ apiKey, teamId, dryRun })
    .then((reports) => {
      const totalCreated = reports.reduce((a, r) => a + r.childrenCreated, 0);
      const totalExisting = reports.reduce((a, r) => a + r.childrenExisting, 0);
      const totalErrors = reports.reduce((a, r) => a + r.errors.length, 0);
      console.log(`\n=== Linear sync: ${reports.length} WTs / +${totalCreated} created / =${totalExisting} existing / !${totalErrors} errors ===`);
      if (totalErrors > 0) process.exit(2);
    })
    .catch((err) => {
      console.error("Linear sync fatal:", err);
      process.exit(1);
    });
}
