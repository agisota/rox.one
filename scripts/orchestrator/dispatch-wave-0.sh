#!/usr/bin/env bash
#
# dispatch-wave-0.sh — kick off Wave 0 implementation via isolated git worktrees.
#
# Usage:
#   ./scripts/orchestrator/dispatch-wave-0.sh                    # dry-run (default)
#   ./scripts/orchestrator/dispatch-wave-0.sh --apply            # actually create worktrees + PRs
#   ./scripts/orchestrator/dispatch-wave-0.sh --apply --only=WT-46  # one WT
#
# Each WT gets:
#   1. Isolated worktree at ../wt-<id>-<name>/
#   2. Branch checked out: feat/<branch from wt-meta yaml>
#   3. Initial TDD-scaffold commit (failing test, .gitkeep markers)
#   4. Draft PR opened to main с links to spec + mission-control + Linear epic
#
# Pre-flight checks:
#   - git working tree clean
#   - main is up to date with origin
#   - gh authenticated
#   - all 16 worktree paths free
#
# Wave 0 = WT-00..09 (foundation) + WT-45..50 (Object Platform), total 16.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

WAVE_0_IDS=(
  WT-00 WT-01 WT-02 WT-03 WT-04 WT-05 WT-06 WT-07 WT-08 WT-09
  WT-45 WT-46 WT-47 WT-48 WT-49 WT-50
)

APPLY=0
ONLY=""
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --only=*) ONLY="${arg#*=}" ;;
    --help)
      sed -n '2,/^$/p' "$0" | sed 's/^# *//'
      exit 0 ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

[[ -n "$ONLY" ]] && WAVE_0_IDS=("$ONLY")

# === pre-flight ===
echo "=== pre-flight checks ==="
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "✗ working tree dirty. Commit or stash first." >&2
  git status --short
  exit 1
fi
git fetch origin main >/dev/null
if [[ "$(git rev-parse main)" != "$(git rev-parse origin/main)" ]]; then
  echo "✗ local main not up to date with origin. git pull first." >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "✗ gh not authenticated. Run gh auth login." >&2
  exit 1
fi
echo "✓ pre-flight green"
echo ""

extract_yaml_field() {
  local file="$1" field="$2"
  python3 -c "
import sys, yaml
data = yaml.safe_load(open('$file').read())
v = data.get('$field')
if v is None: sys.exit(0)
if isinstance(v, dict) or isinstance(v, list):
    import json; print(json.dumps(v))
else:
    print(v)
"
}

