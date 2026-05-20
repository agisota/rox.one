import { z } from 'zod'

export const DesignTaskSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(8192),
  kind: z.enum(['landing', 'dashboard', 'slides', 'mobile-screen', 'prototype', 'image', 'free']),
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'BCP-47 short form'),
  createdAt: z.string().datetime(),
})

export type DesignTask = z.infer<typeof DesignTaskSchema>
