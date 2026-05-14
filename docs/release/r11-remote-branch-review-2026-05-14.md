# R.11 Remote Branch Review Inventory - 2026-05-14

Status: OPERATOR REVIEW REQUIRED

This report is read-only evidence for the R.11 `remote-branch-review` blocker.
It does not authorize branch deletion, pruning, merging, preservation, or
cleanup.

Source command:

```bash
git ls-remote --heads origin
```

Summary:

- Total origin heads: 140
- Excluded from blocker count: `main`
- R.11 backup branch present: no
- Non-main/non-R.11-backup origin branches: 139
- Default disposition in this report: `operator-review-required`

## Branch Inventory

| Branch | SHA | Disposition |
| --- | --- | --- |
| `feat/M6-sqlite-persistence-adapter-v2` | `009eabac4c06eaa6e2df00b20200b93f332c28e0` | operator-review-required |
| `feat/T223-legacy-credential-fallback` | `039e624a7f65916c3129fc09845c3dc1f44a1f8e` | operator-review-required |
| `feat/M10-T236-line-numbers-gutter` | `03f72a30e1e9f6e117425c55e23a531e2b09f99a` | operator-review-required |
| `fix/sourcemap-hidden-in-prod` | `05b8028924c384d7da159351366fa83879155b07` | operator-review-required |
| `docs/M19-rc-documentation` | `061097fbefae3441bbf0b3987c5b349b89a432f5` | operator-review-required |
| `feat/M2-T232-audit-log-surface` | `06a669e00003836c61ea71beb15680ea2eaf0551` | operator-review-required |
| `feat/M8-durable-mission-scheduler` | `0997e671ae825e5c641cbdd3012b30824bc5d6a7` | operator-review-required |
| `docs/agent-workbench-suite-roadmap-goal` | `0c477de347e33fe1c79736adbae6041b42409820` | operator-review-required |
| `chore/T297-rebrand-prepush-ci-gate` | `0c8362be4fda0d4ce0dc9e490c33ee11896bdbde` | operator-review-required |
| `feat/M10-T238-voice-input-slot` | `0d5b8ed14dede550793fe6d89e2bec15674bef9b` | operator-review-required |
| `feat/M14-T246c-bootstrap-host-audit` | `0d816a88290006416420638f2ce87b866ea94ead` | operator-review-required |
| `feat/M8-T243rpc-missions-handlers` | `1451edbf424dcb070a78b96d8107530b21dfbd43` | operator-review-required |
| `feat/M8-T244sqlite-mission-store` | `14e5e7b751bc54e3829f82b80a71e878d914e8ce` | operator-review-required |
| `feat/M13-T038-input-validation-hardening` | `16debd1d8c7ec3e1ce865a055359bbb85e9abb1c` | operator-review-required |
| `feat/M13-T303-input-validation-hardening` | `16debd1d8c7ec3e1ce865a055359bbb85e9abb1c` | operator-review-required |
| `feat/M21-prep-changelog-release-template` | `17073c7a0906165d13f344c28b39346f542793a6` | operator-review-required |
| `feat/M10-T235b-emphasis-wiring` | `17b9adbda404d46eb9e451d6f75af01031eb360d` | operator-review-required |
| `feat/M10-composer-pillar-4-spec` | `17daf96fe6ce31b76d636c9df026dcce17406062` | operator-review-required |
| `feat/M18-T251-signed-build-workflow` | `18cc55cc1c947af772ec164afccfb5e1ea7f1257` | operator-review-required |
| `chore/markitdown-patch-cve-mitigation` | `193069bb68fa3fe91bd001b9b1f2262c46b31210` | operator-review-required |
| `chore/i18n-parity-and-sort-fixes` | `1de4712ffbe56746983283452991e8ec43258806` | operator-review-required |
| `feat/M13-T244-schema-reservation` | `1de7c985f55f1e67453ab6808bbe26b386b0e3e5` | operator-review-required |
| `feat/phase-1-1-c4-workspace-rpc-full-scope-migration` | `1e596c3551ca1ddd4a4d76b05c0f1b718219d42b` | operator-review-required |
| `docs/T338-readme-acks-repair` | `209c9fba4080337333f1735202b0bdc2fd7bbc11` | operator-review-required |
| `feat/phase-20-rc-scenarios` | `261f00b805ec51848edacf67fd4b620d64921c0e` | operator-review-required |
| `docs/readme-rox-one` | `265b8957eed871cd9c95765b8c1418f0c26da53f` | operator-review-required |
| `feat/M9-T272-experience-server-emit` | `28547e22471c50e5b2517bcd2092a05b35b39c8d` | operator-review-required |
| `test/network-interceptor-sse-edge-cases` | `2c2cd0fa6df20590dec9288ac66b8f02c02486cd` | operator-review-required |
| `feat/M3-prep-upstream-audit` | `2d3166090c8419bff74f8fd70eec3c17b33414de` | operator-review-required |
| `feat/M9-experience-layer-kernel-v2` | `2dafeaa36ebebcf472e72512940c2c77cc30aac5` | operator-review-required |
| `feat/M18-T254-linux-signed-build` | `2db915fbac43fdecd6f8389eee16c766198545aa` | operator-review-required |
| `feat/M13-T243-scope-forgery-property-tests` | `2eed0b516757efdf60f01212a6b78f26b40e4255` | operator-review-required |
| `test/auto-update-signature-verification` | `326a5b40912da0ab7c8129f8b168802105a76908` | operator-review-required |
| `feat/M14-T246d-composition-root-wire` | `35c36d58bd0d49e547087ec2a0e0630f87c7f4c4` | operator-review-required |
| `chore/pin-security-critical-deps` | `36d1c15f52ff82785ab8fd933f143f8c5dee11b2` | operator-review-required |
| `chore/rebrand-R9.5-allowlist-and-final-text` | `37f08f9aa83be9893022b3b21f634b7a2e907517` | operator-review-required |
| `feat/M14-observability-audit-trail` | `3af084726fb38e74f1ec0e77e20a84d4a231c0bb` | operator-review-required |
| `feat/audit-a2-runtime` | `3f07d6ba1f5ec98ba890f6970d34b851c6bd1e4a` | operator-review-required |
| `fix/auto-update-hardening` | `3fc2e3d1b311eb6617dd1b8156589cb17cc0bec6` | operator-review-required |
| `feat/M18-T252-windows-trust-boundary` | `40841fbf4b6d014c60a1868fc7e7dc2f1d55390d` | operator-review-required |
| `docs/tickets/T-LEGACY-THINK-SHIM` | `40a387121dad5079f216a94bfaecb29db3103904` | operator-review-required |
| `test/theme-cascade-persistence` | `4230492f85c19c95173be4b70262ff9f797af847` | operator-review-required |
| `chore/rebrand-R9-community-link-audit` | `4248731f5f642b55976779542e8ee64a7b2b2ea2` | operator-review-required |
| `feat/M10-T240cheatsheet-keyboard-overlay` | `44744e4094be97aafb0e17d4af9f0b9d75a770c9` | operator-review-required |
| `feat/audit-a3-taste` | `4540016a5dd1a0fb4e387abfd96c58b120708cba` | operator-review-required |
| `fix/lazy-load-react-pdf` | `46d352bdab57b2359922becba304a54cfb791560` | operator-review-required |
| `feat/M14-T246b-fileauditsink-host-wiring` | `4d0af5140b7e9a99a9d997e962058740d2df14fa` | operator-review-required |
| `feat/M14-T246-audit-wire-rbac-missions` | `4e3ac06dfaf168a6c7683cb4ec2e27933392d8b6` | operator-review-required |
| `feat/M11-T173-shiki-callsite-v2` | `4ed18e63207efb2b7c2b0ba4decd03fa07dcc4b9` | operator-review-required |
| `feat/rpc-med-risk-boundary-validators` | `50c49a41c6f42e08d5dc0da684b61b3988a1215b` | operator-review-required |
| `feat/M9-T273-experience-ipc-bridge` | `51ca5b6900095e71f03afccdd1e6c815c475777a` | operator-review-required |
| `feat/M2-T227-part2-roles-handler` | `55b35c4ce51c03825d483cbd4dadce066a2818d3` | operator-review-required |
| `chore/ci-sbom-secret-scan` | `5a5cbaea090f32efd0bb40f457741ce26b15bca9` | operator-review-required |
| `feat/f1-shiki-engine-swap` | `5f0f76694adee156d4a4dc95582ddf53d0fbc92d` | operator-review-required |
| `feat/M13-T071b-roles-rate-limiter` | `60a44818f00e182fdb1639da0815e5f52a2d93ff` | operator-review-required |
| `feat/M7-T242d-domain-orchestrator-client` | `653be7bb2e280776bc33a48394afef339949dfe9` | operator-review-required |
| `mac/rox-production-ready-rc` | `65ff6e8568311ddd52d82fd832bd13e5c9bd8b26` | operator-review-required |
| `feat/M10-T239-voice-asr-webspeech` | `68cfa9c24ef29ea185d125f9ecd7ef2f9ed094b6` | operator-review-required |
| `docs/c4-multi-tenant-storage-isolation-design` | `68dd395a178fca74d437d2ffa3ee5856433d1f6e` | operator-review-required |
| `chore/rebrand-R7-docker-ci-build` | `6f540bf3a47ee941ebaade9d3c20fd37222867da` | operator-review-required |
| `chore/slash-mention-rtl-cleanup` | `72075048e9d2f448948eb2e6b6f924c887fe7d83` | operator-review-required |
| `feat/audit-a1-static` | `7607f361ad08786d019f7b453bb32efc7f655714` | operator-review-required |
| `feat/d-a11y-perf-budgets` | `788f3bdb39ea829bd0ae028e35ca0707c00541fc` | operator-review-required |
| `feat/M13-T086b-budget-guard-wiring` | `7a0f119e4c3661050bc440251c6e17d938881d28` | operator-review-required |
| `feat/M18-mac-trust-boundary` | `7a8b415fce65f013bba7556d42cfca6d3b4f8d33` | operator-review-required |
| `test/settings-pages-a11y-baseline` | `7b550f5eca92070988a0f0942c55200c93a57d85` | operator-review-required |
| `feat/chat-page-a11y-and-error-boundary` | `7bb41191e8e8d2137b0b370ad655c72b37ba89e3` | operator-review-required |
| `feat/M13-T052-integrity-pass` | `7d83f7f909d775c723018c3e90f349da94e44a26` | operator-review-required |
| `chore/icon-cache-useEntityIcon-migration` | `7e4215fb257190c3a61506444e9b441c7687e676` | operator-review-required |
| `test/T255-stabilization-edge-cases` | `7f48f01d8aaf62d2658f4bb0ac73daa09c50acd2` | operator-review-required |
| `feat/M7-T242b-renderer-orchestrator-hook` | `805b4f3eaa1e850e46a0072720b723ec70521f5b` | operator-review-required |
| `feat/M13-T086c-remaining-handlers-abuse-guard` | `80e53142a0b56533d901d3c62e92468958139f80` | operator-review-required |
| `feat/M12-visual-polish-v2-v2` | `81cec70a277928b6fb2baaeb695650daabe91c32` | operator-review-required |
| `feat/M17-private-release-pipeline` | `8298e0983dba1de7739bffee380f1ff0d43fed94` | operator-review-required |
| `feat/M17-private-release-pipeline-v2` | `85da6b90dd95a58589154af4ffca0294ed7cc32e` | operator-review-required |
| `feat/T249-csp-zod-boundary-hardening-v2` | `85f55545321d113ec6ba2bd3b3f3b320ede7701a` | operator-review-required |
| `feat/M11-T174-delete-legacy-highlighter` | `86a9a6de1609c9beca798511222b542c4859bb37` | operator-review-required |
| `feat/M10-T237b-image-resize` | `8b709cf6b0c1bcfc8cd305da3440f842058da1b0` | operator-review-required |
| `fix/a11y-muted-foreground-wcag-1-4-3` | `8d6198a2d1221f0178a53508bd125e5a282b6ddd` | operator-review-required |
| `feat/T132-code-split-index-chunk` | `9038a9b4358b8e9f42ddcad7580ba155873ebf51` | operator-review-required |
| `feat/M6-sqlite-persistence-adapter` | `9061116cc3dcf91c2b138c138f08f62038e60488` | operator-review-required |
| `docs/adr-0107-0111-infrastructure` | `945b7cf0d844c9d4e1f38925bc29c0b5a455338c` | operator-review-required |
| `feat/M14-T249-audit-retention` | `9582c0979d7c8a90db0ed652671471c8b27441b2` | operator-review-required |
| `final/composer-ux-integration-20260513` | `980a46081a6e894107740c941f577797ac969fc4` | operator-review-required |
| `test/browser-pane-cdp-integration` | `98944f14df182b3751faa9c4d8261701651b1cbb` | operator-review-required |
| `fix/workspace-sync-followups-pr167` | `99b3fc06f5c04db536f0a368141b64133f85b837` | operator-review-required |
| `feat/M14-T246-audit-wire` | `9f71524b842f26fb3d6030844317f26279a3b2fb` | operator-review-required |
| `chore/rebrand-R6-env-var-shim` | `9fbfb256d33d10d54b97121542ac91e70bbd5966` | operator-review-required |
| `feat/M2-T231-team-management-view-v3` | `a0961c93bd1a6a3fd575092e206b7cb7771c5a24` | operator-review-required |
| `docs/keyboard-nav-spec-template` | `a3931fff426d5a272f9e3d528624fefcee10941e` | operator-review-required |
| `feat/M20-T298-rc-validation-preflight` | `a5c9c7a8f40d9ee091cadb984b65a154e131118e` | operator-review-required |
| `backup/agent-workbench-t000-t012-2026-04-30` | `a6313121608df3b262fd6bc91ce667d2ffd72a00` | operator-review-required |
| `feat/M13-T071c-missions-rate-limiter` | `a769839406ff569aa2d70db67664fdcf4623158e` | operator-review-required |
| `feat/M7-real-provider-orchestration` | `a957217d24e3686d0a1f4a60a53288a752652672` | operator-review-required |
| `feat/M7-T241adapters-provider-implementations` | `ad5810046c644760fe4f135e25a6add1c961c97c` | operator-review-required |
| `chore/rebrand-R8-user-data-migration` | `aeee2d3ce46d58f8bfa01b9a663c9dce77df1c96` | operator-review-required |
| `feat/M7-T242c-composer-orchestrator-wire` | `afcc7efd95d380f845fb973ac36ac4b727845d11` | operator-review-required |
| `test/M20-T298c-rc-scenario-s09-s10` | `b0a356dde1511dcf8491ec1af59e57d7190216c1` | operator-review-required |
| `chore/opus-4-6-sunset` | `b0b049ad3fbd7eb97d9580d6d2f445c03cb13e42` | operator-review-required |
| `feat/M4-account-session-persistence` | `b278e83fb86e3912f332d73d469e21fc06aa9c3b` | operator-review-required |
| `test/automation-telegram-topic-routing` | `b31b3e1e75d45d716ea91d759b9096adbdada379` | operator-review-required |
| `feat/M14-T248-file-audit-sink` | `b338def127163382207be46a7e9bfff1662d8b5f` | operator-review-required |
| `feat/M13-T071-abuse-hardening` | `b36c9510c2c9714ebdcd1895fa69a3fb7fe96a1f` | operator-review-required |
| `feat/M2-T227-rbac-admin-rpc` | `b41389196ce27f526aaf92367df90edde1c4caaa` | operator-review-required |
| `fix/deep-link-weaknesses-pr173` | `b4eb5122de5b83e1ef15bb3ba8825d56170f63fb` | operator-review-required |
| `chore/rebrand-R10-final-sweep-and-gate` | `b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99` | operator-review-required |
| `feat/M20-T298b-rc-preflight-runner` | `b828d09d4a47a400e22a39c1f2b434a806539b35` | operator-review-required |
| `fix/vite-build-correlation-async-hooks` | `b941a28d4349baeca66913457413612e831e5c67` | operator-review-required |
| `feat/M2-T226-rbac-resolver` | `ba45e796f2749cc9fc62dbbca06b2791875d47e7` | operator-review-required |
| `feat/audit-a4-e2e-flows` | `be94413027a818e3d8874f0cbaa6d840afd363c9` | operator-review-required |
| `docs/M13-adr-sweep-security` | `c24b7d393d0247db9c46dc07714d00cdb3a0f61d` | operator-review-required |
| `chore/remove-deprecated-skill-mention-deadcode` | `c5c0c096e2a5a65bd3729498b93f60620000c45a` | operator-review-required |
| `feat/M9-T271-experience-hook` | `c5ca7041ab236dd9558e401a20adff1d8a3e6d09` | operator-review-required |
| `test/deep-link-protocol-handler` | `c7477613ed974f95ede6ba72e8b4cb888e5624f3` | operator-review-required |
| `docs/T223-tenant-credential-key-derivation` | `ca94bf5c687b91e053c29731dbd27b101621a2b3` | operator-review-required |
| `feat/M10-T237-paste-image-preview` | `ca9c5ee27392d0f466f5be0b332daf29a7b1f886` | operator-review-required |
| `feat/per-route-error-boundaries` | `cdd3afe82dc93c12945f0400c4857e4c623fbe2d` | operator-review-required |
| `feat/M2-rbac-foundation` | `d340836517129faa54a614baa580d01d07ef8e32` | operator-review-required |
| `docs/rc-s08-validation-blocker` | `d8c5e34bb7ef91f6b24092018441fa97174b008e` | operator-review-required |
| `fix/parse-server-url-by-delimiter` | `da3fd3505d3084d4da8d027ac6673a6978bd1a57` | operator-review-required |
| `feat/M13-T086-rpc-integration-v2` | `da9e98ef8b5e4f100332a045f5e76cdce0a8c4b9` | operator-review-required |
| `test/workspace-sync-multi-client-conflict` | `dcf6d03fc4ff2631a64208101b9586fc08c348b0` | operator-review-required |
| `chore/playground-dev-only-and-codesplit-plan` | `dd34436bf2b08dcbd6972c2e909fcc95198f75fe` | operator-review-required |
| `feat/audit-harness-spec` | `de58568133464d9e62f191a3d2c3d5b107bbfaad` | operator-review-required |
| `feat/M11-shiki-migration` | `e049606b2ec1585c5fb339caf27b29a03bbf591f` | operator-review-required |
| `feat/M7-T242-orchestrator-host-composition` | `e1043fc3e729642421ccb9b3f7bb20197c8ff647` | operator-review-required |
| `feat/browser-hung-tab-detection` | `e433017d9c442987669b2d39125ba51619aab8de` | operator-review-required |
| `feat/M8-T244b-mission-store-host` | `e6810bfaaef42675efca95a73cab8e15c386f612` | operator-review-required |
| `test/edit-popover-focus-trap-a11y` | `e70a42e02ac6bc2e808f9dc487f907c48eb97c4a` | operator-review-required |
| `chore/rename-t355-m21-to-t356` | `ef8b5ad56252bc33f98881fdbe6f755f55d5f32e` | operator-review-required |
| `feat/M16-bundle-budget` | `efb9e5ad3026ce29ee7696c1329a4e9ada678b91` | operator-review-required |
| `fix/user-data-migration-rox-agent-priority` | `f05d4c7c9085e1c77e26ab5616020faf478123e2` | operator-review-required |
| `docs/v1-release-prep` | `f22a6d6dd7eb9cd0e8922170075ba481efb04a6b` | operator-review-required |
| `chore/deps-cve-overrides` | `f3175b90f161aad08590eac706a284e13e964e36` | operator-review-required |
| `chore/bundle-shrinkage-findings` | `f3c00f2700b854b4e939b6822a5854350e9c452a` | operator-review-required |
| `docs/rebrand-sweep-goal-2026-05-13` | `f6d8030266bbe686df24c9141f88d4d92afd531d` | operator-review-required |
| `feat/M18-T253-linux-trust-boundary` | `f9c31097a56b0e263b86cc466cefd0db9150aa8b` | operator-review-required |
| `feat/M10-T235-emphasis-toolbar-v3` | `fba91da413addfea583d42b90f2e881f827a94e8` | operator-review-required |
| `feat/audit-harness-aggregate` | `fcac8b3c4a1036dc5615c667a996222bbdb962df` | operator-review-required |
