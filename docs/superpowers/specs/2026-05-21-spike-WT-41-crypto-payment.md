# Spike WT-41: Crypto payment provider research

**Branch:** `spike/crypto-payment`
**Type:** Research spike (NO merge to main, decision doc only)
**Status:** Pending research
**Time budget:** 3 days max

## 1. Objective

Определить, как ROX.ONE может принимать crypto-платежи за подписку и реферальные выплаты **без custody на нашей стороне**, с минимальной KYC/MSB-нагрузкой и без блокировки billing pipeline (WT-17). Выдать рекомендацию по провайдеру, расчётной валюте (fiat-settled vs stablecoin) и legal-чеклисту по юрисдикциям.

## 2. Background

В master vision crypto payment отщеплён из лумпованного WT-17 (billing+crypto+referral) в отдельный research spike, потому что custody + KYC + MSB licensing — это **legal-first**, не engineering-first задача. Текущие assumptions:

- ROX.ONE **не хочет** быть money services business — нужно non-custodial flow, где провайдер забирает crypto и выдаёт нам fiat либо USDC.
- Chargeback'ов в crypto нет → fraud detection отдельная задача (не в этом spike).
- Реферальный баланс может быть в fiat-эквиваленте или в стабильной монете — этот выбор влияет на withdrawal UX.
- US (MSB), EU (MiCA с 2024–2025), UK (FCA registration), RU (валютное регулирование) — четыре главные юрисдикции.
- Никаких production custody flows до выхода legal review.

## 3. Key questions to answer

- Q1: Какой провайдер (Coinbase Commerce, BitPay, NOWPayments, MoonPay, Triple-A, Stripe Crypto-on-ramp) даёт **полностью non-custodial** flow с settlement в fiat/USDC, и есть ли у него API для programmatic invoice + webhook signatures?
- Q2: Что включается в "MSB" определение в US для нашего use-case: продаём ли мы _crypto_ или принимаем его _как платёж за сервис_? Какой precedent (IRS Notice 2014-21, FinCEN guidance)?
- Q3: MiCA (EU): подпадаем ли мы под "crypto-asset service provider" (CASP), если используем provider типа Coinbase Commerce? Какой документ нужно прикреплять к юзер-флоу (risk disclosure)?
- Q4: Какие KYC требования у провайдеров — kick in на каком пороге (€1000? $1000?) и кто его проводит (мы или provider)?
- Q5: Реферальные выплаты — выплачивать в crypto (USDC withdrawal) или в fiat (ACH/SEPA)? Какой compliance overhead каждого варианта?
- Q6: Webhook signature schema каждого провайдера — насколько robust против replay (timestamp window, nonce), достаточно ли для production fraud baseline?
- Q7: Какова стоимость 1 транзакции $20 / $100 / $1000 у каждого провайдера (process fee + network fee)? При каком объёме это становится unprofitable vs Stripe?
- Q8: Tax reporting: 1099-K (US), VAT обязательства (EU), accounting — кто выдаёт чек/инвойс (мы или провайдер)?

## 4. Research methodology

- **Provider/library evaluation matrix** по столбцам: Provider, Custody?, Settlement currencies, KYC threshold, US MSB status, MiCA status, Webhook quality, Fees @$100, Withdrawal options, DPA available, Verdict.
- **POC scope (≤0.5 дня):** **NO live transactions.** Только sandbox API: создать test invoice через Coinbase Commerce sandbox + один альтернативный, проверить webhook signature flow, замерить latency confirmation. **POC в `spike/crypto-payment`, не merge.**
- **Legal review parallel track:** список 10+ вопросов compliance counsel'у (см. Section 7 — Legal questions output).
- **Decision criteria:**
  1. Non-custodial guarantee в API docs (письменно).
  2. Покрытие ≥2 settlement-валют (fiat + stablecoin).
  3. Юридическая позиция в US и EU задокументирована провайдером.
  4. Webhook signature ≥HMAC-SHA256 + timestamp window ≤5min.
  5. Fees @$100 ≤3.5% total.
