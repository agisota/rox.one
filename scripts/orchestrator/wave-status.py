#!/usr/bin/env python3
"""
wave-status.py — current state of all WTs.

Аутогрегирует данные из:
- wt-meta/wt-XX.yaml (definitions)
- git worktree list (local worktrees)
- gh pr list (open PRs)
- gh api repos/.../branches (remote branch existence)

Output formats:
  --format=table   (default) — human-readable table
  --format=md      — markdown table (suitable for PR description / Linear comment)
  --format=json    — machine-readable JSON

Usage:
  python3 scripts/orchestrator/wave-status.py
  python3 scripts/orchestrator/wave-status.py --wave=0
  python3 scripts/orchestrator/wave-status.py --format=md > docs/mission-control/STATUS.md
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
META_DIR = REPO_ROOT / "wt-meta"

def run_cmd(args, cwd=None):
    """Safe exec — no shell."""
    try:
        out = subprocess.run(args, cwd=cwd or str(REPO_ROOT), capture_output=True, text=True, timeout=30)
        return out.returncode, out.stdout, out.stderr
    except Exception as e:
        return 1, "", str(e)

def load_wt_metas():
    metas = []
    for f in sorted(META_DIR.glob("wt-*.yaml")):
        try:
            d = yaml.safe_load(f.read_text())
            if isinstance(d, dict) and d.get("id", "").startswith("WT-"):
                metas.append(d)
        except Exception:
            pass
    return metas

def get_local_worktrees():
    code, out, _ = run_cmd(["git", "worktree", "list", "--porcelain"])
    if code != 0:
        return {}
    worktrees = {}
    cur = {}
    for line in out.splitlines():
        if line.startswith("worktree "):
            cur = {"path": line.split(" ", 1)[1]}
        elif line.startswith("branch "):
            cur["branch"] = line.split(" ", 1)[1].replace("refs/heads/", "")
        elif line.startswith("HEAD "):
            cur["head"] = line.split(" ", 1)[1]
        elif line == "":
            if "branch" in cur:
                worktrees[cur["branch"]] = cur
            cur = {}
    if "branch" in cur:
        worktrees[cur["branch"]] = cur
    return worktrees

def get_open_prs(fetch_ci=False, fetch_commits=True):
    """List open PRs. `commits` and `statusCheckRollup` exceed GraphQL node limit for full
    list — fetched separately per PR if asked."""
    code, out, _ = run_cmd([
        "gh", "pr", "list",
        "-R", "agisota/rox.one",
        "--state", "open",
        "--limit", "50",
        "--json", "number,title,headRefName,isDraft",
    ])
    if code != 0:
        return {}
    try:
        prs = json.loads(out)
    except Exception:
        return {}
    by_branch = {p["headRefName"]: p for p in prs}
    if fetch_commits or fetch_ci:
        wanted = "commits" + (",statusCheckRollup" if fetch_ci else "")
        for branch, p in by_branch.items():
            code, out, _ = run_cmd([
                "gh", "pr", "view", str(p["number"]),
                "-R", "agisota/rox.one",
                "--json", wanted,
            ])
            if code == 0:
                try:
                    j = json.loads(out)
                    if fetch_commits:
                        p["commits"] = j.get("commits") or []
                    if fetch_ci:
                        p["statusCheckRollup"] = j.get("statusCheckRollup") or []
                except Exception:
                    p["commits"] = []
                    p["statusCheckRollup"] = []
    return by_branch

def determine_phase(wt, pr):
    """Estimate workflow phase from PR signals."""
    if not pr:
        return "no-pr"
    commits = len(pr.get("commits", []))
    if commits == 0:
        return "no-commits"
    if commits == 1:
        return "scaffold"
    if commits <= 3:
        return "discovery/design"
    if commits <= 6:
        return "impl"
    if commits <= 10:
        return "verify"
    return "optimize"

def collect_status(wt, worktrees, prs):
    branch = wt.get("branch", "")
    wt_id = wt.get("id", "?")
    pr = prs.get(branch)
    wt_local = worktrees.get(branch)
    ci_summary = "—"
    if pr:
        checks = pr.get("statusCheckRollup", []) or []
        success = sum(1 for c in checks if (c.get("conclusion") == "SUCCESS" or c.get("state") == "SUCCESS"))
        failure = sum(1 for c in checks if (c.get("conclusion") == "FAILURE" or c.get("state") == "FAILURE"))
        pending = sum(1 for c in checks if (c.get("status") in ("IN_PROGRESS", "QUEUED") or c.get("state") == "PENDING"))
        if checks:
            ci_summary = f"{success}✓/{failure}✗/{pending}⏳"
    return {
        "id": wt_id,
        "title": wt.get("title", "")[:60],
        "wave": wt.get("wave"),
        "priority": wt.get("priority"),
        "branch": branch,
        "worktree": bool(wt_local),
        "pr": pr.get("number") if pr else None,
        "pr_draft": pr.get("isDraft") if pr else None,
        "commits": len(pr.get("commits", [])) if pr else 0,
        "ci": ci_summary,
        "phase": determine_phase(wt, pr),
    }

def render_table(rows):
    if not rows:
        return "(no WTs)"
    lines = []
    headers = ["WT", "Wave", "Pri", "PR", "Commits", "CI", "Phase", "Title"]
    widths = {h: len(h) for h in headers}
    formatted = []
    for r in rows:
        f = {
            "WT": r["id"],
            "Wave": str(r["wave"]),
            "Pri": r["priority"],
            "PR": f"#{r['pr']}" if r["pr"] else "—",
            "Commits": str(r["commits"]),
            "CI": r["ci"],
            "Phase": r["phase"],
            "Title": r["title"][:50],
        }
        formatted.append(f)
        for k, v in f.items():
            widths[k] = max(widths[k], len(v))

    fmt = "  ".join(f"{{:<{widths[h]}}}" for h in headers)
    lines.append(fmt.format(*headers))
    lines.append(fmt.format(*["-" * widths[h] for h in headers]))
    for f in formatted:
        lines.append(fmt.format(*[f[h] for h in headers]))
    return "\n".join(lines)

def render_md(rows):
    if not rows:
        return "(no WTs)"
    lines = ["| WT | Wave | Pri | PR | Commits | CI | Phase | Title |",
             "|---|---|---|---|---|---|---|---|"]
    for r in rows:
        pr_link = f"[#{r['pr']}](https://github.com/agisota/rox.one/pull/{r['pr']})" if r["pr"] else "—"
        lines.append(f"| **{r['id']}** | {r['wave']} | {r['priority']} | {pr_link} | {r['commits']} | {r['ci']} | `{r['phase']}` | {r['title']} |")
    return "\n".join(lines)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--format", choices=["table", "md", "json"], default="table")
    ap.add_argument("--wave", type=int, default=None)
    ap.add_argument("--priority", default=None)
    ap.add_argument("--with-ci", action="store_true", help="Fetch CI status (slower, ~1 API call per PR)")
    args = ap.parse_args()

    metas = load_wt_metas()
    worktrees = get_local_worktrees()
    prs = get_open_prs(fetch_ci=args.with_ci)

    rows = [collect_status(wt, worktrees, prs) for wt in metas]
    if args.wave is not None:
        rows = [r for r in rows if r["wave"] == args.wave]
    if args.priority is not None:
        rows = [r for r in rows if r["priority"] == args.priority]
    rows.sort(key=lambda r: (r["wave"] or 99, r["id"]))

    if args.format == "json":
        print(json.dumps(rows, indent=2))
    elif args.format == "md":
        print(f"# WT Status — {len(rows)} WTs\n")
        print(render_md(rows))
    else:
        print(f"=== WT Status — {len(rows)} WTs ===\n")
        print(render_table(rows))
        print()
        with_pr = sum(1 for r in rows if r["pr"])
        with_local = sum(1 for r in rows if r["worktree"])
        with_progress = sum(1 for r in rows if r["commits"] > 1)
        print(f"Summary: {with_local}/{len(rows)} worktrees / {with_pr}/{len(rows)} PRs open / {with_progress}/{len(rows)} с прогрессом (>1 commit)")

if __name__ == "__main__":
    main()
