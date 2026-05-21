# Spike WT-43: Cloudflare Mesh / NextDNS topology research

**Branch:** `spike/cloudflare-mesh-nextdns`
**Type:** Research spike (NO merge to main, decision doc only)
**Status:** Pending research
**Time budget:** 3 days max

## 1. Objective

Определить, как ROX.ONE может встроить device-level networking защиту: Cloudflare WARP / Cloudflare One mesh (device-to-device VPN) + NextDNS (managed DNS с фильтрацией) — в виде "приложение само ставит и держит конфиг" под admin-controlled tenant. Выдать топологию, status spec (как пользователь видит, что защита активна), и enterprise rollout plan для managed-device сценария.

## 2. Background

В master vision Cloudflare Mesh + NextDNS отщеплены от лумпованного WT-18 в отдельный spike, потому что **mesh/DNS — это admin/IT решение**, не enduser feature. Текущие assumptions:

- Mesh use case: enterprise tenant хочет, чтобы все агенты ROX.ONE на устройствах сотрудников ходили через corporate egress (для DLP/audit) и видели друг друга для P2P sync.
- NextDNS use case: блокировка malware/phishing/tracking доменов на уровне DNS, до того как агент LLM-flow зацепит зловредный домен.
- BYOD vs managed device — критическое различие. На BYOD silent install VPN/DNS = malware-like. На managed = OK через MDM.
- Cloudflare WARP может работать в "consumer" режиме (1.1.1.1) и в "Zero Trust" режиме (с org policy).
- NextDNS даёт API для programmatic profile management.

## 3. Key questions to answer

- Q1: Какой механизм enrollment device в Cloudflare WARP Zero Trust используется в 2026 (device posture, JWT, mTLS)? Можно ли его запустить из ROX.ONE app без отдельного MDM-flow?
- Q2: NextDNS: можно ли через API создать per-tenant profile, привязать к device, и доставить DNS-конфиг в ROX.ONE app без admin прав на машине (DNS-over-HTTPS application-level)? Или нужны system DNS settings (root прав)?
- Q3: Mesh topology: WARP-to-WARP device-to-device — это реально P2P или всё ходит через Cloudflare edge? Какие latency и privacy последствия?
- Q4: Что делать на macOS/Windows/Linux/iOS/Android — каждая платформа имеет свой mechanism (NetworkExtension, WFP, systemd-resolved, VPN profile API), какие из них доступны без root?
- Q5: Status UX: как пользователь в ROX.ONE видит "ваш трафик защищён через corporate egress" vs "вы вне корпоративной сети"? Какая иконка / dashboard / per-request indicator?
- Q6: BYOD сценарий: должна ли ROX.ONE _предлагать_ установить WARP (download link + опт-ин) или **никогда** не трогать system networking на BYOD? Где красная линия?
- Q7: Конфликт с user-installed VPN (Mullvad, ProtonVPN, корпоративный Cisco AnyConnect): как обнаружить и graceful coexist?
- Q8: Audit/observability: какие events (DNS query block, WARP tunnel state change) идут в наш audit (WT-16)? Какой формат export?
- Q9: GDPR/privacy: DNS-логи NextDNS — кто data controller (мы или customer org), где данные хранятся, какой retention?

## 4. Research methodology

- **POC scope (≤1 день):** demo на одной машине (managed-style):
  1. NextDNS profile через API + DoH endpoint в ROX.ONE (app-level resolver, no system change).
  2. Cloudflare WARP в Zero Trust mode на той же машине → проверить, что DNS идёт через NextDNS, HTTP — через Cloudflare egress.
  3. Записать observable status сигналы (latency, ip change, blocked domain attempt).
  POC живёт в `spike/cloudflare-mesh-nextdns`, **не merge**.
- **Topology evaluation matrix:** Platform × Scenario (BYOD/managed) × Capability (system DNS / app DNS / VPN / mesh) × Permission required × Verdict.
- **Decision criteria:**
  1. Managed-device сценарий покрыт ≥2 platforms.
  2. BYOD имеет clear "opt-in download" path, БЕЗ silent install.
  3. Status UX имеет минимум 3 чётких state (active/degraded/off).
  4. Audit-events извлекаемы через API.
  5. Cost ≤$5/user/mo combined (NextDNS Pro + Cloudflare Zero Trust seat).
