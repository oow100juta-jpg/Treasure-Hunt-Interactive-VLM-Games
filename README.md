# KCV Vision Hunt

KCV Vision Hunt is a production-structured, mobile-first team scavenger hunt. An administrator opens a room, teams join with a room code, and one database timestamp starts the game for everyone. Teams then progress independently through semantic clues while a configurable vision-language provider evaluates private image submissions.

## Architecture

- **Next.js 16 App Router** on Vercel: Server Components for initial/admin authorization, Client Components for camera and live game UI, and Route Handlers for trusted mutations.
- **Supabase PostgreSQL** is the source of truth. Database functions lock rows and make start, end, submission creation, acceptance, scoring, and next-clue assignment idempotent.
- **Supabase Auth** protects administrators. Participants use a server-generated opaque token in a secure HTTP-only cookie; only its SHA-256 hash is stored.
- **Supabase Storage** keeps participant images in the private `participant-submissions` bucket. Signed URLs are short-lived.
- **Supabase Realtime** wakes participant clients on room phase changes and keeps the authenticated admin dashboard current. Periodic refetching provides reconnection recovery.
- **Vision providers** implement one interface. `mock`, generic OpenAI-compatible, and Hugging Face-compatible modes are selected through environment variables.

The participant experience is intentionally a single state-derived route, `/play/[roomCode]`. On refresh, the UI derives the correct lobby, clue, review, result, leaderboard, freeze, or ending screen from database state rather than transient browser events.

## Local setup

1. Install dependencies: `npm install`
2. Create a Supabase project.
3. Copy `.env.example` to `.env.local` and fill in the values.
4. Apply `supabase/migrations/202607310001_kcv_vision_hunt.sql` in the Supabase SQL editor or with `supabase db push`.
5. Seed clues with `supabase/seed.sql` or `supabase db reset` when using the local Supabase CLI.
6. Create an admin user and profile as described below.
7. Run `npm run dev` and open `http://localhost:3000`.

## Environment variables

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are intentionally browser-visible. Row Level Security limits that key.

`SUPABASE_SERVICE_ROLE_KEY`, `PARTICIPANT_TOKEN_SECRET`, `VISION_API_KEY`, and any provider URL/model configuration are server-only. Never add `NEXT_PUBLIC_` to them. Use a cryptographically random secret of at least 32 characters for participant tokens.

### Vision modes

- `VISION_PROVIDER=mock` is the development default. It exercises the real upload, persistence, score, and progression pipeline without a paid model.
- `VISION_PROVIDER=openai` uses the OpenAI-compatible chat completions API. Configure `VISION_API_KEY` and optionally `VISION_API_URL` / `VISION_MODEL`.
- `VISION_PROVIDER=huggingface` uses the same compatible adapter. Set `VISION_API_URL=https://router.huggingface.co/v1`, a Hugging Face token in `VISION_API_KEY`, and a compatible vision model in `VISION_MODEL`.

Mock decisions fail closed in production unless `ALLOW_MOCK_VISION_IN_PRODUCTION=true` is explicitly configured. Leave that override disabled for a real event. The previous local-only `/game` prototype and its unauthenticated validation endpoint return 404 in production.

Provider failures never auto-accept. The submission is marked failed, the team may retry, and an administrator can inspect it.

## Supabase configuration

The migration creates all tables, constraints, transaction functions, RLS policies, the private Storage bucket, and Realtime publication entries. In **Database → Replication**, verify that `game_rooms`, `teams`, `clue_assignments`, `submissions`, and `score_events` are enabled if your project overrides publication settings.

The service-role client is used only in server-only modules for participant token verification and narrowly scoped participant operations. Browser code never receives the service-role key.

### Create an administrator

1. Create a user in **Authentication → Users** (email/password).
2. Insert its UUID into the profile table:

```sql
insert into public.profiles (id, display_name, role)
values ('AUTH-USER-UUID', 'Game Host', 'admin');
```

