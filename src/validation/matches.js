import { z } from 'zod'

// Matches list query validation
export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
})

// Match status constants
export const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
}

// Path params validation
export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

// Helpers
const isIsoDateString = (value) => {
  if (typeof value !== 'string') return false
  const time = Date.parse(value)
  if (Number.isNaN(time)) return false
  try {
    // Ensure it round-trips to a valid ISO string
    // Some engines will coerce many formats; we require that parsing succeeds
    // and toISOString does not throw
    new Date(value).toISOString()
    return true
  } catch {
    return false
  }
}

// Create match validation
export const createMatchSchema = z
  .object({
    sport: z.string().trim().min(1, { message: 'sport is required' }),
    homeTeam: z.string().trim().min(1, { message: 'homeTeam is required' }),
    awayTeam: z.string().trim().min(1, { message: 'awayTeam is required' }),
    startTime: z
      .string()
      .refine(isIsoDateString, { message: 'startTime must be a valid ISO date string' }),
    endTime: z
      .string()
      .refine(isIsoDateString, { message: 'endTime must be a valid ISO date string' }),
    homeScore: z.coerce.number().int().nonnegative().optional(),
    awayScore: z.coerce.number().int().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startTime)
    const end = new Date(data.endTime)
    if (!(end > start)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endTime must be after startTime',
        path: ['endTime'],
      })
    }
  })

// Update score validation
export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
})
