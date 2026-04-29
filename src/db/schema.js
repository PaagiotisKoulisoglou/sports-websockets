import { pgEnum, pgTable, serial, varchar, integer, timestamp, text, jsonb } from 'drizzle-orm/pg-core';

// Enums
export const matchStatus = pgEnum('match_status', ['scheduled', 'live', 'finished']);

// Tables
export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  sport: varchar('sport', { length: 64 }).notNull(),
  homeTeam: varchar('home_team', { length: 128 }).notNull(),
  awayTeam: varchar('away_team', { length: 128 }).notNull(),
  status: matchStatus('status').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }),
  endTime: timestamp('end_time', { withTimezone: true }),
  homeScore: integer('home_score').notNull().default(0),
  awayScore: integer('away_score').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const commentary = pgTable('commentary', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  minute: integer('minute'),
  sequence: integer('sequence'),
  period: varchar('period', { length: 32 }),
  eventType: varchar('event_type', { length: 64 }),
  actor: varchar('actor', { length: 128 }),
  team: varchar('team', { length: 128 }),
  message: text('message'),
  metadata: jsonb('metadata'),
  tags: text('tags').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
