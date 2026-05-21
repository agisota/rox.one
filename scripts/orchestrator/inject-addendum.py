#!/usr/bin/env python3
"""
Inject "## 23. Mission control axes" addendum into 40 existing WT specs
+ `mission_control:` block into 40 existing wt-meta yamls.

Per WT-XX maps below — defaults populated based on WT scope analyzed from earlier work.
Idempotent: skips if "## 23. Mission control axes" already present.

Run from repo root:
    python3 scripts/orchestrator/inject-addendum.py
"""
from pathlib import Path
import re

REPO = Path(__file__).resolve().parents[2]
SPECS = REPO / "docs" / "superpowers" / "specs"
META = REPO / "wt-meta"

# Per-WT mission control config — populated from earlier work_type analysis
# Format: WT-XX: {work_type, ui_surfaces[], entities_touched[], events_emitted[],
#                 ai_packets[], search_impl, heptabase_parity, risk_axes[], cjm_scenarios[]}
WT_CONFIG = {
    "WT-00": {"work_type": "process", "ui_surfaces": [], "entities": [], "events": [],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["release"], "cjm": []},
    "WT-01": {"work_type": "integration", "ui_surfaces": [], "entities": [], "events": ["release.published", "artifact.uploaded"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["release", "security"], "cjm": []},
    "WT-02": {"work_type": "refactor", "ui_surfaces": [], "entities": [], "events": ["design.runtime.started", "design.runtime.crashed"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["security", "release"], "cjm": []},
    "WT-03": {"work_type": "new_module", "ui_surfaces": ["TopBar", "RoxDesignPage"], "entities": [], "events": ["design.button.clicked"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["UI"], "cjm": ["open-rox-design-from-topbar"]},
    "WT-04": {"work_type": "new_module", "ui_surfaces": [], "entities": ["User", "Identity"], "events": ["user.created", "user.updated"],
              "ai_packets": ["user-context"], "search_impl": "index", "heptabase": "N/A",
              "risks": ["data", "security"], "cjm": []},
    "WT-05": {"work_type": "new_module", "ui_surfaces": [], "entities": ["Tenant", "Organization"], "events": ["tenant.created"],
              "ai_packets": [], "search_impl": "index", "heptabase": "N/A",
              "risks": ["data", "security"], "cjm": []},
    "WT-06": {"work_type": "new_module", "ui_surfaces": [], "entities": ["Workspace", "Team", "Membership"], "events": ["workspace.created", "team.created"],
              "ai_packets": ["workspace-context"], "search_impl": "index", "heptabase": "Workspace isolation",
              "risks": ["data", "security"], "cjm": []},
    "WT-07": {"work_type": "new_module", "ui_surfaces": [], "entities": ["Entitlement", "FeatureFlag", "QuotaAccount"], "events": ["entitlement.granted", "quota.exceeded"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["data", "security"], "cjm": []},
    "WT-08": {"work_type": "new_module", "ui_surfaces": [], "entities": ["AuditEvent", "TelemetryEvent"], "events": ["foundational-emit-policy"],
              "ai_packets": [], "search_impl": "index", "heptabase": "Object history/changelog",
              "risks": ["data", "security"], "cjm": []},
    "WT-09": {"work_type": "integration", "ui_surfaces": [], "entities": [], "events": [],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["data"], "cjm": []},
    "WT-10": {"work_type": "new_module", "ui_surfaces": [], "entities": ["AccessJWT"], "events": ["auth.jwt.validated", "auth.jwt.rejected"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["security", "data"], "cjm": ["enterprise-sso-login"]},
    "WT-11": {"work_type": "new_module", "ui_surfaces": [], "entities": ["SCIMUser", "SCIMGroup"], "events": ["scim.user.upserted", "scim.user.deactivated"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["security", "data"], "cjm": []},
    "WT-12": {"work_type": "new_module", "ui_surfaces": [], "entities": ["AccountLink"], "events": ["account.linked", "account.jit_provisioned"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["security", "data"], "cjm": ["account-link-flow"]},
    "WT-13": {"work_type": "new_module", "ui_surfaces": ["UsernameClaimDialog"], "entities": ["UsernameReservation"], "events": ["username.claimed", "username.released"],
              "ai_packets": [], "search_impl": "index", "heptabase": "N/A",
              "risks": ["data"], "cjm": ["claim-username"]},
    "WT-14": {"work_type": "new_module", "ui_surfaces": [], "entities": ["Role", "PolicyRule"], "events": ["role.assigned"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["security"], "cjm": []},
    "WT-15": {"work_type": "new_module", "ui_surfaces": ["InviteFlow"], "entities": ["Membership", "InviteToken"], "events": ["membership.created", "invite.sent", "invite.accepted"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["security", "data"], "cjm": ["invite-teammate", "accept-invite"]},
    "WT-16": {"work_type": "spike", "ui_surfaces": [], "entities": [], "events": [],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["security", "data"], "cjm": []},
    "WT-17": {"work_type": "new_module", "ui_surfaces": ["RolesPage", "GrantsPage", "AuditPage"], "entities": [], "events": ["role.changed"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["security", "UI"], "cjm": ["admin-manage-roles"]},
    "WT-18": {"work_type": "new_module", "ui_surfaces": ["AuditLogQuery"], "entities": [], "events": ["audit.queried"],
              "ai_packets": [], "search_impl": "index", "heptabase": "N/A",
              "risks": ["security", "perf"], "cjm": ["admin-search-audit"]},
    "WT-19": {"work_type": "integration", "ui_surfaces": [], "entities": ["EmailProvider"], "events": ["email.sent", "email.bounced"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["data", "security"], "cjm": []},
    "WT-20": {"work_type": "new_module", "ui_surfaces": [], "entities": ["EmailTemplate"], "events": ["template.rendered"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["data"], "cjm": []},
    "WT-21": {"work_type": "new_module", "ui_surfaces": ["NotificationPrefsPage"], "entities": ["NotificationPreference"], "events": ["pref.changed"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["UI", "data"], "cjm": ["manage-notification-prefs"]},
    "WT-22": {"work_type": "integration", "ui_surfaces": [], "entities": ["MailboxProvisioning"], "events": ["mailbox.provisioned"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["security", "data"], "cjm": ["provision-domain-mailbox"]},
    "WT-23": {"work_type": "new_module", "ui_surfaces": [], "entities": ["ObjectStore"], "events": ["object.uploaded", "object.deleted"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["data", "security"], "cjm": []},
    "WT-24": {"work_type": "new_module", "ui_surfaces": [], "entities": ["QuotaAccount"], "events": ["quota.warn", "quota.exceeded"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["data"], "cjm": []},
    "WT-25": {"work_type": "new_module", "ui_surfaces": [], "entities": ["ObjectHash"], "events": ["object.deduped"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["data", "perf"], "cjm": []},
    "WT-26": {"work_type": "new_module", "ui_surfaces": [], "entities": ["BackupJob"], "events": ["backup.created", "restore.completed"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["data", "release"], "cjm": []},
    "WT-27": {"work_type": "new_module", "ui_surfaces": [], "entities": ["ObjectVersion"], "events": ["object.soft_deleted", "object.restored"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["data"], "cjm": []},
    "WT-28": {"work_type": "new_module", "ui_surfaces": [], "entities": ["CoordinatorAgent"], "events": ["agent.spawned", "agent.hibernated"],
              "ai_packets": ["coordinator-state"], "search_impl": "N/A", "heptabase": "AI Tutor/Chat",
              "risks": ["data", "perf"], "cjm": []},
    "WT-29": {"work_type": "new_module", "ui_surfaces": [], "entities": ["AgentRun", "AgentTask"], "events": ["task.completed", "task.failed", "branch.retried"],
              "ai_packets": ["dag-state"], "search_impl": "index", "heptabase": "N/A",
              "risks": ["data", "perf"], "cjm": ["run-multi-step-task"]},
    "WT-30": {"work_type": "new_module", "ui_surfaces": [], "entities": ["TaskQueue"], "events": ["task.queued", "task.consumed"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["perf"], "cjm": []},
    "WT-31": {"work_type": "new_module", "ui_surfaces": [], "entities": ["WSStream"], "events": ["ws.connected", "ws.disconnected", "ws.replay"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["perf", "data"], "cjm": []},
    "WT-32": {"work_type": "new_module", "ui_surfaces": [], "entities": ["Evidence", "Artifact"], "events": ["evidence.stored"],
              "ai_packets": ["evidence-refs"], "search_impl": "index", "heptabase": "N/A",
              "risks": ["data", "security"], "cjm": []},
    "WT-33": {"work_type": "refactor", "ui_surfaces": ["ComposerPanel", "ModeSegmentedControl"], "entities": [], "events": ["composer.mode.switched", "composer.submitted"],
              "ai_packets": ["composer-history"], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["UI", "perf"], "cjm": ["switch-composer-mode", "compose-prompt"]},
    "WT-34": {"work_type": "new_module", "ui_surfaces": ["AgentRunDAG", "Timeline"], "entities": [], "events": ["run.opened", "branch.retried.user_initiated"],
              "ai_packets": ["run-context"], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["UI", "perf"], "cjm": ["watch-agent-run", "retry-failed-branch", "approve-step"]},
    "WT-35": {"work_type": "new_module", "ui_surfaces": ["NotesPage", "NoteDetail"], "entities": ["Note"], "events": ["note.created"],
              "ai_packets": ["notes-context"], "search_impl": "index", "heptabase": "Notes/Cards approximation",
              "risks": ["UI", "data"], "cjm": ["create-note", "link-notes"]},
    "WT-36": {"work_type": "new_module", "ui_surfaces": ["TodayView", "FocusSession"], "entities": ["FocusSession"], "events": ["focus.started", "focus.completed"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "Journals adjacent",
              "risks": ["UI"], "cjm": ["start-focus-session", "daily-review"]},
    "WT-37": {"work_type": "new_module", "ui_surfaces": ["OnboardingTour", "EntitlementGate"], "entities": [], "events": ["onboarding.step.completed", "upgrade.cta.clicked"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["UI"], "cjm": ["first-user-onboarding", "hit-entitlement-gate"]},
    "WT-38": {"work_type": "refactor", "ui_surfaces": [], "entities": ["SourceDefinition"], "events": ["source.registered"],
              "ai_packets": [], "search_impl": "N/A", "heptabase": "N/A",
              "risks": ["data"], "cjm": []},
    "WT-39": {"work_type": "new_module", "ui_surfaces": ["MCPMarketplace"], "entities": ["MCPPack"], "events": ["pack.installed", "pack.uninstalled"],
              "ai_packets": [], "search_impl": "index", "heptabase": "N/A",
              "risks": ["security", "data"], "cjm": ["install-mcp-pack"]},
}


def make_spec_addendum(wt_id: str, cfg: dict) -> str:
    """Markdown addendum section."""
    return f"""

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** {cfg['work_type']}
- **CJM scenarios required:** {', '.join(cfg['cjm']) if cfg['cjm'] else 'N/A'}
- **UI surfaces affected:** {', '.join(cfg['ui_surfaces']) if cfg['ui_surfaces'] else 'N/A'}
- **Entities touched (WT-46 references):** {', '.join(cfg['entities']) if cfg['entities'] else 'N/A'}
- **Events emitted (WT-49 ActivityEvent):** {', '.join(cfg['events']) if cfg['events'] else 'N/A'}
- **AI context implications (WT-48):** {', '.join(cfg['ai_packets']) if cfg['ai_packets'] else 'N/A'}
- **Search index implications (WT-50):** {cfg['search_impl']}
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{{mac,win,linux}}/, observability/metrics.md
- **Heptabase parity:** {cfg['heptabase']}
- **Risk axes:** {', '.join(cfg['risks'])}
"""


def make_yaml_addendum(cfg: dict) -> str:
    """YAML mission_control: block."""
    def fmt_list(items):
        return "[" + ", ".join(items) + "]" if items else "[]"
    return f"""
mission_control:
  work_type: {cfg['work_type']}
  cjm_scenarios: {fmt_list(cfg['cjm'])}
  ui_surfaces: {fmt_list(cfg['ui_surfaces'])}
  entities_touched: {fmt_list(cfg['entities'])}
  events_emitted: {fmt_list(cfg['events'])}
  ai_context_packets_touched: {fmt_list(cfg['ai_packets'])}
  search_index_implications: {cfg['search_impl']}
  heptabase_parity: {cfg['heptabase']!r}
  risk_axes: {fmt_list(cfg['risks'])}
"""


def find_spec_path(wt_id_short: str) -> Path | None:
    """Find spec file by WT-XX prefix (e.g. 'wt-00' → 2026-05-21-wt-00-*.md)."""
    pattern = f"2026-05-21-{wt_id_short.lower()}-*.md"
    matches = list(SPECS.glob(pattern))
    if not matches:
        return None
    return matches[0]


def inject_spec_addendum(wt_id: str, cfg: dict) -> str:
    wt_short = wt_id.lower()
    spec_path = find_spec_path(wt_short)
    if not spec_path:
        return f"  ✗ {wt_id}: spec not found"
    text = spec_path.read_text(encoding="utf-8")
    if "## 23. Mission control axes" in text:
        return f"  ⊙ {wt_id}: addendum already present (skip)"
    addendum = make_spec_addendum(wt_id, cfg)
    spec_path.write_text(text.rstrip() + addendum, encoding="utf-8")
    return f"  ✓ {wt_id}: spec addendum added ({spec_path.name})"


def inject_yaml_addendum(wt_id: str, cfg: dict) -> str:
    wt_short = wt_id.lower()
    yaml_path = META / f"{wt_short}.yaml"
    if not yaml_path.exists():
        return f"  ✗ {wt_id}: yaml not found"
    text = yaml_path.read_text(encoding="utf-8")
    if "mission_control:" in text:
        return f"  ⊙ {wt_id}: yaml addendum already present (skip)"
    addendum = make_yaml_addendum(cfg)
    yaml_path.write_text(text.rstrip() + addendum, encoding="utf-8")
    return f"  ✓ {wt_id}: yaml addendum added"


def main():
    print(f"=== inject-addendum: {len(WT_CONFIG)} existing WTs ===\n")
    spec_results = []
    yaml_results = []
    for wt_id, cfg in WT_CONFIG.items():
        spec_results.append(inject_spec_addendum(wt_id, cfg))
        yaml_results.append(inject_yaml_addendum(wt_id, cfg))

    print("Spec files:")
    for r in spec_results:
        print(r)
    print("\nYaml files:")
    for r in yaml_results:
        print(r)

    spec_added = sum(1 for r in spec_results if "✓" in r)
    spec_skipped = sum(1 for r in spec_results if "⊙" in r)
    yaml_added = sum(1 for r in yaml_results if "✓" in r)
    yaml_skipped = sum(1 for r in yaml_results if "⊙" in r)
    print(f"\nSummary: {spec_added} spec added / {spec_skipped} skipped; {yaml_added} yaml added / {yaml_skipped} skipped")


if __name__ == "__main__":
    main()