- **Time-boxed exploration:** 3 дня. День 1 — topology + permission matrix. День 2 — POC + status UX mock. День 3 — enterprise rollout plan + decision.

## 5. Expected deliverables

- `docs/spikes/WT-43/decision-doc.md` — recommendation на topology + go/no-go + scope (managed-only vs managed+BYOD-opt-in).
- `docs/spikes/WT-43/topology.md` — диаграмма (Mermaid) с device → app DNS → NextDNS → Cloudflare WARP → internet, для managed и BYOD сценариев.
- `docs/spikes/WT-43/status-spec.md` — UX-spec: какие 3-5 states, копи, иконки, что показывать в settings, в Composer header.
- `docs/spikes/WT-43/enterprise-rollout-plan.md` — пошаговый план для customer org: что нужно на их стороне (admin consent, MDM profile templates), что у нас (API integration, onboarding flow).
- `docs/spikes/WT-43/permission-matrix.md` — таблица per-platform per-capability per-permission.
- (optional) demo voice-over.

## 6. Stop conditions

- **Time budget exceeded:** написать что есть, явно отметить platforms где POC не дошёл.
- **Permission impossibility:** если на 3+ platforms нельзя сделать DNS/VPN без root/admin прав даже для managed-device — **defer полностью**, документировать что нужен external MDM partnership.
- **Privacy concern:** если NextDNS логи становятся PII headache (we = data controller, EU residents) — flag и переоценить.
- **Cost prohibitive:** combined cost >$8/user/mo → reposition только под enterprise.
- **Vendor reliability:** если NextDNS uptime <99.9% по public reports → suggest fallback (Cloudflare Gateway DNS).

## 7. Risks

| Риск | Mitigation |
|---|---|
| Silent VPN install на BYOD = malware-like → reputational damage | **Hard rule:** на BYOD только opt-in с downloadable installer, никаких background mods. Документировать в decision-doc как red line. |
| Конфликт с user VPN | App-level DNS-over-HTTPS вместо system DNS, обнаружение existing tunnel + warning. |
| Platform-specific permission flow (iOS NetworkExtension, macOS PPP profile, Windows WFP) — ad-hoc engineering на каждую | Декларировать "managed-device only" для v1, BYOD defer. |
| NextDNS data controller status под GDPR | Подписать DPA с NextDNS, документировать роли в decision-doc. |
| Cloudflare WARP outage = degraded UX | Status spec показывает degraded state с graceful fallback на direct DNS. |
| Performance overhead двойного hop (WARP + NextDNS) | Замерить в POC, target <30ms median added latency. |
| Lock-in на Cloudflare+NextDNS bundle | Документировать abstract policy так, чтобы Tailscale + ControlD были drop-in alternative. |

## 8. Linear mapping

- Research issue (type: Research), epic "Enterprise / Zero Trust".
- Title: `[Spike WT-43] Cloudflare Mesh + NextDNS topology`.
- Status: Triage → In Progress → Done (when decision + topology + rollout plan delivered).
- Child issue: "MDM partnership investigation" (separate, blocked-by this spike outcome).

## 9. Featurebase mapping

- **NOT published as roadmap post**.
- After decision (если implement): create Enterprise post "Network-level protection for ROX.ONE" — high-level, mention "with leading Zero Trust providers", не называть vendor публично.
- Если reject: silent.

## 10. Outcome (filled after spike completes)

- **Decision:** _<implement | defer | reject>_
- **Scope:** _<managed-device only | managed + BYOD-opt-in | both | none>_
- **Primary mesh provider:** _<Cloudflare WARP | Tailscale | …>_
- **Primary DNS provider:** _<NextDNS | Cloudflare Gateway | ControlD>_
- **If implement:** _picked up by WT-?? (Wave 5+ enterprise), prerequisite: MDM partnership outcome — target: <date>_
- **If defer:** _revisit-at: <date>, blocker: <permission | demand | cost | platform coverage>_
- **If reject:** _rationale + alternative (docs-only guidance for customers using their own VPN/DNS)_
