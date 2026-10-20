# Daily Roadmap

A focused daily-schedule web app for students: a single place to plan the day,
tick off blocks as you complete them, and review the week. It is a mobile-first
PWA backed by MongoDB, with a simple username + PIN sign-in.

Anyone can create an account in a minute and keep their own plan: every event
and every tick is private to the account that created it.

![Screenshot](/public/screenshot.png)


- **Today** — the day's blocks, live progress ring, and the current/next block.
- **Week** — a seven-day overview with per-day completion.
- **Review** — weekly reflection answers and a daily energy check-in.
- **Guide** — phone rules, study-block format, and the "minimum day" checklist.
- **Focus mode** — a distraction-free timer for a single block.
- **App-like UX** — installable PWA, dark mode, hidden scrollbars, offline shell.

## Accounts

- **Sign up** — username, email and a 6–8 digit PIN that is not trivially
  guessable. You are signed in straight away and start with an empty schedule
  to fill in yourself.
- **Sign in** — username + PIN. Accounts created earlier keep working with
  their 4–8 digit PIN.
- **Forgot PIN** — a 6-digit code is emailed (SMTP), then you choose a new PIN.
  Codes expire after 10 minutes, are single-use, and allow five attempts.
  Choosing a new PIN signs every other device out.
- **Sign out** — from the top bar.

Everything you tick off (task completion, reviews, energy, theme) is stored in
MongoDB per user, and events never cross between accounts.

## Tech stack

| Layer     | Choice                                     |
| --------- | ------------------------------------------ |
| Framework | Next.js 16 (App Router, Route Handlers)    |
| Language  | TypeScript                                 |
| UI        | React 19, Tailwind CSS v4, lucide-react    |
| Database  | MongoDB (native driver)                    |
| Auth      | JWT in an httpOnly cookie, bcrypt PIN hash |
| Email     | nodemailer (SMTP, Gmail by default)        |
| Validation| Zod                                        |
| Docs      | OpenAPI 3 + Swagger UI                     |

## Getting started

### Prerequisites

- Node.js 20+
- A MongoDB database (local or Atlas)

### 1. Install

```bash
npm install
```

### 2. Configure the environment

Copy `.env.example` to `.env.local` and fill in the values.

```bash
cp .env.example .env.local
```

| Variable         | Required | Description                                             |
| ---------------- | -------- | ------------------------------------------------------- |
| `MONGODB_URI`    | yes      | MongoDB connection string.                              |
| `JWT_SECRET`     | yes      | Secret used to sign auth tokens. Use a long random value.|
| `ADMIN_USERNAME` | no       | Username for the first user created by `/api/seed`.     |
| `ADMIN_PIN`      | to seed  | **6–8 digit** PIN for that first user. The seed refuses to run without it, so the account is never created with a default PIN. |
| `ADMIN_EMAIL`    | no       | Email for that first user, so it can reset its PIN.     |
| `ADMIN_TIMEZONE` | no       | IANA zone for that first user, e.g. `Europe/London`. Falls back to UTC. New sign-ups send their browser's zone instead. |
| `SEED_SECRET`    | to seed in production | Guards `/api/seed`. Sent by the caller in the `x-seed-key` header. Without it, seeding is disabled in production. |
| `TRUST_PROXY_HEADERS` | on a proxied host | Set to `true` only when a proxy you control sets the IP header. Without it, per-IP sign-in throttling is skipped rather than trusting a spoofable value. |
| `TRUSTED_IP_HEADER` | no    | Which header carries the client IP. Defaults to `x-forwarded-for` (first entry). |
| `SMTP_HOST`      | for resets | SMTP server, e.g. `smtp.gmail.com`.                  |
| `SMTP_PORT`      | no       | `465` (TLS, default) or `587` (STARTTLS).               |
| `SMTP_USER`      | for resets | SMTP username.                                        |
| `SMTP_PASS`      | for resets | SMTP password / Gmail App Password.                   |
| `SMTP_FROM`      | no       | From header. Defaults to `SMTP_USER`.                   |

Without the `SMTP_*` variables the app still runs; `/api/auth/forgot-pin`
returns `503` so the failure is explicit rather than silent.

### 3. Seed the database

The seed step is idempotent. It creates the first account, and:

- attaches any events that predate per-user ownership to that account, so
  nothing is lost when reads become user-scoped;
- gives that account the starter schedule **once** — every other account starts
  empty.