The user can then sign in at `/admin/login`, create a room, and use the room dashboard. A room cannot start with zero teams; repeated Start and End requests are safe.

## Game rules and security

The database computes `started_at`, `leaderboard_freezes_at`, and `ends_at` from `clock_timestamp()`. Browser countdowns are display-only. Submission eligibility and evaluation finalization compare database time to the global end. Scores are immutable events and follow 100/90/80/70/60 points by attempt, multiplied by easy 1.0, medium 1.2, or hard 1.5.

Teams have at most one open assignment, never repeat a clue, and receive the next assignment transactionally after acceptance. That assignment stays unrevealed until the result/leaderboard step is finished. The participant leaderboard disappears at the freeze timestamp; the admin leaderboard remains available. Freeze acknowledgment is persisted per team.

RLS prevents anonymous database writes and limits authenticated administrators to rooms they own. Participant endpoints validate the HTTP-only token against its stored hash on every operation, so a client-supplied team ID is never trusted.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The Vitest suite covers timing validation, server phase calculation, idempotent start/end/acceptance, one active assignment, non-repeating clues, score rules, deterministic ties, freeze visibility, participant isolation, admin access, overrides, ended-game blocking, and clue exhaustion.

## Deploy to Vercel

1. Import the repository into Vercel.
2. Add every `.env.example` variable in Project Settings. Mark `SUPABASE_SERVICE_ROLE_KEY`, `PARTICIPANT_TOKEN_SECRET`, and `VISION_API_KEY` as Sensitive for Production and Preview. Never prefix them with `NEXT_PUBLIC_`.
3. Use a separate Supabase project for untrusted Preview deployments, or omit server secrets from Preview entirely. Do not expose production service-role or model credentials to arbitrary preview branches.
4. Apply all migrations and the seed before deploying: `npx supabase db push --include-seed`. The production-security migration is required by the API rate limiter.
5. In Supabase Authentication settings, disable public email signups after creating the host accounts, require strong passwords, and enable MFA for administrators when your plan supports it. Configure the production Site URL and allowed redirect URLs.
6. Deploy with the default Next.js build command. Vercel must serve the app over HTTPS for secure participant cookies and camera access.
7. Confirm admin sign-in, room ownership isolation, team joining, Realtime start/end transitions, private signed images, rejection of files over 4 MB, and real-provider evaluation on a mobile device.

### Production security notes

- Server-only credentials are isolated behind `server-only` modules and are never returned by an API response. The anon/publishable key is intentionally public and relies on RLS.
- Mutations enforce same-origin browser requests. Participant cookies are HTTP-only, Secure in production, SameSite=Lax, and use the `__Host-` prefix.
- Join and AI-submission limits are stored in Supabase so they work across Vercel function instances. Uploaded content is checked by size, MIME allowlist, and binary file signature.
- AI provider failures return generic client messages. Raw provider/database errors remain in server logs rather than responses or submission records.
- Security headers include CSP, clickjacking protection, MIME sniffing protection, a restrictive permissions policy, and HSTS.
- Run `npm audit`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before every production release.

## Current MVP limitations

- Vision evaluation runs inside the submission request. For high-volume events, move evaluation to a durable queue/worker while keeping the same provider and database function interfaces.
- Presence is inferred from participant heartbeats/requests (45-second online window), not a dedicated Supabase Presence channel.
- Room settings are configured at creation. Direct editing of timing settings after teams join is intentionally omitted to avoid changing live-game rules.
- An accepted submission can be manually reversed while its transactionally assigned next clue is still hidden; its score is reversed with an immutable audit event. Once the team reveals or progresses into the next clue, reversal is blocked to protect assignment integrity. Rejected or failed active submissions can be manually accepted safely.
- Participant phase wake-ups use public UUID-scoped Realtime broadcast topics and contain no game data; clients always fetch authorized state afterward. Authenticated admin database-change subscriptions remain protected by room-owner RLS.
