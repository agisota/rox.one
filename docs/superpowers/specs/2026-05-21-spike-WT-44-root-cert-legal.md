# Spike WT-44: Self-issued root cert legal/policy review

**Branch:** `spike/root-cert-legal`
**Type:** Research spike (NO merge to main, decision doc only)
**Status:** Pending research
**Time budget:** 3 days max

## 1. Objective

Дать однозначное legal/policy решение по сценарию **self-issued root certificate**, который ROX.ONE может предлагать для TLS-inspection / DLP / per-device identity на managed устройствах. Определить, где допустимо (managed device + MDM + explicit consent), где категорически нет (BYOD silent install), и какой compliance + consent flow нужен для production.

## 2. Background

В master vision self-issued root cert отщеплён из WT-18 (RBI+mesh+cert) в **legal-first** spike, потому что установка root cert даёт ROX.ONE возможность подписывать TLS-сертификаты от имени любого домена — это equivalent of MITM с точки зрения trust model. Текущие assumptions:

- **BYOD: запрещено категорически.** Silent install root cert на personal device = malware-like, violation TOS/anti-abuse у Apple/Microsoft/Google.
- **Managed device + MDM + explicit org consent:** acceptable industry practice (Palo Alto Prisma, Zscaler, Netskope все так делают).
- Legal-критичные юрисдикции: GDPR (EU, Article 6 lawful basis), Germany (BetrVG — works council), France (CNIL), UK (DPA 2018), US (state-specific monitoring laws — Connecticut, Delaware require notice).
- Consent docs нужны на org-level (admin agreement) и employee-level (notice + ability to object).
- Revocation flow обязателен — пользователь должен иметь способ убрать root cert и видеть, что он установлен.

## 3. Key questions to answer

- Q1: Какой *exact* lawful basis под GDPR Article 6 покрывает install root cert на work device — legitimate interest (6(1)(f)) или explicit consent (6(1)(a))? Можно ли консент вообще валидно получить в трудовых отношениях (employer-employee power imbalance)?
- Q2: Germany BetrVG: установка root cert на work device обычно требует Betriebsvereinbarung (works council agreement). Какой шаблон + минимум clauses?
- Q3: France CNIL: monitoring employees через TLS-inspection — какой notice требуется (1 month prior?) + DPIA обязательна?
- Q4: US state-specific (Connecticut, Delaware, New York Senate Bill S2628): какой notice/consent + retention?
- Q5: Какие MDM platforms (Jamf, Intune, Kandji, Workspace ONE, Mosyle) поддерживают пуш root cert + audit + revocation, и как ROX.ONE интегрируется (config profile, MDM commands API, либо третья сторона)?
- Q6: Что входит в **revocation flow**: как user/admin удаляет cert, как ROX узнаёт что cert удалён, что произойдёт с running сессиями?
- Q7: Audit requirements: кто видит, что cert установлен, как часто проверять (cert pinning attestation), как логировать TLS-inspection events без сохранения content (только metadata)?
- Q8: Какой consent UX:
  - Org admin: signed MSA + DPA + addendum "TLS inspection enabled" + Betriebsvereinbarung (DE).
  - End user: первичный onboarding screen с явным "your work device's TLS traffic will be inspected by ROX.ONE per your org's policy" + link на policy + "I understand" button.
- Q9: Cross-border data flow: если ROX.ONE (cloud-side) видит расшифрованный TLS трафик и хранит metadata в US — какие SCCs/transfer impact assessments нужны для EU customers?
- Q10: Liability: если ROX.ONE cert скомпрометирован → attacker может MITM весь трафик managed devices. Какой insurance / SLA / breach notification?

## 4. Research methodology

- **Legal review:**
  1. Compile vendor templates от Palo Alto / Zscaler / Netskope (public TOS + DPAs) — что они декларируют по cert install, consent, revocation.
  2. Список 10+ вопросов external counsel'у (EU + DE + US).
  3. Подготовить consent flow draft (UX copy + policy doc) → передать counsel'у на review (out-of-scope для этого spike).
- **MDM integration matrix:** Jamf, Intune, Kandji, Workspace ONE, Mosyle, Mosyle Business, Apple Business Manager, Google Endpoint Management. Колонки: cert push API, audit support, revocation API, market share, integration effort.
- **Decision criteria:**
  1. Минимум 1 valid lawful basis под GDPR для work-device сценария.
  2. Минимум 2 MDM-platform с full cert push + revocation API.
  3. Consent flow покрывает EU + US + DE specifics.
  4. Revocation flow ≤24 hours from request to effective.
  5. **BYOD сценарий явно вычеркнут** в decision-doc.
