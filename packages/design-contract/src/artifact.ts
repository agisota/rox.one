import { z } from 'zod'

export const DesignArtifactSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  type: z.enum(['html', 'svg', 'png', 'pdf', 'pptx', 'mp4']),
  uri: z.string().regex(/^(file|rox-storage):/, 'local storage URI scheme'),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime(),
  thumbnailUri: z.string().regex(/^(file|rox-storage):/).optional(),
})

export type DesignArtifact = z.infer<typeof DesignArtifactSchema>
