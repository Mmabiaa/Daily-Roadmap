# Changelog — Daily Roadmap

A living record of what the app already does, what had to change to finish it, and
what is new. Kept deliberately short: one line per item, plain words.

**Legend:** `[x]` done · `[~]` needs modification · `[ ]` new to build

---

## Phase 0 — Accounts & safety (built)

- [x] Sign up, sign in, forgot PIN, reset PIN (`app/api/auth/*`)
- [x] Sessions as a signed JWT cookie with a `tokenVersion` for global sign-out
- [x] Sign-in throttling: account lock (5 failures) and IP lock (30 in 15 min), both capped at 1 h
- [x] PIN complexity rules for new PINs (6–8 digits, not guessable)
- [x] Per-account timezone stored on the user, IANA zones only
- [x] OpenAPI spec at `/api/openapi`, Swagger UI at `/api-docs`
- [x] Hidden scrollbars, app-like shell, dark mode

## Phase 1A — Events & progress (built)

- [x] v2 event model: explicit `start`/`end`, `repeat` (weekly | once), date window, exceptions
- [x] Server-resolved day and week views (`GET /api/events?date=` / `?week=`)
- [x] Completions in their own collection, keyed by `(ownerId, date, eventId)`
- [x] Atomic multi-document writes via transactions
- [x] Server-computed streak (forgiving: neutral days skipped, unfinished today not held against you)
- [x] Migration script `scripts/migrate-events-to-v2.ts` (dry-run by default)

## Screens already wired

- [x] **Today** — hero card, progress ring, "happening now" strip, timeline, tick-off, minimum toggle
- [x] **Week** — day tabs, class/study hours, minimum toggle, timeline
- [x] **Review** — three weekly prompts, saved to the account
- [x] **Focus mode** — full-screen block + 50-minute timer
- [x] **Event form** — add/edit one day or future days, delete

---

## Phase 2 — The rest of the product

### New to build

- [x] **Profile** — per-account settings kept in a `profiles` collection
      (wake/sleep, persona, goals, clock, reminders, own rules, `onboarded`)
- [x] **Onboarding flow** — a ~1-minute, six-step flow at `/onboarding`
      (wake & sleep · persona · fixed things · goals · 3–5 must-dos · see the week)
- [x] **Timetable upload** — paste your timetable (one class per line, e.g.
      `Mon, Wed 08:30-10:00 Data Communication`); parsed into fixed class events,
      with an optional "replace my classes first"
- [x] **Classmate sharing** — share a short code for a class timetable snapshot,
      classmates import it and add their own plans on top
- [x] **Wellbeing** — energy check-in, gentle nudge after two low days,
      "week too full" warning, "times you came back" counter
- [x] **Reminders** — in-app nudge before a block starts (no push service needed)
- [x] **Settings screen** — wake/sleep, persona, goals, 12/24-hour clock, reminders,
      timetable tools, sign out (`components/Settings.tsx`)
- [x] **Guide for everyone** — the account's own phone/study rules, editable,
      plus the Minimum day explained
- [x] `app/styles/09-screens.css` — styles for the new screens, in the app's tokens
- [x] `lib/preferences.ts` — shared labels and small rules the screens read

### Modified

- [x] `lib/models.ts` — profile, onboarding, timetable and share schemas
- [x] `lib/resolver.ts` — `comebacksFrom()` (how many times you returned after slipping)
- [x] `lib/schedule-service.ts` — day/week views now carry `comebacks`
- [x] `lib/mongodb.ts` — indexes for `profiles` and `timetable_shares`
- [x] `lib/openapi.ts` — documented the new endpoints
- [x] `app/api/auth/signup/route.ts` — a new account gets a profile with `onboarded: false`
- [x] `components/AppShell.tsx` — profile load, energy, wellbeing, reminders, settings view
- [x] `components/BottomNav.tsx` / `components/Topbar.tsx` — five tabs incl. Settings
- [x] `components/Guide.tsx` — per-account rules instead of the admin-only bundle
- [x] `components/TodayView.tsx` — energy check-in and wellbeing notes
- [x] `app/page.tsx` — sends a not-yet-onboarded account to `/onboarding`
- [x] `app/globals.css` — imports the new screen stylesheet

---

## Deliberately left out

- Photo/PDF timetable OCR — the upload takes text (paste or `.txt`/`.csv`).
  Reading a timetable photo needs an OCR service; the parser is ready for its output.
- Push notifications — reminders are shown in-app. Push needs a VAPID key pair and a
  server-side scheduler.
- Per-day exception UI beyond "save this day" — the API supports it; the form keeps it simple.
