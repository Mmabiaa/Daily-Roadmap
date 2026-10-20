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

- **Sign up** — username, email and a 4–8 digit PIN. You are signed in straight
  away and start with an empty schedule to fill in yourself.
- **Sign in** — username + PIN.
- **Forgot PIN** — a 6-digit code is emailed (SMTP), then you choose a new PIN.
  Codes expire after 10 minutes, are single-use, and allow five attempts.
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
| `SEED_SECRET`    | to seed in production | Guards `/api/seed`. Sent by the caller in the `x-seed-key` header. Without it, seeding is disabled in production. |
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
```

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
| GET    | `/api/events`           | List the signed-in user's events           |
| POST   | `/api/events`           | Create an event for the signed-in user     |
| PATCH  | `/api/events/{id}`      | Update one of the user's own events        |
| DELETE | `/api/events/{id}`      | Delete one of the user's own events        |
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
| `users`      | Accounts: `username`, `email`, bcrypt `pinHash`, `createdAt`.                 |
| `events`     | Schedule blocks owned by a user: `userId`, `day`, `time`, `title`, `category`, `note`, `essential`. |
| `progress`   | Per-user `checks`, `reviews`, `energy` and `theme`.                           |
| `pin_resets` | Pending PIN reset codes: `userId`, bcrypt `codeHash`, `expiresAt`, `attempts`. |

Indexes are created automatically on first use (`ensureIndexes` in
[`lib/mongodb.ts`](./lib/mongodb.ts)). The unique indexes on `users.username`
and `users.email` are what make duplicate sign-ups impossible even under
concurrent requests, and the TTL index on `pin_resets.expiresAt` lets MongoDB
delete expired codes on its own.

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
lib/              Models, auth, mailer, MongoDB client, seed, OpenAPI spec
proxy.ts          Route protection (pages + API)
public/           Icons, manifest and service worker
```

## Deployment (Vercel)

1. Add `MONGODB_URI`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PIN` (6–8 digits),
   `ADMIN_EMAIL`, `SEED_SECRET` and the `SMTP_*` variables as project environment
   variables.
2. Deploy. New or changed environment variables only apply after a fresh
   deployment, so redeploy when you change them.
3. Seed once with the secret in the header:
   `curl -H "x-seed-key: $SEED_SECRET" https://<your-app>/api/seed`
4. Sign in, then check `/signup` and `/forgot-pin` work end to end.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Released under the [MIT License](./LICENSE).