- **Time-boxed exploration:** 3 дня. День 1 — legal frameworks per jurisdiction. День 2 — MDM matrix + consent UX draft. День 3 — compliance doc + integration plan + decision.

**NO POC code.** Этот spike — legal-first; никакого actual cert generation на live machine.

## 5. Expected deliverables

- `docs/spikes/WT-44/decision-doc.md` — recommendation + scope (managed-only) + jurisdictions covered at launch.
- `docs/spikes/WT-44/compliance-doc.md` — GDPR lawful basis analysis, per-jurisdiction (EU/DE/FR/UK/US-CT/US-DE/US-NY/RU) summary, DPIA template stub, retention policy.
- `docs/spikes/WT-44/mdm-integration-plan.md` — приоритезированный list MDM с integration effort estimates + ranking.
- `docs/spikes/WT-44/consent-flow.md` — UX copy + policy doc draft (admin-level и user-level), wireframes (text-only).
- `docs/spikes/WT-44/revocation-flow.md` — flow chart (Mermaid) + SLA + audit events.
- `docs/spikes/WT-44/legal-counsel-questions.md` — final list для external counsel review.

## 6. Stop conditions

- **Time budget exceeded:** записать legal frameworks per jurisdiction что есть, явно flag remaining jurisdictions как "pending counsel review".
- **Legal blocker — fundamental:** если в какой-то ключевой юрисдикции (EU baseline) выясняется, что лawful basis под GDPR для self-issued root cert на work device **не существует** — **эскалировать**, перевести в "feature requires customer-side cert (BYO cert)" mode, не proceed с our-issued cert.
- **MDM coverage gap:** если ни одна mainstream MDM platform не поддерживает revocation API → флаг, defer.
- **Liability uninsurable:** если cyber insurance не покрывает cert breach scenario для нашего ARR — flag, потенциальный go/no-go для company-level risk decision.
- **BYOD pressure from sales:** если sales просит BYOD silent install — **hard NO**, документировать в decision-doc как permanent constraint, не reopened без full counsel + company-level approval.

## 7. Risks

| Риск | Mitigation |
|---|---|
| **Reputational risk:** одна история про BYOD silent install ROX cert → катастрофа | Hard rule "managed device + MDM + explicit consent only" в decision-doc; ban в product spec. |
| **Cert breach:** наш CA скомпрометирован → MITM всех managed devices | HSM-backed signing (требование в integration plan, out-of-scope spike); 90-day intermediate rotation; emergency revocation procedure. |
| **GDPR fine 4% revenue:** invalid consent flow | Consent flow проходит counsel review **до** production; нет launch без signed-off legal sign-off. |
| **BetrVG в DE задерживает customer onboarding на месяцы** | Подготовить template Betriebsvereinbarung для customer's IT/HR; document expected timeline. |
| **MDM API изменения** | Зафиксировать revisit-at = +12 months для MDM matrix. |
| **Insurance не покрывает breach** | Включить уточнение страховки в company-level risk decision _до_ production. |
| **Employee lawsuit за monitoring** | Notice copy + opt-out path (employee may use personal device with reduced ROX features); document in compliance-doc. |
| **State law changes (US monitoring laws expanding)** | Quarterly review process, owner — legal team. |

## 8. Linear mapping

- Research issue (type: Research), epic "Compliance & Trust".
- Title: `[Spike WT-44] Self-issued root cert legal/policy review`.
- Status: Triage → In Progress → Done (when decision + compliance + consent flow delivered).
- Child issue: "External counsel review — root cert deployment" (blocked-by, separate budget).
- **Linked decision** не закрывается без external counsel sign-off — keep open until legal accepted.

## 9. Featurebase mapping

- **NOT published** as roadmap post.
- After decision (если implement): **NO public marketing post** про cert install (это enterprise sales conversation, не public roadmap).
- Если reject: silent. Possibly create internal-only ADR explaining why "BYO cert from customer's CA" is the path instead.

## 10. Outcome (filled after spike completes)

- **Decision:** _<implement | defer | reject>_
- **Scope:** _<managed-device + MDM + consent only | BYO-cert mode | rejected>_
- **BYOD verdict:** **hard NO** (constant across all outcomes).
- **Jurisdictions covered at launch:** _<list>_
- **MDM primary integration:** _<Jamf | Intune | …>_
- **Legal sign-off status:** _<approved by counsel | pending | blocking>_
- **If implement:** _picked up by WT-?? (Wave 6 enterprise), prerequisite: counsel sign-off + insurance review + HSM provisioning — target: <date>_
- **If defer:** _revisit-at: <date>, blocker: <legal | MDM | insurance>_
- **If reject:** _rationale + alternative path (customer-provided cert from their own CA, ROX integrates as TLS-inspection client without owning the trust root)_
