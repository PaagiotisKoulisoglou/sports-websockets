### Sportes — Realtime sports matches API with WebSockets

#### Overview
Sportes is a lightweight Node.js/Express service for managing sports matches and streaming realtime match commentary to clients over WebSockets. It exposes a simple REST API to create and list matches and to post/list commentary entries for a match. New matches and commentary updates are broadcast to connected WebSocket clients in near‑real time. HTTP and WebSocket traffic are protected with Arcjet (bot detection, shielding, and rate‑limiting).

#### Features
- REST API
  - Create and list matches
  - Add and list commentary per match
- WebSockets
  - Subscribe/unsubscribe to matches by `matchId`
  - Broadcasts `match_created` to all clients
  - Broadcasts `commentary` to subscribers of a match
- Validation using Zod
- PostgreSQL persistence via Drizzle ORM
- Arcjet shielding, bot detection, and sliding‑window rate limiting for HTTP and WS
- Minimal, production‑friendly setup and DX-friendly dev script (Node --watch)

#### Tech Stack
- Runtime: Node.js (ESM)
- HTTP: Express 5
- WebSockets: ws
- DB/ORM: PostgreSQL + drizzle‑orm, drizzle‑kit (migrations)
- Validation: zod
- Security/Rate limiting: @arcjet/node
- Env: dotenv

---

### Quick Start

#### Prerequisites
- Node.js 20+
- PostgreSQL 13+

#### 1) Clone and install
```
npm install
```

#### 2) Configure environment
Create a `.env` file in the project root:
```
# Server
PORT=8000
HOST=0.0.0.0

# Database
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB_NAME

# Arcjet (https://www.arcjet.com/)
ARCJET_KEY=your_arcjet_key
# LIVE (default) will enforce; DRY_RUN will log but allow
ARCJET_MODE=LIVE
```
Notes:
- If `ARCJET_KEY` is missing, the app will throw on startup (security is required by default). If you need to run locally without Arcjet, you can temporarily provide a fake key in `.env`, or adapt the code to not require it.
- `DATABASE_URL` is required both by the server and drizzle‑kit.

#### 3) Database setup (Drizzle)
Generate SQL from the schema and run migrations:
```
# Generate SQL based on src/db/schema.js into ./drizzle
npm run db:generate

# Apply migrations to your DATABASE_URL
npm run db:migrate
```
This will create the following tables/enums:
- enum `match_status`: `scheduled | live | finished`
- table `matches`: id, sport, homeTeam, awayTeam, status, startTime, endTime, homeScore, awayScore, createdAt
- table `commentary`: id, matchId (FK → matches.id, cascade), minute, sequence, period, eventType, actor, team, message, metadata (jsonb), tags (text[]), createdAt

#### 4) Run the server
```
# Development (auto‑reload)
npm run dev

# Production
npm start
```
If `HOST=0.0.0.0` and `PORT=8000` (defaults), you’ll see:
- HTTP: http://localhost:8000
- WS:   ws://localhost:8000/ws

---

### API Reference
All endpoints return JSON. On validation errors you’ll receive HTTP 400 with `details` from Zod. Server errors return HTTP 5xx.

Base URL: `http://<HOST>:<PORT>`

#### Health/Root
- GET `/`
  - 200: `"Hello from Express server!"`

#### Matches
- GET `/matches?limit=<int<=100>`
  - Lists matches ordered by `createdAt` descending
  - Response: `{ data: Match[] }`
- POST `/matches`
  - Body (Zod `createMatchSchema`):
    ```json
    {
      "sport": "string",
      "homeTeam": "string",
      "awayTeam": "string",
      "startTime": "ISO-8601 string",
      "endTime": "ISO-8601 string",
      "homeScore": 0,          // optional, defaults to 0
      "awayScore": 0           // optional, defaults to 0
    }
    ```
  - Rules:
    - `endTime` must be after `startTime`
    - `status` is computed server‑side as `scheduled | live | finished` based on `startTime`/`endTime`
  - Response: `201 { data: Match }`

Match object shape (from Drizzle schema):
```
{
  id: number,
  sport: string,
  homeTeam: string,
  awayTeam: string,
  status: "scheduled" | "live" | "finished",
  startTime: string | null, // stored as timestamp with time zone
  endTime: string | null,
  homeScore: number,
  awayScore: number,
  createdAt: string
}
```

#### Commentary
Base path is nested under a match: `/matches/:id/commentary`
- GET `/matches/:id/commentary?limit=<int<=100>`
  - Lists recent commentary for the match (most recent first)
  - Response: `{ data: Commentary[] }`
- POST `/matches/:id/commentary`
  - Body (Zod `createCommentarySchema`):
    ```json
    {
      "minute": 57,                // int, >= 0
      "sequence": 3,               // int, >= 0 (order inside the minute/period)
      "period": "2H",             // e.g., "1H", "2H", "OT", "Q1"
      "eventType": "GOAL",        // free text/category
      "actor": "Player Name",
      "team": "Team Name",
      "message": "Long text…",
      "metadata": { "key": "value" }, // optional, defaults {}
      "tags": ["goal", "highlight"]   // optional, defaults []
    }
    ```
  - Response: `201 { data: Commentary }`
  - Side‑effect: broadcasts this commentary over WebSocket to subscribers of the match

Commentary object shape:
```
{
  id: number,
  matchId: number,
  minute: number | null,
  sequence: number | null,
  period: string | null,
  eventType: string | null,
  actor: string | null,
  team: string | null,
  message: string | null,
  metadata: object | null,
  tags: string[] | null,
  createdAt: string
}
```

---

