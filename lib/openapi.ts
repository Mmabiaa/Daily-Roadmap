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
    { name: 'Admin', description: 'Seeding (guarded by a server secret)' },
    { name: 'Docs', description: 'This specification' },
  ],
  security: [{ cookieAuth: [] }],
  paths: {
    '/api/auth/signin': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in with username and PIN',
        description: 'Verifies the PIN against the stored bcrypt hash and sets the `auth-token` cookie.',
        security: [],
        requestBody: jsonBody({ $ref: '#/components/schemas/SignInRequest' }),
        responses: {
          200: {
            description: 'Signed in; auth cookie set',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          400: errorResponse,
          401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
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
          'start with an empty schedule.',
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
        summary: "List the signed-in user's events",
        description: 'Only events owned by the session user are returned.',
        responses: {
          200: {
            description: 'The user’s events',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Event' } },
              },
            },
          },
          401: unauthorizedResponse,
          500: errorResponse,
        },
      },
      post: {
        tags: ['Events'],
        summary: 'Create an event for the signed-in user',
        description: 'The new event is owned by the session user.',
        requestBody: jsonBody({ $ref: '#/components/schemas/EventInput' }),
        responses: {
          201: {
            description: 'Created event',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } },
          },
          400: errorResponse,
          401: unauthorizedResponse,
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
        description: 'Events owned by another account are not matched and return 404.',
        requestBody: jsonBody({ $ref: '#/components/schemas/EventInput' }),
        responses: {
          200: {
            description: 'Updated event',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } },
          },
          400: errorResponse,
          401: unauthorizedResponse,
          404: errorResponse,
          500: errorResponse,
        },
      },
      delete: {
        tags: ['Events'],
        summary: 'Delete one of the signed-in user’s events',
        description: 'Events owned by another account are not matched and return 404.',
        responses: {
          200: {
            description: 'Deleted',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
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
      EventInput: {
        type: 'object',
        properties: {
          day: { type: 'string', enum: days },
          time: { type: 'string', example: '08:30' },
          title: { type: 'string', example: 'Study: assignments' },
          category: { type: 'string', enum: categories },
          note: { type: 'string' },
          essential: { type: 'boolean' },
        },
        required: ['day', 'time', 'title', 'category'],
      },
      Event: {
        allOf: [
          { $ref: '#/components/schemas/EventInput' },
          {
            type: 'object',
            properties: {
              _id: { type: 'string', example: '652f1c9f8a1b2c3d4e5f6a7b' },
              userId: { type: 'string', description: 'Owner of the event (set by the server, never by the client).' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },
      Checks: {
        type: 'object',
        description: 'Block completion flags keyed by `fyr:<date>:<day>:<time>`.',
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