It requires `ADMIN_PIN` (6–8 digits) and, in production, the `SEED_SECRET` value
in an `x-seed-key` header. Send the key in the header rather than the query
string, which would end up in access logs:

```bash
# with the dev server running
curl -H "x-seed-key: $SEED_SECRET" http://localhost:3000/api/seed

# in development only, ?key= is also accepted (never do this in production)
curl "http://localhost:3000/api/seed?key=$SEED_SECRET"
```

### 4. Run

```bash
npm run dev      # development
npm run build    # production build
npm start        # serve the production build
npm test         # unit + database integration tests (node:test)
npm run typecheck # tsc --noEmit; the build runs type checking too
```

`npm test` also runs the database-backed suite in
[`lib/integration.test.ts`](./lib/integration.test.ts), which starts a real
single-member MongoDB **replica set** through
[`mongodb-memory-server`](https://github.com/typegoose/mongodb-memory-server)
(a dev dependency) and points `MONGODB_URI` at it, so the indexes, the atomic
counters, the ownership rules and the transactions that series edits run in are
exercised for real rather than mocked. A replica set — not a standalone — is
what makes transactions available, and production (Atlas) is a replica set too.
The binary is downloaded on first run; if that is not possible, set
`MONGOMS_SYSTEM_BINARY` to a `mongod` already on the machine, or
`MONGOMS_VERSION` to pin a different build. The suite **fails loudly** if the
database cannot be started — it is never silently skipped. Set
`SKIP_INTEGRATION=1` only when you deliberately want to run the unit tests
alone, which prints a warning so a skipped suite is obvious.

Open <http://localhost:3000> and sign in with `ADMIN_USERNAME` / `ADMIN_PIN`,
or create a new account from `/signup`.

## API documentation

Interactive Swagger UI covering every endpoint is available while signed in:

- **Swagger UI:** `/api-docs`
- **OpenAPI spec (JSON):** `/api/openapi`

Source of truth: [`lib/openapi.ts`](./lib/openapi.ts).

| Method | Endpoint                | Purpose                                    |
| ------ | ----------------------- | ------------------------------------------ |
| POST   | `/api/auth/signup`      | Create an account and sign in              |
| POST   | `/api/auth/signin`      | Sign in with username + PIN                |
| POST   | `/api/auth/forgot-pin`  | Email a 6-digit PIN reset code             |
| POST   | `/api/auth/reset-pin`   | Set a new PIN with the emailed code        |
| GET    | `/api/auth/check`       | Check the current session                  |
| POST   | `/api/auth/signout`     | Sign out                                   |
| GET    | `/api/events`           | List the user's events, or `?date=`/`?week=` blocks |
| POST   | `/api/events`           | Create an event for the signed-in user     |
| PATCH  | `/api/events/{id}`      | Update one of the user's own events        |
| DELETE | `/api/events/{id}`      | Delete, skip or truncate one of the user's events |
| PATCH  | `/api/completions`      | Tick or untick a block on a date           |
| GET    | `/api/progress`         | Get the user's saved progress              |
| PATCH  | `/api/progress`         | Merge progress updates                     |
| GET    | `/api/seed`             | Seed the database (requires `x-seed-key`)  |
| POST   | `/api/seed`             | Seed the database (requires `x-seed-key`)  |
| GET    | `/api/openapi`          | This OpenAPI specification                 |

Requests are authenticated with the httpOnly `auth-token` cookie, so "Try it
out" from `/api-docs` works with your signed-in session. Unauthenticated calls
to a protected `/api/*` route get a JSON `401`, never an HTML redirect.

## Data model

| Collection   | Contents                                                                      |
| ------------ | ----------------------------------------------------------------------------- |
| `users`      | Accounts: `username`, `email`, bcrypt `pinHash`, `timezone`, `createdAt`.     |
| `events`     | Schedule blocks owned by a user: `ownerId`, `title`, `category`, `kind`, `start`, `end`, `repeat`, `startDate`, `endDate`, `essential`, `exceptions`, `source`, `note`. A legacy row (pre-1A) still carries `userId`, `day` and `time` until the migration runs. |
| `completions`| One ticked block: `ownerId`, `date` (in the owner's zone), `eventId`, `doneAt`. Unique on `(ownerId, date, eventId)`. |
| `progress`   | Per-user `checks`, `reviews`, `energy` and `theme`.                           |
| `pin_resets` | Pending PIN reset codes: `userId`, bcrypt `codeHash`, `expiresAt`, `attempts`. |
| `rate_limits` | Sign-in throttle buckets, one per account and per hashed IP: `failures`, `windowStartedAt`, `lockedUntil`, `expiresAt`. |

Indexes are created automatically on first use (`ensureIndexes` in
[`lib/mongodb.ts`](./lib/mongodb.ts)). The unique indexes on `users.username`
and `users.email` are what make duplicate sign-ups impossible even under
concurrent requests, the unique index on a completion stops one block being
ticked twice, and the TTL indexes on `pin_resets.expiresAt` and
`rate_limits.expiresAt` let MongoDB clean up expired rows on its own.

## Schedule rules

- **Events per account** — at most **300**. The 301st create is refused with a
  `400` and a message saying so.
- **Overlaps** — only two `fixed` events can clash, and only when their weekday
  sets, their date ranges and their times all intersect. A clash returns `409`
  naming the event it clashes with. `flexible` events may sit on top of
  anything, so a study block can be moved onto a class without a fight.
- **Input rules** — `start` and `end` must differ; `endDate` may not come before
  `startDate`; a `once` event takes no `startDate`/`endDate`; and a `weekly`
  event lists each weekday at most once. A body that breaks one of these is a
  `400`.
- **Per-date changes** — `exceptions` are written by the server, never sent by
  the client: a `scope: 'this'` edit or a one-day skip adds one. An event may
  carry at most **500** of them, past which the edit is refused with a `400`.
- **Streak** — the number of days in a row whose *essential* blocks are all
  done, counted back from the most recent day. A day with nothing essential is
  stepped over rather than counted or broken. **An unfinished today neither
  counts nor breaks the run**: a day in progress is not held against you, and
  the days behind it still count. The walk never reaches back before the
  account's first event.

**Known limitation.** The event cap and the overlap check are *read-then-write*:
the handler counts, or scans for a clash, and then writes. Two requests from the
same account that arrive together can therefore both pass the check and both
write, leaving one account a single event over the cap or with a pair of
overlapping fixed events. Only the account itself can do this — a second account
cannot collide with it — and the next normal edit clears it, so it is left
as-is rather than taking a per-account lock on every write.

## Sign-in throttling

Five failed attempts inside fifteen minutes start a lock on the **account**, and
each further failure extends it: 1m, 5m, 15m, 1h, then doubling.

An **IP address** is counted separately and much more leniently, because a
campus, office or mobile network puts many people behind one address: it locks
only after 30 failed attempts in fifteen minutes, counted across *all* accounts
from that address. Successful sign-ins are never recorded, and they never clear
the IP bucket, so one valid account cannot be used to reset the counter and
carry on guessing at other accounts.

Every lock — account or IP — is capped at one hour. A day-long IP lock would let
anyone keep a whole campus out of their own accounts long after the guessing
stopped. Locked callers get `429` with a `Retry-After` header. A correct PIN
clears the account's failures, and a completed PIN reset clears them too, so a
reset is never blocked by the sign-in lock. Unknown usernames pay for a bcrypt
compare as well, so the reply time does not reveal whether an account exists.

Per-IP limiting needs `TRUST_PROXY_HEADERS=true`, because the header is
otherwise client-controlled. When it is off, or the header is missing or not a
literal IP, the IP limit is skipped and only the account limit applies.

## Project structure

```
app/
  api/            Route handlers (auth, events, progress, admin, openapi)
  api-docs/       Swagger UI page
  signin/         Sign-in page
  signup/         Sign-up page
  forgot-pin/     PIN reset page (request code -> set new PIN)
  styles/         Design tokens and stylesheets (01..08)
components/       UI components (AppShell, views, modals)
lib/              Models, auth, mailer, MongoDB client, seed, schedule resolver, OpenAPI spec
proxy.ts          Route protection (pages + API)
public/           Icons, manifest and service worker
```

## Deployment (Vercel)

1. Add `MONGODB_URI`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PIN` (6–8 digits),
   `ADMIN_EMAIL`, `ADMIN_TIMEZONE`, `SEED_SECRET`, `TRUST_PROXY_HEADERS=true` and
   the `SMTP_*` variables as project environment variables.
2. Deploy. New or changed environment variables only apply after a fresh
   deployment, so redeploy when you change them.
3. Seed once with the secret in the header:
   `curl -H "x-seed-key: $SEED_SECRET" https://<your-app>/api/seed`
4. Sign in, then check `/signup` and `/forgot-pin` work end to end.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Released under the [MIT License](./LICENSE).