### WebSocket Protocol
- Endpoint: `ws://<HOST>:<PORT>/ws`
- On connect: server sends a welcome message
  ```json
  { "type": "welcome" }
  ```
- Heartbeats: server pings every 30s; your client must respond with `pong` automatically (most WS clients do this) to avoid termination.

#### Client → Server messages
- Subscribe to a match
  ```json
  { "type": "subscribe", "matchId": 123 }
  ```
  - Response: `{ "type": "subscribed", "matchId": 123 }`
- Unsubscribe from a match
  ```json
  { "type": "unsubscribe", "matchId": 123 }
  ```
  - Response: `{ "type": "unsubscribed", "matchId": 123 }`

Invalid JSON results in an error message:
```json
{ "type": "error", "message": "Invalid JSON" }
```

#### Server → Client broadcasts
- New match created (to all clients):
  ```json
  { "type": "match_created", "data": Match }
  ```
- New commentary (to subscribers of a match):
  ```json
  { "type": "commentary", "data": Commentary }
  ```

---

### Security and Rate Limiting (Arcjet)
Arcjet is applied to both HTTP and WebSocket upgrade requests using rules:
- `shield` — general threat protection
- `detectBot` — with allow‑list for `CATEGORY:SEARCH_ENGINE` and `CATEGORY:PREVIEW`
- `slidingWindow`
  - HTTP: `interval: 10s, max: 50`
  - WS: `interval: 2s, max: 5`

Denials:
- HTTP: 429 (Too Many Requests) or 403 (Forbidden)
- WS upgrade: 429 or 403 sent as HTTP response, then connection closed
- Errors: HTTP middleware returns 503; WS upgrade error returns 500

Environment:
- `ARCJET_KEY` (required)
- `ARCJET_MODE` = `LIVE` (default) or `DRY_RUN`

---

### Examples

#### Create a match
```
curl -X POST http://localhost:8000/matches \
  -H "Content-Type: application/json" \
  -d '{
    "sport": "Football",
    "homeTeam": "Home FC",
    "awayTeam": "Away FC",
    "startTime": "2026-05-04T18:00:00.000Z",
    "endTime":   "2026-05-04T19:45:00.000Z"
  }'
```

#### List matches
```
curl "http://localhost:8000/matches?limit=20"
```

#### Post commentary
```
curl -X POST http://localhost:8000/matches/1/commentary \
  -H "Content-Type: application/json" \
  -d '{
    "minute": 12,
    "sequence": 1,
    "period": "1H",
    "eventType": "SHOT_ON_TARGET",
    "actor": "Jane Doe",
    "team": "Home FC",
    "message": "Powerful shot from 20 yards, saved by the keeper",
    "tags": ["shot", "save"]
  }'
```

#### Subscribe to commentary via WebSocket (wscat)
```
wscat -c ws://localhost:8000/ws
> { "type": "subscribe", "matchId": 1 }
< { "type": "subscribed", "matchId": 1 }
# You will now receive { "type": "commentary", ... } messages for matchId 1
```

---

### Project Structure
```
.
├─ drizzle/                 # Generated SQL and migration state (drizzle‑kit)
├─ drizzle.config.js        # Drizzle config (uses DATABASE_URL)
├─ package.json
├─ src/
│  ├─ index.js              # App entry, Express + HTTP server, mounts WS and routes
│  ├─ arcjet.js             # Arcjet setup (HTTP + WS) and middleware
│  ├─ ws/
│  │  └─ server.js          # WebSocket server, subscriptions and broadcasts
│  ├─ routes/
│  │  ├─ matches.js         # /matches endpoints
│  │  └─ commentary.js      # /matches/:id/commentary endpoints
│  ├─ validation/
│  │  ├─ matches.js         # Zod schemas (createMatchSchema, etc.)
│  │  └─ commentary.js      # Zod schemas for commentary
│  ├─ db/
│  │  ├─ db.js              # pg Pool + drizzle client
│  │  └─ schema.js          # Drizzle schema (tables/enums)
│  └─ utils/
│     └─ match-status.js    # Computes match status and sync helper
└─ .env                     # Your environment variables (not committed)
```

---

### Development Notes
- The server automatically broadcasts newly created matches to all WS clients and commentary to only the subscribed clients for that match.
- `status` is computed via `getMatchStatus(startTime, endTime)` as:
  - `scheduled` if now < start
  - `live` if start ≤ now < end
  - `finished` if now ≥ end
- Validation is strict; malformed queries/bodies return 400 with detailed issues.

---

### Troubleshooting
- Startup fails: "DATABASE_URL is not defined" → add it to `.env`.
- Startup fails: "ARCJET_KEY environment variable is missing" → add a valid key (or set a placeholder for local testing).
- 429/403 responses → you may be rate‑limited or blocked by Arcjet; reduce request volume or adjust `ARCJET_MODE`.
- WebSocket closes after ~30s → ensure your client responds to pings (most WS clients auto‑pong).

---

### Scripts
- `npm run dev` — Start server with `node --watch src/index.js`
- `npm start` — Start server normally
- `npm run db:generate` — Generate Drizzle SQL from schema
- `npm run db:migrate` — Apply migrations
- `npm run db:demo` — Runs `src/crud.js` if provided (demo script; optional in this repo)

---

### Roadmap
- Add endpoints to update match scores and status over time
- Pagination and filtering (by sport, team, status)
- Authentication/authorization (tokens/keys)
- More granular WS channels (sports/leagues)
- Observability (structured logs, metrics)

### Contributing
PRs are welcome! Please open an issue to discuss major changes. Ensure code follows the existing style and add tests where appropriate.

### License
ISC
