/**
 * OpenAPI 3 specification for every HTTP endpoint in this app.
 *
 * It is served as JSON from `/api/openapi` and rendered by the Swagger UI page
 * at `/api-docs`. Keep it in sync whenever a route is added or changed.
 */

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const categories = [
  'class',
  'study',
  'project',
  'body',
  'eat',
  'people',
  'rest',
  'chores',
  'sleep',
]

const kinds = ['fixed', 'flexible']

const personas = ['student', 'worker', 'freelancer', 'shift']

const clocks = ['12', '24']

const mustDos = ['wake', 'study', 'move', 'project', 'winddown', 'sleep']

/**
 * The one place the streak rule is written down, used by both the day and the
 * week view so the two cannot describe it differently.
 */
const STREAK_DESCRIPTION =
  'Consecutive days whose essential blocks are all done, counted back from the most recent day. ' +
  'A day with nothing essential is stepped over rather than counted or broken. An unfinished ' +
  '*today* neither counts nor breaks the run, so a day in progress is not held against you; the ' +
  'run behind it still counts. The walk never reaches back before the account’s first event.'

/**
 * The comeback counter, written down once so the day and the week view can
 * never describe it differently from the streak.
 */
const COMEBACKS_DESCRIPTION =
  'How many times the account returned to its essentials after an unfinished one: each completed ' +
  'essential day that follows an unfinished essential day counts once. Days with nothing ' +
  'essential are ignored, so a rest day does not inflate the count, and the first counting day ' +
  'is never a comeback.'

const errorResponse = {
  description: 'Error',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
}

const unauthorizedResponse = {
  description: 'Missing or invalid auth cookie',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
}

const jsonBody = (schema: Record<string, unknown>, required = true) => ({
  required,
  content: { 'application/json': { schema } },
})

const seedDescription =
  'Creates the first account and gives it the starter schedule, once. Idempotent, and never ' +
  'overwrites an existing PIN. Requires the `SEED_SECRET` value in the `x-seed-key` header; ' +
  'without a configured secret the endpoint is disabled in production. A wrong or missing key ' +
  'returns 404. `ADMIN_PIN` (6–8 digits) must be set, so the account is never created with a ' +
  'default PIN.'

