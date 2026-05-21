# Spike WT-42: Cloudflare RBI launch flow research

**Branch:** `spike/cloudflare-rbi`
**Type:** Research spike (NO merge to main, decision doc only)
**Status:** Pending research
**Time budget:** 3 days max

## 1. Objective

Определить, можно ли использовать Cloudflare Browser Isolation (RBI) как защищённый launch-flow для BYOD/внешних пользователей ROX.ONE: пользователь заходит через Cloudflare Access → Gateway → RBI рендерит ROX.ONE в изолированном remote browser, файлы/буфер обмена контролируются по policy. Выдать рекомендацию: integration plan, policy spec, стоимость per-user.

## 2. Background

В master vision Cloudflare RBI отщеплён от лумпованного WT-18 (RBI+mesh+cert) в отдельный spike, потому что **RBI это product/policy решение, а не technical integration** — ROX.ONE как Web App рендерится в любом браузере, вопрос только в политике доступа. Текущие assumptions:

- Use case: enterprise customer хочет, чтобы employees могли пользоваться ROX.ONE с personal devices, но без installation root cert / VPN / MDM (см. WT-43, WT-44).
- Cloudflare Zero Trust = Access (identity) + Gateway (DNS/HTTP filtering) + Browser Isolation (RBI).
- Cost: $7-$10/user/month за RBI seat (need verify on day 1).
- Policy controls: copy/paste in/out, file upload/download, printing, keyboard input — настраиваются per-policy.
- ROX.ONE как web app должен корректно работать в RBI pixel-pushing mode (canvas streaming, no DOM in client).

## 3. Key questions to answer

- Q1: Какова актуальная стоимость Cloudflare Zero Trust + RBI seat в 2026 на per-user/month? Есть ли minimum seat count? Volume discount?
- Q2: Работает ли ROX.ONE UI стабильно в RBI pixel-pushing mode без визуальных артефактов (canvas-heavy скрины, Composer, sources panel, drag-drop)?
- Q3: Какие фичи ROX.ONE ломаются в RBI: clipboard sync, file-drop, native deeplinks (`rox://`), Web Audio (TTS), WebRTC (если есть)? Что из этого можно опционально разрешить через policy?
- Q4: Можно ли в policy запретить **только** download/copy исходных данных пользователя из ROX (data exfiltration) но разрешить upload (чтобы агент имел контекст)? Какая гранулярность policy в Gateway?
- Q5: Как организовать SSO flow: IdP (Okta/Azure AD/Google Workspace) → Cloudflare Access → ROX.ONE с уже подставленным identity, без двойного login?
- Q6: Audit / logging: какие события (login, file upload, copy-out attempt) RBI пишет, как их забирать в наш audit-storage (WT-16)?
- Q7: Как пользователь _попадает_ в isolated session: invitation email → Access magic link → automatic RBI launch? Какая UX-копи на каждом шаге?
- Q8: Что произойдёт при RBI outage Cloudflare: graceful failover на direct access (с warning) или жёсткий block?

## 4. Research methodology

- **POC scope (≤1.5 дня):** реальный POC на Cloudflare Zero Trust trial:
  1. Поднять Cloudflare account + Access policy + RBI policy.
  2. Защитить test deploy ROX.ONE (staging URL).
  3. Залогиниться с personal device → RBI session → проверить UI работоспособность.
  4. Включить strict policy (no copy-out, no download) → проверить, что пользовательский сценарий "drop file into Composer" работает.
  5. Записать 90-second voice-over демо.
  POC живёт в `spike/cloudflare-rbi`, **не merge**.
- **Provider matrix (1 ряд):** только Cloudflare. Дополнительно для сравнения coverage: Menlo Security, Talon (Palo Alto), Island Browser — кратко, чтобы валидировать, что Cloudflare = best fit для нашего размера/бюджета.
- **Decision criteria:**
  1. UI ROX.ONE в RBI остаётся usable (subjective ≥4/5 на демо-сценариях).
  2. Стоимость ≤$10/user/mo @ 50 seats trial.
  3. Policy controls покрывают exfiltration prevention.
  4. SSO с минимум одним IdP работает out-of-the-box.
  5. Audit-logs доступны через API.
