# Daily Roadmap

A focused daily-schedule web app for students: a single place to plan the day,
tick off blocks as you complete them, and review the week. It is a mobile-first
PWA backed by MongoDB, with a simple username + PIN sign-in.

![Screenshot](/public/screenshot.png)


- **Today** — the day's blocks, live progress ring, and the current/next block.
- **Week** — a seven-day overview with per-day completion.
- **Review** — weekly reflection answers and a daily energy check-in.
- **Guide** — phone rules, study-block format, and the "minimum day" checklist.
- **Focus mode** — a distraction-free timer for a single block.
- **App-like UX** — installable PWA, dark mode, hidden scrollbars, offline shell.

Everything you tick off (task completion, reviews, energy, theme) is stored in
MongoDB per user.

## Tech stack

| Layer     | Choice                                     |
| --------- | ------------------------------------------ |
| Framework | Next.js 16 (App Router, Route Handlers)    |
| Language  | TypeScript                                 |
| UI        | React 19, Tailwind CSS v4, lucide-react    |
| Database  | MongoDB (native driver)                    |
| Auth      | JWT in an httpOnly cookie, bcrypt PIN hash |
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
| `ADMIN_PIN`      | no       | PIN for that first user.                                |

### 3. Seed the database

The `users` and `events` collections are populated by an idempotent seed step.
Run it once after configuring the environment:

```bash
# with the dev server running
curl http://localhost:3000/api/seed

# or, in a browser
http://localhost:3000/api/seed
```

### 4. Run

```bash
npm run dev      # development
npm run build    # production build
npm start        # serve the production build
```

Open <http://localhost:3000> and sign in with `ADMIN_USERNAME` / `ADMIN_PIN`.

## API documentation

Interactive Swagger UI covering every endpoint is available while signed in:

- **Swagger UI:** `/api-docs`
- **OpenAPI spec (JSON):** `/api/openapi`

Source of truth: [`lib/openapi.ts`](./lib/openapi.ts).

| Method | Endpoint             | Purpose                              |
| ------ | -------------------- | ------------------------------------ |
| POST   | `/api/auth/signin`   | Sign in with username + PIN          |
| GET    | `/api/auth/check`    | Check the current session            |
| POST   | `/api/auth/signout`  | Sign out                             |
| GET    | `/api/events`        | List schedule events                 |
| POST   | `/api/events`        | Create an event                      |
| PATCH  | `/api/events/{id}`   | Update an event                      |
| DELETE | `/api/events/{id}`   | Delete an event                      |
| GET    | `/api/progress`      | Get the user's saved progress        |
| PATCH  | `/api/progress`      | Merge progress updates               |
| GET    | `/api/seed`          | Seed the database                    |
| POST   | `/api/seed`          | Seed the database                    |
| GET    | `/api/test-db`       | Database connectivity and counts     |
| GET    | `/api/debug-cookies` | Inspect the request cookies          |
| GET    | `/api/openapi`       | This OpenAPI specification           |

Requests are authenticated with the httpOnly `auth-token` cookie, so "Try it
out" from `/api-docs` works with your signed-in session.

## Data model

| Collection | Contents                                                        |
| ---------- | --------------------------------------------------------------- |
| `users`    | Account records: `username`, bcrypt `pinHash`, `createdAt`.     |
| `events`   | Schedule blocks: `day`, `time`, `title`, `category`, `note`.    |
| `progress` | Per-user `checks`, `reviews`, `energy` and `theme`.             |

## Project structure

```
app/
  api/            Route handlers (auth, events, progress, admin, openapi)
  api-docs/       Swagger UI page
  signin/         Sign-in page
  styles/         Design tokens and stylesheets (01..08)
components/       UI components (AppShell, views, modals)
lib/              Models, auth, MongoDB client, seed, OpenAPI spec
middleware.ts     Route protection (pages + API)
public/           Icons, manifest and service worker
```

## Deployment (Vercel)

1. Add `MONGODB_URI`, `JWT_SECRET`, `ADMIN_USERNAME` and `ADMIN_PIN` as project
   environment variables.
2. Deploy. New or changed environment variables only apply after a fresh
   deployment, so redeploy when you change them.
3. Visit `/api/seed` once to create the first user and events.
4. Sign in and confirm progress is saving.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Released under the [MIT License](./LICENSE).
