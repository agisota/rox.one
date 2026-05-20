import { z } from 'zod'

export const DesignContextSchema = z.object({
  sessionId: z.string().min(1),
  workspaceId: z.string().min(1).nullable(),
  selection: z.object({
    text: z.string(),
    range: z.tuple([z.number().int(), z.number().int()]),
  }).optional(),
  attachedFileIds: z.array(z.string().min(1)).default([]),
  theme: z.enum(['light', 'dark', 'system']),
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'BCP-47 short form'),
  user: z.object({
    id: z.string().min(1),
    locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'BCP-47 short form'),
  }).optional(),
})

export type DesignContext = z.infer<typeof DesignContextSchema>
