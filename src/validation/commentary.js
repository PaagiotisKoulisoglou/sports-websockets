import { z } from 'zod'

// Commentary list query validation
export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
})

// Create commentary validation
export const createCommentarySchema = z.object({
  minute: z.coerce.number().int().nonnegative(),
  sequence: z.coerce.number().int().nonnegative(),
  period: z.string().trim().min(1, { message: 'period is required' }),
  eventType: z.string().trim().min(1, { message: 'eventType is required' }),
  actor: z.string().trim().min(1, { message: 'actor is required' }),
  team: z.string().trim().min(1, { message: 'team is required' }),
  message: z.string().trim().min(1, { message: 'message is required' }),
  metadata: z.record(z.string(),z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
})
