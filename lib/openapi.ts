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

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Daily Roadmap API',
    version: '1.0.0',
    description:
      'API for the Daily Roadmap schedule app. Authentication is a signed JWT stored in the ' +
      'httpOnly `auth-token` cookie, so use "Try it out" from a signed-in browser session ' +
      'to have requests authenticated automatically.',
  },
  servers: [
    { url: '/', description: 'Current origin' },
  ],
  tags: [
    { name: 'Auth', description: 'Sign in, session check and sign out' },
    { name: 'Events', description: 'Schedule blocks stored in MongoDB' },
    { name: 'Progress', description: 'Per-user completion, reviews, energy and theme' },
    { name: 'Admin', description: 'Seeding and diagnostics' },
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
        summary: 'List all schedule events',
        responses: {
          200: {
            description: 'All events',
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
        summary: 'Create an event',
        requestBody: jsonBody({ $ref: '#/components/schemas/EventInput' }),
        responses: {
          201: {
            description: 'Created event',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } },
          },
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
        summary: 'Update an event',
        requestBody: jsonBody({ $ref: '#/components/schemas/EventInput' }),
        responses: {
          200: {
            description: 'Updated event',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } },
          },
          401: unauthorizedResponse,
          404: errorResponse,
          500: errorResponse,
        },
      },
      delete: {
        tags: ['Events'],
        summary: 'Delete an event',
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
        description: 'Creates the admin user and the default schedule if they do not already exist.',
        security: [],
        responses: {
          200: {
            description: 'Seed result',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SeedResponse' } } },
          },
          500: errorResponse,
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Seed the database (idempotent)',
        security: [],
        responses: {
          200: {
            description: 'Seed result',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SeedResponse' } } },
          },
          500: errorResponse,
        },
      },
    },
    '/api/test-db': {
      get: {
        tags: ['Admin'],
        summary: 'Database connectivity and counts',
        security: [],
        responses: {
          200: {
            description: 'Diagnostics',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/DbTestResponse' } } },
          },
          500: errorResponse,
        },
      },
    },
    '/api/debug-cookies': {
      get: {
        tags: ['Admin'],
        summary: 'Inspect the request cookies',
        security: [],
        responses: {
          200: {
            description: 'Cookie debug info',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/DebugCookiesResponse' } } },
          },
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
          pin: { type: 'string', example: '1234' },
        },
        required: ['username', 'pin'],
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
      DbTestResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          connected: { type: 'boolean' },
          usersCount: { type: 'integer' },
          eventsCount: { type: 'integer' },
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                id: { type: 'string' },
              },
            },
          },
        },
      },
      DebugCookiesResponse: {
        type: 'object',
        properties: {
          cookies: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, value: { type: 'string' } },
            },
          },
          count: { type: 'integer' },
          hasAuthToken: { type: 'boolean' },
        },
      },
    },
  },
} as const