- **Time-boxed exploration:** 3 дня. День 1 — provider matrix + sandbox setup. День 2 — legal questions doc + sandbox POC. День 3 — decision + risk doc.

## 5. Expected deliverables

- `docs/spikes/WT-41/decision-doc.md` — recommendation + rationale + primary провайдер + fallback + go/no-go conditions.
- `docs/spikes/WT-41/provider-matrix.md` — таблица по 5+ провайдерам.
- `docs/spikes/WT-41/custody-risk-doc.md` — custody model каждого провайдера, кто несёт риск потерь при breach, что в TOS.
- `docs/spikes/WT-41/legal-questions.md` — список вопросов внешнему compliance counsel'у (US + EU), без ответов в этом spike.
- `docs/spikes/WT-41/jurisdiction-matrix.md` — US / EU / UK / RU / другие: kick-off-able или blocked?
- (optional) sandbox webhook handler stub — не merge, только для демо.

## 6. Stop conditions

- **Time budget exceeded:** написать то, что есть + явный список remaining legal unknowns. Legal обычно не решается в 3 дня.
- **Legal blocker:** если становится ясно, что в нашей основной юрисдикции (RU/EU) принимать crypto без licensed CASP partner нельзя — **остановиться**, не proceed с провайдером, эскалировать.
- **Tech impossibility:** если все провайдеры требуют custody или KYC на user-уровне через нас — задокументировать, что crypto pay defer до Wave 5+, fallback к fiat-only.
- **Provider TOS toxic:** unilateral chargeback rights, fund freezing without notice, indemnification clauses — flag и не выбирать.

## 7. Risks

| Риск | Mitigation |
|---|---|
| Coinbase Commerce был sunset для new customers в 2024 → нужно перепроверить статус на момент spike | Day 1: проверить актуальный onboarding status каждого провайдера; не строить план вокруг недоступных. |
| MSB / FinCEN registration triggered непреднамеренно (например, реферальный payout в crypto = money transmission) | Реферальные выплаты по умолчанию в fiat; crypto withdrawal — explicit opt-in с дисклеймером, defer до legal review. |
| Provider держит наш баланс >30 дней при подозрении на fraud → cashflow риск | В decision-doc явно требовать settlement T+1 или T+2, провайдеров с >T+7 не рассматривать. |
| MiCA-compliance меняется в 2025-2026 | Зафиксировать revisit-at = +6 months после landing, поставить в Linear. |
| Tax reporting на нас сваливается | Включить требование "provider issues tax receipts to end user" в decision criteria. |
| Crypto volatility между invoice issue и settlement | Только провайдеры с locked exchange rate ≥15min при invoice creation. |

## 8. Linear mapping

- Research issue (type: Research), epic "Billing & Monetization".
- Title: `[Spike WT-41] Crypto payment provider research`.
- Status: Triage → In Progress → Done (when decision doc + legal questions doc delivered).
- Дополнительно: создать **отдельный child issue** "Legal counsel review — crypto payment" с external assignee, blocked-by linkage.

## 9. Featurebase mapping

- **NOT published** as roadmap post в роли spike output.
- After decision (если implement): vision post "Pay with crypto" на Wishlist board, без provider name, с opt-in early access сигнатурой.
- При reject: silent, NO post (не сигналим в публичку, что мы пытались).

## 10. Outcome (filled after spike completes)

- **Decision:** _<implement | defer | reject>_
- **Primary provider:** _<Coinbase Commerce | BitPay | NOWPayments | Triple-A | …>_
- **Settlement model:** _<fiat | USDC | dual>_
- **Jurisdictions live at launch:** _<list>_
- **Legal blocker status:** _<resolved | pending counsel review | blocking>_
- **If implement:** _picked up by WT-?? (Wave 5 candidate), prerequisite: legal sign-off — target: <date>_
- **If defer:** _revisit-at: <date>, blocker: <legal | provider gap | volume too low>_
- **If reject:** _rationale + alternative (fiat-only with Stripe, или сторонний "pay-with-crypto" SaaS embedded as iframe)_
