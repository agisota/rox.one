/**
 * featurebase-sync.ts — Featurebase v2 client for per-WT post + changelog sync.
 *
 * Per WT: ensures a post exists on the right board (Wishlist/Bugs/Frictionless UX/Compounding/B2B),
 * keyed by `featurebase.post_alias`. On ship status → creates changelog entry (singular endpoint
 * `/v2/changelogs/{id}/publish` with body `{sendEmail: false}`).
 *
 * Env: FEATUREBASE_API_KEY (required).
 * Endpoint quirks:
 *   - LIST uses `/v2/changelog` (singular)
 *   - INDIVIDUAL uses `/v2/changelogs/{id}` (PLURAL)
 *   - `publish` action requires body `{sendEmail: false}`.
 * Discovered through probing — see memory `project_featurebase_api_quirks`.
 */

import { loadWTMetas, type WTMeta } from "./state.js";

const FB_API = "https://do.featurebase.app/v2";
const RATE_LIMIT_MS = 250;

export interface FBConfig {
  apiKey: string;
  dryRun?: boolean;
}

export interface FBPost {
  _id: string;
  title: string;
  alias?: string;
  postCategory?: string;
  status?: string;
}

async function fb<T>(cfg: FBConfig, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${FB_API}${path}`, {
    method,
    headers: {
      "X-API-Key": cfg.apiKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`FB ${method} ${path} → ${res.status}: ${await res.text()}`);
  await sleep(RATE_LIMIT_MS);
  return (await res.json()) as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function findPostByAlias(cfg: FBConfig, boardId: string, alias: string): Promise<FBPost | null> {
  const data = await fb<{ posts: FBPost[] }>(cfg, "GET", `/posts?board=${boardId}&alias=${encodeURIComponent(alias)}`);
  return data.posts?.find((p) => p.alias === alias) ?? null;
}

export async function createPost(cfg: FBConfig, boardId: string, alias: string, title: string, body: string): Promise<FBPost> {
  if (cfg.dryRun) return { _id: "dry", title, alias };
  const data = await fb<{ post: FBPost }>(cfg, "POST", `/posts`, {
    boardId,
    title,
    content: body,
    alias,
  });
  return data.post;
}

export async function updatePostStatus(cfg: FBConfig, postId: string, status: string): Promise<void> {
  if (cfg.dryRun) return;
  await fb(cfg, "PATCH", `/posts/${postId}`, { status });
}

export async function createChangelog(cfg: FBConfig, title: string, body: string, postIds: string[]): Promise<string> {
  if (cfg.dryRun) return "dry-changelog-id";
  const data = await fb<{ changelog: { _id: string } }>(cfg, "POST", `/changelog`, {
    title,
    content: body,
    linkedPosts: postIds,
    state: "draft",
  });
  return data.changelog._id;
}

export async function publishChangelog(cfg: FBConfig, changelogId: string): Promise<void> {
  if (cfg.dryRun) return;
  // PLURAL endpoint for individual resource; body required
  await fb(cfg, "POST", `/changelogs/${changelogId}/publish`, { sendEmail: false });
}

export interface FBSyncReport {
  wtId: string;
  alias: string;
  boardId: string;
  action: "created" | "found" | "skipped";
  postId?: string;
  error?: string;
}

export async function syncWT(cfg: FBConfig, wt: WTMeta): Promise<FBSyncReport> {
  const fb = wt.featurebase;
  if (!fb?.post_alias || !fb?.board_id) {
    return { wtId: wt.id, alias: "", boardId: "", action: "skipped", error: "no featurebase config" };
  }
  const report: FBSyncReport = { wtId: wt.id, alias: fb.post_alias, boardId: fb.board_id, action: "found" };
  try {
    const existing = await findPostByAlias(cfg, fb.board_id, fb.post_alias);
    if (existing) {
      report.action = "found";
      report.postId = existing._id;
    } else {
      const post = await createPost(cfg, fb.board_id, fb.post_alias, wt.title, makeBody(wt));
      report.action = "created";
      report.postId = post._id;
    }
  } catch (err) {
    report.error = (err as Error).message;
  }
  return report;
}

function makeBody(wt: WTMeta): string {
  const mc = wt.mission_control;
  return [
    `## ${wt.id} — ${wt.title}`,
    "",
    `**Branch:** \`${wt.branch}\`  •  **Wave:** ${wt.wave}  •  **Priority:** ${wt.priority}`,
    `**Feature flag:** \`${wt.feature_flag.name}\` (default ${wt.feature_flag.default ? "ON" : "OFF"})`,
    "",
    "### Mission control",
    `- Work type: ${mc.work_type}`,
    `- Heptabase parity: ${mc.heptabase_parity}`,
    `- Risk axes: ${mc.risk_axes.join(", ")}`,
    "",
    "_Auto-synced — for spec see `docs/superpowers/specs/`._",
  ].join("\n");
}

export async function syncAll(cfg: FBConfig): Promise<FBSyncReport[]> {
  const wts = await loadWTMetas();
  const reports: FBSyncReport[] = [];
  for (const wt of wts) {
    const report = await syncWT(cfg, wt);
    reports.push(report);
    const errSuffix = report.error ? ` (${report.error})` : "";
    console.log(`  [${wt.id}] ${report.action}${errSuffix}`);
  }
  return reports;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apiKey = process.env.FEATUREBASE_API_KEY;
  if (!apiKey) {
    console.error("FEATUREBASE_API_KEY env required");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");
  syncAll({ apiKey, dryRun })
    .then((reports) => {
      const created = reports.filter((r) => r.action === "created").length;
      const found = reports.filter((r) => r.action === "found").length;
      const skipped = reports.filter((r) => r.action === "skipped").length;
      const errors = reports.filter((r) => r.error).length;
      console.log(`\n=== FB sync: +${created} created / =${found} existing / -${skipped} skipped / !${errors} errors ===`);
      if (errors > 0) process.exit(2);
    })
    .catch((err) => {
      console.error("FB sync fatal:", err);
      process.exit(1);
    });
}