- **Time-boxed exploration:** 3 дня. День 1 — pricing/policy research + Cloudflare account. День 2 — POC + voice-over demo. День 3 — policy spec + integration plan + decision doc.

## 5. Expected deliverables

- `docs/spikes/WT-42/decision-doc.md` — recommendation, primary use-case (BYOD enterprise), pricing model, integration roadmap.
- `docs/spikes/WT-42/policy-spec.md` — proposed Cloudflare Gateway/Access/RBI policy: рекомендованные настройки для BYOD vs managed device, явные deny-list, audit-event mapping.
- `docs/spikes/WT-42/integration-plan.md` — что нужно изменить в ROX.ONE (или не нужно), как организовать onboarding для customer org, кто owner на customer side.
- `docs/spikes/WT-42/ui-compatibility-report.md` — отчёт по UI-ломкам в RBI mode, severity, workaround.
- (optional) 90-sec POC voice-over demo (link only, not in repo).

## 6. Stop conditions

- **Time budget exceeded:** записать что есть, явно flagging unverified policies в integration plan.
- **Cost prohibitive:** если actual pricing >$15/user/mo или есть minimum 100 seats — пересмотреть positioning (только enterprise SKU), не reject, но defer mass-market plan.
- **Tech impossibility:** если ROX.ONE UI ломается в RBI **критично** (composer не работает, drag-drop недоступен) — defer + создать issue "RBI compat fix" в backlog.
- **Cloudflare TOS toxic:** если в TOS Cloudflare видит наш traffic в plain (что ожидаемо для RBI) и нет no-resale-of-data clause → flag.

## 7. Risks

| Риск | Mitigation |
|---|---|
| RBI pixel-pushing ломает custom canvas/WebGL/драгндроп в Composer | UI-compat-report на день 2; если ломки критичны — создать "RBI-mode" build flag в ROX (отдельный WT, не этот spike). |
| Cost-per-user блокирует SMB/individual rollout | Позиционировать RBI как enterprise-only SKU; для BYOD-individual использовать WT-44 cert flow или direct access. |
| Vendor lock-in на Cloudflare | Документировать abstract policy spec, чтобы Menlo/Talon были drop-in replacement при необходимости. |
| Cloudflare outage = недоступность ROX для всех RBI users | Failover plan: direct access с org-level флагом "RBI required", graceful degradation. |
| Audit-logs Cloudflare несовместимы с нашим audit-schema (WT-16) | Подготовить ETL/normalizer как часть integration plan, не блокировать spike. |
| Performance latency через RBI неприемлемо для long composer sessions | Замерить TTI и input latency в POC; если >300ms input lag → flag. |
| Cloudflare меняет ценообразование Zero Trust | Зафиксировать revisit-at = +6 months. |

## 8. Linear mapping

- Research issue (type: Research), epic "Enterprise / Zero Trust".
- Title: `[Spike WT-42] Cloudflare RBI launch flow`.
- Status: Triage → In Progress → Done (when decision + policy spec + voice-over demo linked).
- Estimate: 3d.

## 9. Featurebase mapping

- **NOT published as roadmap post**.
- After decision (если implement): create **Enterprise** category post на Wishlist: "ROX.ONE for BYOD without device management" — high-level, без vendor name.
- Если reject: silent, NO post.

## 10. Outcome (filled after spike completes)

- **Decision:** _<implement | defer | reject>_
- **Cost @50 seats:** _$<n>/user/mo_
- **UI compatibility:** _<full | partial | blocked>_
- **Primary use-case:** _<BYOD enterprise | external contractor access | both>_
- **If implement:** _picked up by WT-?? (Wave 5 enterprise), target: <date>_
- **If defer:** _revisit-at: <date>, blocker: <cost | UI compat | low demand>_
- **If reject:** _rationale + alternative (e.g., browser extension policy, MDM-only)_
