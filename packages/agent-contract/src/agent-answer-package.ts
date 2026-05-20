import { z } from 'zod'
import { OpenDesignRequestSchema } from '@rox-one/design-contract'

const baseFields = {
  agentId: z.string().min(1),
  sessionId: z.string().min(1),
  turnId: z.string().uuid(),
  createdAt: z.string().datetime(),
}

const TextPayload = z.object({ kind: z.literal('text'), text: z.string().max(1_000_000) })
const CodePayload = z.object({ kind: z.literal('code'), language: z.string().min(1), text: z.string().max(1_000_000) })
const DesignPayload = z.object({ kind: z.literal('design'), request: OpenDesignRequestSchema })

// Recursive mixed
const PrimitivePayload = z.discriminatedUnion('kind', [TextPayload, CodePayload, DesignPayload])
type PrimitivePayload = z.infer<typeof PrimitivePayload>
type MixedPayload = { kind: 'mixed'; parts: ReadonlyArray<PrimitivePayload | MixedPayload> }

const MixedPayload: z.ZodType<MixedPayload> = z.lazy(() =>
  z.object({
    kind: z.literal('mixed'),
    parts: z.array(z.union([PrimitivePayload, MixedPayload])).max(50),
  })
)

const PayloadSchema = z.union([PrimitivePayload, MixedPayload])

export const AgentAnswerPackageSchema = z.object({
  ...baseFields,
  kind: z.enum(['text', 'code', 'design', 'mixed']),
  payload: PayloadSchema,
}).refine(
  (v) => v.kind === v.payload.kind,
  { message: 'top-level kind must match payload.kind' }
)

export type AgentAnswerPackage = z.infer<typeof AgentAnswerPackageSchema>
