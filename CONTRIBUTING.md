# Contributing to Daily Roadmap

Thanks for taking the time to contribute. This guide covers how to set up the
project, the conventions we follow, and how to get a change merged.

## Getting set up

1. Fork the repository and clone your fork.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env.local` from `.env.example` and fill in `MONGODB_URI` and
   `JWT_SECRET`.
4. Start the dev server and seed the database once:

   ```bash
   npm run dev
   curl http://localhost:3000/api/seed
   ```

5. Open <http://localhost:3000> and sign in with your `ADMIN_USERNAME` / `ADMIN_PIN`.

## Before you start

- For anything larger than a small fix, open an issue first so we can agree on
  the approach before you write code.
- Keep changes focused. One pull request should do one thing.
- Check the [Next.js docs bundled with the project](./node_modules/next/dist/docs)
  before using framework APIs — this Next.js version has breaking changes.

## Coding guidelines

- **TypeScript first.** Keep types accurate; avoid `any`.
- **Validate at the boundary.** Request bodies are validated with Zod schemas in
  `lib/models.ts` before they reach the database.
- **Persist to the database, not the browser.** Do not use `localStorage` or
  `sessionStorage`; user state belongs in MongoDB via `/api/progress`.
- **Keep the API docs in sync.** When you add or change a route, update
  `lib/openapi.ts` so `/api-docs` stays accurate.
- **Style with tokens.** Reuse the CSS custom properties in
  `app/styles/02-tokens.css` rather than hard-coding colors.
- **Keep secrets out of the repo.** Never commit `.env.local` or credentials.

## Commit messages

Write clear, imperative commit messages. We loosely follow
[Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add weekly streak banner
fix: keep progress when two blocks are edited together
docs: document the progress endpoint
chore: bump mongodb driver
```

## Pull request process

1. Create a branch from `main` with a descriptive name (e.g.
   `feat/week-streak`).
2. Make your change and verify it locally:
   - `npm run build` succeeds, and
   - the affected flow works in the browser.
3. Update `README.md` and `lib/openapi.ts` if your change affects them.
4. Open a pull request describing **what** changed and **why**, and link any
   related issue.
5. Address review feedback and keep the branch up to date with `main`.

## Reporting bugs

Open an issue and include:

- what you expected to happen,
- what actually happened,
- steps to reproduce,
- browser and, if relevant, the failing request and response.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).
