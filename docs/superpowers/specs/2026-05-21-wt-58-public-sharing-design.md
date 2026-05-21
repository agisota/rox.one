# WT-58: Public Card/Whiteboard sharing + redaction

**Branch:** `feat/public-sharing` | **Wave:** 3 | **Priority:** P1 | **Flag:** `rox.feature.public-sharing-v1` (OFF) | **Cut:** ui
**Parent epic:** PZD-123 (E12 Public sharing) | **FB board:** Compounding (`6a0db1b591b619c8111329f2`)

## 1. Objective
Public link для Card/Whiteboard с TTL (24h/7d/30d/until-revoked) + redaction (strip permission-sensitive fields + mentions to non-shared objects). Snapshot ИЛИ live mode.

## 2. User goal
User: right-click Card → Share → выбирает TTL → получает `https://share.rox.one/c/<token>` → шарит. Anonymous viewer открывает → видит redacted version в read-only viewer.

## 3. Files allowed
- `packages/shared/src/sharing/public-link.ts`
- `packages/shared/src/sharing/redactor.ts`
- `packages/shared/src/sharing/__tests__/*.test.ts`
- `apps/electron/src/renderer/components/share-modal/ShareModal.tsx`
- `apps/electron/src/renderer/components/share-modal/__tests__/ShareModal.test.tsx`
- `apps/web/src/pages/share/[token].tsx` (public viewer)
- `apps/web/src/pages/share/__tests__/*.test.tsx`
- `packages/server-core/src/sharing/share-endpoint.ts`
- `packages/server-core/src/migrations/20260521-public-links.sql`

## 4. Files forbidden
WT-51 CardLibrary internals, WT-52 Whiteboard internals (use existing renderers с public_mode flag). Root scaffolds.

## 5. Depends on
WT-51 (Card), WT-52 (Whiteboard), WT-14 (Roles — share permission), WT-08 (Audit — share event).

## 6. Blocks
None.

## 7. Functional requirements
- **FR-1**: `PublicLink {id, tenantId, objectId, token, ttl, expiresAt, createdBy, mode: 'snapshot'|'live', revokedAt?, viewCount}`.
- **FR-2**: TTL options: 24h, 7d, 30d, until-revoked.
- **FR-3**: **Snapshot mode**: создаёт frozen JSON copy в `public_link_snapshots` table. Updates to Card не reflect.
- **FR-4**: **Live mode**: viewer fetches current redacted version. Mutations propagate.
- **FR-5**: Redaction policy (HARD invariant):
  - Strip ALL `metadata.private` fields
  - Strip mentions to objects WITHOUT public_link
  - Strip tags не помечённых `public`
  - Strip annotations с `private: true`
  - Strip blockquotes pointing к non-shared sources
- **FR-6**: Revoke link → return 410 Gone immediately. Snapshot retained for audit.
- **FR-7**: View count: increment on each request (rate-limit per IP).
- **FR-8**: Audit emit on create/revoke/expire (WT-08).
- **FR-9**: Public viewer на отдельном subdomain `share.rox.one` (CORS-isolated).
- **FR-10**: Watermark "Shared by ROX.ONE" footer.

## 8. Non-functional requirements
- **NFR-1**: Redaction zero false negatives (test fuzz 100 docs).
- **NFR-2**: Snapshot create < 200ms for card with 100 blocks.
- **NFR-3**: Public viewer first paint < 1.5s.
- **NFR-4**: Rate limit: 100 views/min per IP.

## 9. Data model
```typescript
interface PublicLink { id, tenantId, objectId, token, ttl: '24h'|'7d'|'30d'|'forever', expiresAt, createdBy, mode: 'snapshot'|'live', revokedAt?, viewCount, createdAt }
// snapshot mode also stores public_link_snapshots(public_link_id, snapshot_json, snapshot_at)
```

## 10. API / IPC
`publicLink:create(objectId, options)`, `publicLink:revoke(id)`, `publicLink:list(filters)`. Public endpoint: `GET share.rox.one/api/share/:token`.

## 11. UI/UX
ShareModal: object preview + TTL radio + mode radio + "Copy link" + revoke list. ViewerPage: redacted render of Card/Whiteboard + watermark.

## 12. Security / RBAC
- **Share permission** (WT-14) required (default: workspace:share).
- Redactor is **fail-closed**: if validation throws, deny share creation.
- Anonymous viewer cannot escalate (no JS auth context, no API endpoints).
- HMAC token signing для anti-tampering.
- Rate limit per IP (DDoS protection).

## 13. TDD test list
T-1: create link с TTL 7d → expiresAt correct. T-2: snapshot mode frozen JSON. T-3: live mode reflects updates. T-4: redaction strips `metadata.private`. T-5: redaction strips mentions to non-shared objects. T-6: revoke → 410 Gone. T-7: HMAC token tampering rejected. T-8: rate-limit 101st view returns 429. T-9: audit emit on create/revoke/expire. T-10: cross-tenant link creation blocked. T-11: redactor fuzz test 100 docs zero leak.

## 14. AC
11 TDD + 3-machine + fuzz test + security review + typecheck/lint exit 0.

## 15-22. Roles / FB / Linear / Inspiration
Standard. Linear PZD-123, 5 stories: link schema, redactor, snapshot vs live, ShareModal, public viewer + watermark. FB alias `wt-58-public-sharing`. Inspiration: https://wiki.heptabase.com/ (concept — public card sharing), https://github.com/agisota/zrok (reference_only — public tunnel), https://github.com/agisota/sweetlink (reference_only — link shortener), https://github.com/Mail-0/Zero (reference_only — public link security model), https://github.com/anomalyco/openauth (reference_only — token signing).

## 23. Mission control axes
- **Work type:** new_module
- **CJM scenarios:** share-card-public, share-whiteboard, revoke-link, viewer-anonymous-access
- **UI surfaces:** ShareModal (in app), Public ViewerPage (on share.rox.one)
- **Entities touched:** PublicLink (NEW), PublicLinkSnapshot (NEW)
- **Relations touched (WT-47):** N/A
- **Events emitted (WT-49):** public_link.created, public_link.revoked, public_link.expired, public_link.viewed
- **AI context (WT-48):** Public viewer does NOT use AI (anonymous user)
- **Search index (WT-50):** Public links NOT indexed (security)
- **Heptabase parity:** Public Card / Public Whiteboard links
- **Risk axes:** security (data leak), data, release
