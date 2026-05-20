import { z } from 'zod'
import { DesignTaskSchema } from './task.ts'
import { DesignContextSchema } from './context.ts'

export const OpenDesignRequestSchema = z.object({
  task: DesignTaskSchema,
  context: DesignContextSchema,
  autoLaunched: z.boolean().default(false),
  classifierConfidence: z.number().min(0).max(1).optional(),
})

export type OpenDesignRequest = z.infer<typeof OpenDesignRequestSchema>

export const OpenDesignResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('opened'), windowId: z.number().int() }),
  z.object({ status: z.literal('failed'), reason: z.string() }),
])

export type OpenDesignResult = z.infer<typeof OpenDesignResultSchema>