const seedKeyHeader = {
  name: 'x-seed-key',
  in: 'header',
  required: true,
  description: 'The value of the server’s `SEED_SECRET` environment variable.',
  schema: { type: 'string' },
}

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Daily Roadmap API',
    version: '1.0.0',
    description:
      'API for the Daily Roadmap schedule app. Authentication is a signed JWT stored in the ' +
      'httpOnly `auth-token` cookie, so use "Try it out" from a signed-in browser session ' +
      'to have requests authenticated automatically. Events and progress are scoped to the ' +
      'signed-in account and are never shared between users.',
  },
  servers: [
    { url: '/', description: 'Current origin' },
  ],
  tags: [
    { name: 'Auth', description: 'Sign up, sign in, PIN reset, session check and sign out' },
    { name: 'Events', description: 'The signed-in user’s own schedule blocks' },
    { name: 'Progress', description: 'Per-user completion, reviews, energy and theme' },
    { name: 'Profile', description: 'The account’s own settings and guardrails' },
    { name: 'Onboarding', description: 'Finishing the one-minute setup' },
    { name: 'Timetable', description: 'Importing a class timetable, and sharing it by code' },
    { name: 'Admin', description: 'Seeding (guarded by a server secret)' },
    { name: 'Docs', description: 'This specification' },
  ],
  security: [{ cookieAuth: [] }],
  paths: {
    '/api/auth/signin': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in with username and PIN',
        description:
          'Verifies the PIN against the stored bcrypt hash and sets the `auth-token` cookie. ' +
          'A wrong PIN and an unknown username return the same 401. Repeated failures lock the ' +
          'account after 5 attempts in 15 minutes, and lock the client IP after 30 failed ' +
          'attempts in 15 minutes counted across all accounts from that address; every lock is ' +
          'capped at 1 hour. A locked caller gets 429 with a `Retry-After` header. A correct PIN ' +
          'clears the account\'s failures but never the IP counter.',
        security: [],
        requestBody: jsonBody({ $ref: '#/components/schemas/SignInRequest' }),
        responses: {
          200: {
            description: 'Signed in; auth cookie set',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          400: errorResponse,
          401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          429: { description: 'Too many failed attempts; see the Retry-After header', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: errorResponse,
        },
      },
    },
    '/api/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account and sign in',
        description:
          'Creates the account and sets the `auth-token` cookie. Usernames and emails are unique ' +
          '(enforced by database indexes), so a racing duplicate sign-up returns 409. New accounts ' +
          'start with an empty schedule, and store the wall-clock zone their times belong to.',
        security: [],
        requestBody: jsonBody({ $ref: '#/components/schemas/SignUpRequest' }),
        responses: {
          201: {
            description: 'Account created and signed in',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SignUpResponse' } } },
          },
          400: errorResponse,
          409: { description: 'Username or email already registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: errorResponse,
        },
      },
    },
    '/api/auth/forgot-pin': {
      post: {
        tags: ['Auth'],
        summary: 'Email a 6-digit PIN reset code',
        description:
          'Sends a 6-digit code to the account’s email via SMTP. The reply is identical whether or ' +
          'not the account exists, so the endpoint cannot be used to discover who has an account. ' +
          'Codes expire after 10 minutes and are not re-sent within 60 seconds of the previous request.',
        security: [],
        requestBody: jsonBody({ $ref: '#/components/schemas/ForgotPinRequest' }),
        responses: {
          200: {
            description: 'Reset code requested (generic reply)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPinResponse' } } },
          },
          400: errorResponse,
          502: { description: 'The email could not be sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          503: { description: 'Email is not configured on the server', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: errorResponse,
        },
      },
    },
    '/api/auth/reset-pin': {
      post: {
        tags: ['Auth'],
        summary: 'Set a new PIN using the emailed code',
        description:
          'Verifies the code (5 attempts maximum, single use) and replaces the PIN hash, then signs ' +
          'the user in. A wrong code and an unknown account return the same 400.',
        security: [],
        requestBody: jsonBody({ $ref: '#/components/schemas/ResetPinRequest' }),
        responses: {
          200: {
            description: 'PIN updated; auth cookie set',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          400: errorResponse,
          429: { description: 'Too many incorrect attempts', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: errorResponse,
        },
      },
    },
    '/api/auth/check': {
      get: {
        tags: ['Auth'],
        summary: 'Check whether the current session is authenticated',
        security: [],
        responses: {
          200: {
            description: 'Session status',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthCheckResponse' } } },
          },
        },
      },
    },
    '/api/auth/signout': {
      post: {
        tags: ['Auth'],
        summary: 'Sign out and clear the auth cookie',
        security: [],
        responses: {
          200: {
            description: 'Signed out',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          500: errorResponse,
        },
      },
    },
    '/api/events': {
      get: {
        tags: ['Events'],
        summary: "List the signed-in user's events, or one day/week of blocks",
        description:
          'Only events owned by the session user are ever returned. With no query the raw event ' +
          'list is returned. With `?date=YYYY-MM-DD` the resolved day is returned, with each block ' +
          'carrying its event id and its ticked state; with `?week=YYYY-MM-DD` the seven days from ' +
          'that date’s Monday are returned. Both resolved views also carry the account’s `streak` ' +
          'and `comebacks` counters. Dates are read in the account’s own timezone.',
        parameters: [
          {
            name: 'date',
            in: 'query',
            required: false,
            description: 'Return the resolved blocks for this day.',
            schema: { type: 'string', example: '2026-10-19' },
          },
          {
            name: 'week',
            in: 'query',
            required: false,
            description: 'Return the resolved blocks for the seven days from this date’s Monday.',
            schema: { type: 'string', example: '2026-10-19' },
          },
        ],
        responses: {
          200: {
            description: 'The user’s events, or a resolved day/week',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { type: 'array', items: { $ref: '#/components/schemas/Event' } },
                    { $ref: '#/components/schemas/DayView' },
                    { $ref: '#/components/schemas/WeekView' },
                  ],
                },
              },
            },
          },
          400: errorResponse,
          401: unauthorizedResponse,
          500: errorResponse,
        },
      },
      post: {
        tags: ['Events'],
        summary: 'Create an event for the signed-in user',
        description:
          'The new event is owned by the session user. `start` and `end` must differ. Two `fixed` ' +
          'events may not overlap: a clash returns 409 naming the conflicting event. `flexible` ' +
          'events may overlap anything. An account may keep at most 300 events, after which a ' +
          'create returns 400. `exceptions` is server-managed, so one sent in a body is ignored.',
        requestBody: jsonBody({ $ref: '#/components/schemas/EventInput' }),
        responses: {
          201: {
            description: 'Created event',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } },
          },
          400: errorResponse,
          401: unauthorizedResponse,
          409: { description: 'A fixed event overlaps this one', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: errorResponse,
        },
      },
    },
    '/api/events/{id}': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Event id (MongoDB ObjectId)',
          schema: { type: 'string' },
        },
      ],
      patch: {
        tags: ['Events'],
        summary: 'Update one of the signed-in user’s events',
        description:
          'Events owned by another account are not matched and return 404. `scope` decides how ' +
          'much of a repeating event the edit covers: `this` writes an exception for `date` so ' +
          'only that day changes; `future` splits the series at `date`, keeping earlier days ' +
          '(and their ticks) as they were. Editing on or before the series’ first day replaces ' +
          'the series. A `fixed` overlap returns 409 naming the conflicting event. New or edited ' +
          'events must have `end !== start`. A series edit is applied in one transaction: if any ' +
          'part of it fails, the series is left exactly as it was. `exceptions` is server-managed: ' +
          'one sent in a body is ignored, and a `this` edit writes one for `date`. An event may ' +
          'carry at most 500 of them (400 past that).',
        requestBody: jsonBody({ $ref: '#/components/schemas/EventUpdate' }),
        responses: {
          200: {
            description: 'Updated event',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } },
          },
          400: errorResponse,
          401: unauthorizedResponse,
          404: errorResponse,
          409: { description: 'A fixed event overlaps this one', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: errorResponse,
        },
      },
      delete: {
        tags: ['Events'],
        summary: 'Delete one of the signed-in user’s events',
        description:
          'Events owned by another account are not matched and return 404. `scope=this&date=…` ' +
          'hides the event on that one day; `scope=future&date=…` ends the series the day before ' +
          '`date`; with no scope the event and its completions are removed.',
        parameters: [
          {
            name: 'scope',
            in: 'query',
            required: false,
            description: '`this` skips one date; `future` truncates the series.',
            schema: { type: 'string', enum: ['this', 'future'] },
          },
          {
            name: 'date',
            in: 'query',
            required: false,
            description: 'The date the scope applies to.',
            schema: { type: 'string', example: '2026-10-19' },
          },
        ],
        responses: {
          200: {
            description: 'Deleted, skipped or truncated',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/DeleteResult' } } },
          },
          400: errorResponse,
          401: unauthorizedResponse,
          404: errorResponse,
          500: errorResponse,
        },
      },
    },
    '/api/completions': {
      patch: {
        tags: ['Events'],
        summary: 'Tick or untick a block on a date',
        description:
          'Writes or removes a completion row for the event on that date. The event must belong ' +
          'to the session user *and* actually occur on that date (as resolved), otherwise the ' +
          'call fails. `done: false` deletes the row, so the call is idempotent. Rows are keyed by ' +
          '`(ownerId, date, eventId)`, so moving an event’s time no longer orphans its tick.',
        requestBody: jsonBody({ $ref: '#/components/schemas/CompletionToggle' }),
        responses: {
          200: {
            description: 'The resulting ticked state',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CompletionResult' } } },
          },
          400: errorResponse,
          401: unauthorizedResponse,
          404: errorResponse,
          500: errorResponse,
        },
      },
    },
    '/api/progress': {
      get: {
        tags: ['Progress'],
        summary: 'Get the signed-in user’s saved progress',
        description: 'Returns the completion checks, weekly reviews, energy levels and theme.',
        responses: {
          200: {
            description: 'Saved progress',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Progress' } } },
          },
          401: unauthorizedResponse,
          500: errorResponse,
        },
      },
      patch: {
        tags: ['Progress'],
        summary: 'Merge progress updates',
        description:
          'Only the provided entries are written; each check/review/energy key is merged by its own ' +
          'path so concurrent edits never overwrite one another.',
        requestBody: jsonBody({ $ref: '#/components/schemas/ProgressUpdate' }),
        responses: {
          200: {
            description: 'Progress after the merge',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Progress' } } },
          },
          400: errorResponse,
          401: unauthorizedResponse,
          500: errorResponse,
        },
      },
    },
    '/api/profile': {
      get: {
        tags: ['Profile'],
        summary: 'Get the signed-in account’s profile',
        description:
          'Wake and sleep times, persona, goals, the screen clock, reminder settings and the ' +
          'account’s own guardrails. A profile is created for every new sign-up; an account from ' +
          'before profiles existed is answered with sane defaults and `onboarded: true`, so it is ' +
          'never sent through onboarding.',
        responses: {
          200: {
            description: 'The account’s profile',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Profile' } } },
          },
          401: unauthorizedResponse,
          500: errorResponse,
        },
      },
      patch: {
        tags: ['Profile'],
        summary: 'Update the signed-in account’s profile',
        description:
          'Only the provided fields are written, and the document is created if it is missing. ' +
          '`onboarded` is not accepted here — only `/api/onboarding` sets it. `wake` and `sleep` ' +
          'may not be the same time when both are sent.',
        requestBody: jsonBody({ $ref: '#/components/schemas/ProfileUpdate' }),
        responses: {
          200: {
            description: 'The profile after the change',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Profile' } } },
          },
          400: errorResponse,
          401: unauthorizedResponse,
          500: errorResponse,
        },
      },
    },
    '/api/onboarding': {
      post: {
        tags: ['Onboarding'],
        summary: 'Finish onboarding and draft the first week',
        description:
          'Saves the answers, drafts the account’s first week from them and marks the account ' +
          'onboarded. The week is drafted only when the account has no events of its own, so ' +
          'running the flow again cannot pile a second plan on top of the first. Every drafted ' +
          'block repeats on all seven days; the three to five must-dos picked become the ' +
          'essential blocks a Minimum day keeps.',
        requestBody: jsonBody({ $ref: '#/components/schemas/OnboardingInput' }),
        responses: {
          201: {
            description: 'The saved profile, plus how many blocks the draft created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/OnboardingResult' } } },
          },
          400: errorResponse,
          401: unauthorizedResponse,
          500: errorResponse,
        },
      },
    },
    '/api/timetable': {
      post: {
        tags: ['Timetable'],
        summary: 'Read a pasted timetable into fixed class events',
        description:
          'One line per class — `Mon, Wed 08:30-10:00 CE 481 Data Communication` — with the ' +
          'weekdays anywhere on the line. Lines that cannot be read are skipped, so a heading or ' +
          'a note is harmless; only a paste with nothing readable at all returns 400. Lines that ' +
          'agree on their times and title are merged into one weekly event. With `replace`, the ' +
          'account’s existing classes (and their ticks) are cleared first.',
        requestBody: jsonBody({ $ref: '#/components/schemas/TimetableInput' }),
        responses: {
          201: {
            description: 'How many classes were read, created and replaced',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TimetableResult' } } },
          },
          400: errorResponse,
          401: unauthorizedResponse,
          500: errorResponse,
        },
      },
    },
    '/api/timetable/share': {
      post: {
        tags: ['Timetable'],
        summary: 'Make a short code for the class timetable',
        description:
          'Copies the account’s current `class` events into a share and returns a six-character ' +
          'code. Only classes are copied, as a snapshot, so a classmate gets the timetable and ' +
          'never the personal plan behind it — and a later edit to these classes is not reflected. ' +
          'Codes avoid letters and digits that read alike. An account with no classes gets 400.',
        requestBody: jsonBody({ $ref: '#/components/schemas/ShareCreateInput' }, false),
        responses: {
          201: {
            description: 'The code and how many classes it carries',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ShareResult' } } },
          },
          400: errorResponse,
          401: unauthorizedResponse,
          500: errorResponse,
        },
      },
    },
    '/api/timetable/import': {
      post: {
        tags: ['Timetable'],
        summary: 'Import a shared class timetable by code',
        description:
          'Copies the share’s classes onto the account, replacing its own classes so importing ' +
          'twice does not double them. Everything else the account has planned is left untouched. ' +
          'An unknown code returns 404.',
        requestBody: jsonBody({ $ref: '#/components/schemas/ShareImportInput' }),
        responses: {
          200: {
            description: 'How many classes were added',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ImportResult' } } },
          },
          400: errorResponse,
          401: unauthorizedResponse,
          404: { description: 'The code was not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: errorResponse,
        },
      },
    },
    '/api/seed': {
      get: {
        tags: ['Admin'],
        summary: 'Seed the database (idempotent)',
        description: seedDescription,
        security: [],
        parameters: [seedKeyHeader],
        responses: {
          200: {
            description: 'Seed result',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SeedResponse' } } },
          },
          404: { description: 'Seeding is disabled or the key is wrong', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: errorResponse,
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Seed the database (idempotent)',
        description: seedDescription,
        security: [],
        parameters: [seedKeyHeader],
        responses: {
          200: {
            description: 'Seed result',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SeedResponse' } } },
          },
          404: { description: 'Seeding is disabled or the key is wrong', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: errorResponse,
        },
      },
    },
    '/api/openapi': {
      get: {
        tags: ['Docs'],
        summary: 'This OpenAPI specification',
        security: [],
        responses: {
          200: {
            description: 'OpenAPI document',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'auth-token',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
        required: ['error'],
      },
      SuccessResponse: {
        type: 'object',
        properties: { success: { type: 'boolean', example: true } },
        required: ['success'],
      },
      SignInRequest: {
        type: 'object',
        properties: {
          username: { type: 'string', example: 'mmabiaa' },
          pin: { type: 'string', example: '482915', description: 'The account PIN. Accounts created before the 6-digit minimum still sign in with their 4–8 digit PIN.' },
        },
        required: ['username', 'pin'],
      },
      SignUpRequest: {
        type: 'object',
        properties: {
          username: { type: 'string', example: 'mmabiaa', description: '3–32 letters, numbers, dot, dash or underscore.' },
          email: { type: 'string', format: 'email', example: 'you@example.com', description: 'Used to send PIN reset codes.' },
          pin: { type: 'string', example: '482915', description: '6–8 digits, and not trivially guessable (no repeated single digit, no consecutive run, not a common PIN).' },
          timezone: { type: 'string', example: 'Europe/London', description: 'IANA zone the account\'s wall-clock times belong to. Sent by the sign-up form from the browser; an unknown value falls back to UTC.' },
        },
        required: ['username', 'email', 'pin'],
      },
      SignUpResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          username: { type: 'string', example: 'mmabiaa' },
        },
        required: ['success', 'username'],
      },
      ForgotPinRequest: {
        type: 'object',
        properties: {
          identifier: { type: 'string', example: 'mmabiaa', description: 'Username or email of the account.' },
        },
        required: ['identifier'],
      },
      ForgotPinResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          expiresInMinutes: { type: 'integer', example: 10 },
        },
        required: ['success'],
      },
      ResetPinRequest: {
        type: 'object',
        properties: {
          identifier: { type: 'string', example: 'mmabiaa', description: 'The same username or email used to request the code.' },
          otp: { type: 'string', example: '482915', description: 'The 6-digit code from the email.' },
          pin: { type: 'string', example: '739184', description: 'The new PIN: 6–8 digits, and not trivially guessable.' },
        },
        required: ['identifier', 'otp', 'pin'],
      },
      AuthCheckResponse: {
        type: 'object',
        properties: {
          authenticated: { type: 'boolean' },
          userId: { type: 'string', nullable: true },
        },
        required: ['authenticated'],
      },
      Repeat: {
        oneOf: [
          {
            type: 'object',
            description: 'Repeats on the given weekdays.',
            properties: {
              type: { type: 'string', enum: ['weekly'] },
              days: {
                type: 'array',
                minItems: 1,
                items: { type: 'string', enum: days },
                description: 'Each weekday at most once.',
              },
            },
            required: ['type', 'days'],
          },
          {
            type: 'object',
            description:
              'Occurs on exactly one calendar date. A one-off carries no `startDate`/`endDate`; ' +
              'the window belongs to a repeating series, and sending one is a 400.',
            properties: {
              type: { type: 'string', enum: ['once'] },
              date: { type: 'string', example: '2026-10-19' },
            },
            required: ['type', 'date'],
          },
        ],
      },
      EventException: {
        type: 'object',
        description:
          'Server-managed: written when a `scope: \'this\'` edit or a one-day skip names a date, ' +
          'never accepted on create or update. `skip` hides the event that day; the other fields ' +
          'replace what the event says, for that date only. One event carries at most 500.',
        properties: {
          date: { type: 'string', example: '2026-10-19' },
          skip: { type: 'boolean' },
          start: { type: 'string', example: '09:30' },
          end: { type: 'string', example: '10:45' },
          title: { type: 'string' },
          note: { type: 'string' },
          essential: { type: 'boolean' },
        },
        required: ['date'],
      },
      EventInput: {
        type: 'object',
        description:
          'The fields a client may set. `start` and `end` must differ; `endDate` must not precede ' +
          '`startDate`; a `once` event takes neither; a `weekly` event lists each weekday once. ' +
          '`exceptions` is not accepted — see `EventException`; one sent here is ignored.',
        properties: {
          title: { type: 'string', example: 'Study: assignments' },
          category: { type: 'string', enum: categories },
          kind: { type: 'string', enum: kinds, description: '`fixed` for appointments at a set time, `flexible` for everything movable. Only fixed events conflict.' },
          start: { type: 'string', example: '09:00' },
          end: { type: 'string', example: '10:00', description: 'Must differ from `start`.' },
          repeat: { $ref: '#/components/schemas/Repeat' },
          startDate: { type: 'string', example: '2026-10-19', description: 'First day the event applies. Optional for weekly events; refused on a `once` event.' },
          endDate: { type: 'string', example: '2026-12-20', description: 'Last day the event applies. Optional, and never before `startDate`; refused on a `once` event.' },
          note: { type: 'string' },
          essential: { type: 'boolean' },
        },
        required: ['title', 'category', 'kind', 'start', 'end', 'repeat'],
      },
      EventUpdate: {
        description:
          'The full set of editable fields — the same set as `EventInput`, `exceptions` included ' +
          'in neither — plus `scope` and the `date` they apply to. `scope` defaults to `future`.',
        allOf: [
          { $ref: '#/components/schemas/EventInput' },
          {
            type: 'object',
            properties: {
              scope: { type: 'string', enum: ['this', 'future'], default: 'future' },
              date: { type: 'string', example: '2026-10-19' },
            },
          },
        ],
      },
      Event: {
        allOf: [
          { $ref: '#/components/schemas/EventInput' },
          {
            type: 'object',
            properties: {
              _id: { type: 'string', example: '652f1c9f8a1b2c3d4e5f6a7b' },
              source: { type: 'string', enum: ['user', 'seed', 'migration'] },
              ownerId: { type: 'string', description: 'Owner of the event (set by the server, never by the client).' },
              exceptions: {
                type: 'array',
                items: { $ref: '#/components/schemas/EventException' },
                description: 'Server-managed per-date changes, at most 500 per event.',
              },
            },
            required: ['_id', 'source', 'exceptions'],
          },
        ],
      },
      BlockView: {
        type: 'object',
        description: 'One resolved block for a date, with its ticked state.',
        properties: {
          eventId: { type: 'string', description: 'The event it came from — the key a completion is stored under.' },
          title: { type: 'string' },
          category: { type: 'string', enum: categories },
          kind: { type: 'string', enum: kinds },
          start: { type: 'string', example: '09:00' },
          end: { type: 'string', example: '10:00' },
          essential: { type: 'boolean' },
          note: { type: 'string' },
          source: { type: 'string', enum: ['user', 'seed', 'migration'] },
          done: { type: 'boolean' },
        },
        required: ['eventId', 'title', 'category', 'kind', 'start', 'end', 'essential', 'source', 'done'],
      },
      DayView: {
        type: 'object',
        properties: {
          timezone: { type: 'string', example: 'Europe/London', description: 'The account’s zone; the client must use this, not the browser clock, for plan logic.' },
          today: { type: 'string', example: '2026-10-20', description: 'Today in the account’s zone.' },
          date: { type: 'string', example: '2026-10-19' },
          blocks: { type: 'array', items: { $ref: '#/components/schemas/BlockView' } },
          streak: { type: 'integer', description: STREAK_DESCRIPTION },
          comebacks: { type: 'integer', description: COMEBACKS_DESCRIPTION },
        },
        required: ['timezone', 'today', 'date', 'blocks', 'streak', 'comebacks'],
      },
      WeekView: {
        type: 'object',
        properties: {
          timezone: { type: 'string', example: 'Europe/London' },
          today: { type: 'string', example: '2026-10-20' },
          weekStart: { type: 'string', example: '2026-10-19', description: 'Monday of the returned week.' },
          days: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', example: '2026-10-19' },
                blocks: { type: 'array', items: { $ref: '#/components/schemas/BlockView' } },
              },
              required: ['date', 'blocks'],
            },
          },
          streak: { type: 'integer', description: STREAK_DESCRIPTION },
          comebacks: { type: 'integer', description: COMEBACKS_DESCRIPTION },
        },
        required: ['timezone', 'today', 'weekStart', 'days', 'streak', 'comebacks'],
      },
      CompletionToggle: {
        type: 'object',
        properties: {
          date: { type: 'string', example: '2026-10-19', description: 'The day the block occurs, in the account’s zone.' },
          eventId: { type: 'string', example: '652f1c9f8a1b2c3d4e5f6a7b' },
          done: { type: 'boolean', description: '`true` ticks the block; `false` clears it.' },
        },
        required: ['date', 'eventId', 'done'],
      },
      CompletionResult: {
        type: 'object',
        properties: { done: { type: 'boolean' } },
        required: ['done'],
      },
      DeleteResult: {
        type: 'object',
        properties: {
          deleted: { type: 'boolean', description: 'The event and its completions were removed.' },
          skipped: { type: 'boolean', description: 'The event was hidden on one date.' },
          truncated: { type: 'boolean', description: 'The series was ended the day before the given date.' },
        },
        required: ['deleted', 'skipped', 'truncated'],
      },
      Checks: {
        type: 'object',
        description:
          'LEGACY. Block completion flags keyed by `fyr:<date>:<day>:<time>`, from before the ' +
          '`completions` collection existed. Still accepted by `/api/progress` so nothing breaks, ' +
          'but new ticks are written to `/api/completions`.',
        additionalProperties: { type: 'boolean' },
        example: { 'fyr:2026-10-19:Mon:08:30': true },
      },
      Reviews: {
        type: 'object',
        description: 'Weekly review answers keyed by ISO date (YYYY-MM-DD).',
        additionalProperties: { type: 'array', items: { type: 'string' } },
        example: { '2026-10-19': ['Honest answer 1', 'Answer 2', 'Answer 3'] },
      },
      Energy: {
        type: 'object',
        description: 'Daily energy level keyed by ISO date (YYYY-MM-DD).',
        additionalProperties: { type: 'string', enum: ['low', 'okay', 'high'] },
        example: { '2026-10-19': 'okay' },
      },
      Progress: {
        type: 'object',
        properties: {
          checks: { $ref: '#/components/schemas/Checks' },
          reviews: { $ref: '#/components/schemas/Reviews' },
          energy: { $ref: '#/components/schemas/Energy' },
          theme: { type: 'string', enum: ['light', 'dark'], nullable: true },
        },
      },
      ProgressUpdate: {
        type: 'object',
        description: 'Any subset of progress; provided entries are merged into the stored document.',
        properties: {
          checks: { $ref: '#/components/schemas/Checks' },
          reviews: { $ref: '#/components/schemas/Reviews' },
          energy: { $ref: '#/components/schemas/Energy' },
          theme: { type: 'string', enum: ['light', 'dark'] },
        },
      },
      Rules: {
        type: 'object',
        description: 'The account’s own guardrails, shown on the Guide screen and edited there.',
        properties: {
          phone: { type: 'array', maxItems: 12, items: { type: 'string', maxLength: 200 } },
          study: { type: 'array', maxItems: 12, items: { type: 'string', maxLength: 200 } },
        },
        required: ['phone', 'study'],
      },
      Reminder: {
        type: 'object',
        description: 'Whether to nudge before a block, and how many minutes ahead. Shown in-app only.',
        properties: {
          enabled: { type: 'boolean' },
          lead: { type: 'integer', minimum: 0, maximum: 120, example: 10 },
        },
        required: ['enabled', 'lead'],
      },
      Profile: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          onboarded: { type: 'boolean', description: 'False until the onboarding flow is finished; an account with no profile document reads as true.' },
          wake: { type: 'string', example: '06:30' },
          sleep: { type: 'string', example: '22:30' },
          persona: { type: 'string', enum: personas },
          goals: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 60 } },
          clock: { type: 'string', enum: clocks, description: 'The clock the screens read.' },
          reminders: { $ref: '#/components/schemas/Reminder' },
          rules: { $ref: '#/components/schemas/Rules' },
        },
        required: ['userId', 'onboarded', 'wake', 'sleep', 'persona', 'goals', 'clock', 'reminders', 'rules'],
      },
      ProfileUpdate: {
        type: 'object',
        description:
          'Any subset of the editable settings; provided fields are written. `onboarded` is not ' +
          'editable here, and `wake` and `sleep` may not be equal when both are sent.',
        properties: {
          wake: { type: 'string', example: '06:30' },
          sleep: { type: 'string', example: '22:30', description: 'Must differ from `wake` when both are sent.' },
          persona: { type: 'string', enum: personas },
          goals: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 60 } },
          clock: { type: 'string', enum: clocks },
          reminders: { $ref: '#/components/schemas/Reminder' },
          rules: { $ref: '#/components/schemas/Rules' },
        },
      },
      OnboardingInput: {
        type: 'object',
        properties: {
          wake: { type: 'string', example: '06:30' },
          sleep: { type: 'string', example: '22:30' },
          persona: { type: 'string', enum: personas },
          goals: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 60 } },
          essentials: {
            type: 'array',
            minItems: 3,
            maxItems: 5,
            items: { type: 'string', enum: mustDos },
            description: 'The must-dos that become the account’s Minimum day.',
          },
        },
        required: ['wake', 'sleep', 'persona', 'goals', 'essentials'],
      },
      OnboardingResult: {
        allOf: [
          { $ref: '#/components/schemas/Profile' },
          {
            type: 'object',
            properties: { created: { type: 'integer', description: 'Blocks the drafted week created (0 when the account already had events).' } },
            required: ['created'],
          },
        ],
      },
      TimetableInput: {
        type: 'object',
        properties: {
          text: { type: 'string', maxLength: 20000, description: 'One line per class; unreadable lines are skipped.' },
          replace: { type: 'boolean', description: 'Clear the account’s existing classes (and their ticks) first.' },
        },
        required: ['text'],
      },
      TimetableResult: {
        type: 'object',
        properties: {
          created: { type: 'integer', description: 'Class events written.' },
          removed: { type: 'integer', description: 'Existing classes cleared by `replace`.' },
          found: { type: 'integer', description: 'Classes the parser read out of the paste.' },
        },
        required: ['created', 'removed', 'found'],
      },
      ShareCreateInput: {
        type: 'object',
        properties: { label: { type: 'string', maxLength: 80, description: 'An optional name for the share, for the owner’s own reference.' } },
      },
      ShareResult: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'K7M2QP', description: 'Six characters, from an alphabet without look-alike letters or digits.' },
          classes: { type: 'integer', description: 'Class events the share carries.' },
        },
        required: ['code', 'classes'],
      },
      ShareImportInput: {
        type: 'object',
        properties: { code: { type: 'string', example: 'K7M2QP', description: 'The six-character code, case-insensitive.' } },
        required: ['code'],
      },
      ImportResult: {
        type: 'object',
        properties: { created: { type: 'integer', description: 'Classes added from the share.' } },
        required: ['created'],
      },
      SeedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          error: { type: 'string' },
        },
      },
    },
  },
} as const