# === for each WT ===
for wt_id in "${WAVE_0_IDS[@]}"; do
  yaml_path="wt-meta/${wt_id,,}.yaml"
  if [[ ! -f "$yaml_path" ]]; then
    echo "[$wt_id] ✗ yaml missing — skip"
    continue
  fi

  branch=$(extract_yaml_field "$yaml_path" "branch")
  worktree_path=$(extract_yaml_field "$yaml_path" "worktree_path")
  title=$(extract_yaml_field "$yaml_path" "title")
  feature_flag_name=$(python3 -c "
import yaml
d = yaml.safe_load(open('$yaml_path').read())
print(d.get('feature_flag', {}).get('name', '?'))
")
  linear_epic=$(python3 -c "
import yaml
d = yaml.safe_load(open('$yaml_path').read())
print(d.get('linear', {}).get('parent_epic_identifier', '?'))
")
  wave=$(extract_yaml_field "$yaml_path" "wave")
  priority=$(extract_yaml_field "$yaml_path" "priority")

  abs_worktree="$REPO_ROOT/${worktree_path#../}"
  # if worktree_path is `../wt-46-content-object`, abs = REPO_ROOT/wt-46-content-object (one level up — but we're inside repo)
  # Actually `..` means parent of REPO_ROOT. Let's recompute:
  parent_of_repo="$(dirname "$REPO_ROOT")"
  abs_worktree="$parent_of_repo/$(basename "$worktree_path")"

  echo "[$wt_id] $title"
  echo "    branch:    $branch"
  echo "    worktree:  $abs_worktree"
  echo "    flag:      $feature_flag_name"
  echo "    epic:      $linear_epic"
  echo "    wave $wave / $priority"

  if [[ "$APPLY" == "0" ]]; then
    echo "    (dry-run — pass --apply to execute)"
    echo ""
    continue
  fi

  if [[ -d "$abs_worktree" ]]; then
    echo "    ⊙ worktree exists — skip"
    echo ""
    continue
  fi

  # Check if branch exists on remote
  if git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
    echo "    branch exists on origin — checkout"
    git worktree add "$abs_worktree" "$branch" 2>&1 | sed 's/^/    /'
  else
    echo "    creating new branch from main"
    git worktree add -b "$branch" "$abs_worktree" main 2>&1 | sed 's/^/    /'
  fi

  (
    cd "$abs_worktree"
    # Create TDD scaffold placeholder — per-WT subfolder avoids merge conflicts on .wt-scaffold/README.md
    local wt_id_lower="${wt_id,,}"
    mkdir -p ".wt-scaffold/${wt_id_lower}"
    cat > ".wt-scaffold/${wt_id_lower}/README.md" <<MARKDOWN
# $wt_id Worktree

- **Branch:** \`$branch\`
- **Spec:** \`docs/superpowers/specs/2026-05-21-${wt_id,,}-*-design.md\`
- **Yaml:** \`wt-meta/${wt_id,,}.yaml\`
- **Mission control:** \`docs/mission-control/${wt_id,,}/\`
- **Linear epic:** $linear_epic
- **Feature flag:** \`$feature_flag_name\` (OFF by default)

## Phase progression (22-role swarm)

1. **Discovery** — brainstormer, requirements-keeper, scope-analyzer, critic, cjm-writer
2. **Design** — erd-writer, sequence-chart-writer, ui-inventory-writer, prompt-writer, ux-guru, data-refresh-rule-keeper
3. **Impl** — test-writer (TDD-first), implementer, super-coder, reviewer
4. **Verify** — verifier, critic, integrator (3-machine evidence required)
5. **Optimize** — optimizer, 10x-improver, observability-engineer, risk-board-tracker, dependency-graph-tracker

## Hard rules (from wt-meta)

- Touch ONLY \`files_allowed\` from yaml
- NEVER touch \`files_forbidden\` (use scaffold_request к owner)
- Tests FIRST commit must exist (TDD discipline)
- 3-machine verify mandatory before merge

## Merge gate (\`scripts/orchestrator/merge-gate.ts\`)

- typecheck/lint/tests exit 0
- evidence/{mac-14-arm,windows-2022,ubuntu-22}/{build.log,smoke-result.json}
- mission-control artifacts populated (cjm/, erd/, sequence/, ui-inventory/, observability/)
- definition_of_done в yaml all true
MARKDOWN

    git add ".wt-scaffold/${wt_id_lower}/README.md"
    git commit -m "chore($wt_id): scaffold worktree $abs_worktree

Bootstrap commit для Wave 0 dispatch — $title.

Spec: docs/superpowers/specs/2026-05-21-${wt_id,,}-*-design.md
Yaml: wt-meta/${wt_id,,}.yaml
Mission control: docs/mission-control/${wt_id,,}/

Next: 22-role swarm picks up from .wt-scaffold/${wt_id_lower}/README.md.
Discovery phase agents должны TDD-first написать failing tests under files_allowed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>" >/dev/null 2>&1

    git push -u origin "$branch" 2>&1 | tail -1 | sed 's/^/    /'

    gh pr create --draft -R agisota/rox.one --base main --head "$branch" \
      --title "[DRAFT] $wt_id: $title" \
      --body "## $wt_id

**Wave:** $wave • **Priority:** $priority • **Flag:** \`$feature_flag_name\` (OFF)

**Linked Linear epic:** $linear_epic

## Spec
- Design: [\`docs/superpowers/specs/2026-05-21-${wt_id,,}-*-design.md\`](https://github.com/agisota/rox.one/blob/main/docs/superpowers/specs/)
- Yaml: [\`wt-meta/${wt_id,,}.yaml\`](https://github.com/agisota/rox.one/blob/main/wt-meta/${wt_id,,}.yaml)
- Mission control: \`docs/mission-control/${wt_id,,}/\`

## Status

This is a **DRAFT** worktree PR opened by \`scripts/orchestrator/dispatch-wave-0.sh\`. 22-role swarm picks up from here.

### Phase tracker
- [ ] discovery (cjm-writer fills mission-control/cjm/, requirements-keeper, brainstormer, scope-analyzer, critic)
- [ ] design (erd-writer fills mission-control/erd/, sequence-chart-writer fills sequence/, ui-inventory-writer fills ui-inventory/, ux-guru, prompt-writer, data-refresh-rule-keeper)
- [ ] impl (test-writer TDD-first, implementer, super-coder, reviewer)
- [ ] verify (verifier, critic, integrator — 3-machine evidence required)
- [ ] optimize (optimizer, 10x-improver, observability-engineer fills observability/, risk-board-tracker, dependency-graph-tracker)

### Merge-gate readiness
- [ ] files_allowed/files_forbidden constraint respected (\`merge-gate.ts files-allowlist\`)
- [ ] typecheck/lint/tests exit 0
- [ ] evidence/{mac-14-arm,windows-2022,ubuntu-22}/ populated
- [ ] mission-control artifacts non-template (cjm/*.md, erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md, observability/metrics.md)
- [ ] definition_of_done в \`wt-meta/${wt_id,,}.yaml\` all true

🤖 Generated by \`scripts/orchestrator/dispatch-wave-0.sh\`" 2>&1 | tail -1 | sed 's/^/    /'
  )

  echo ""
done

echo "=== dispatch complete ==="
if [[ "$APPLY" == "0" ]]; then
  echo "Dry-run mode. Pass --apply to actually create worktrees + draft PRs."
else
  echo "All worktrees created. Inspect with:"
  echo "  git worktree list"
fi
