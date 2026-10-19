'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Swagger UI rendered from the spec served at `/api/openapi`.
 *
 * The bundle is loaded from a CDN so the app carries no extra dependency.
 * Because the auth token is an httpOnly cookie, "Try it out" requests are
 * authenticated automatically while you are signed in.
 */
const SWAGGER_VERSION = '5.17.14'
const SWAGGER_CSS = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css`
const SWAGGER_JS = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js`

declare global {
  interface Window {
    SwaggerUIBundle?: (config: Record<string, unknown>) => void
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const script = document.createElement('script')
    script.src = src
    script.crossOrigin = 'anonymous'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.body.appendChild(script)
  })
}

export default function ApiDocsPage() {
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true

    loadScript(SWAGGER_JS)
      .then(() => {
        if (!window.SwaggerUIBundle) throw new Error('Swagger UI bundle unavailable')
        window.SwaggerUIBundle({
          url: '/api/openapi',
          dom_id: '#swagger-ui',
          deepLinking: true,
          docExpansion: 'list',
          defaultModelsExpandDepth: 1,
          displayRequestDuration: true,
          tryItOutEnabled: true,
          persistAuthorization: true,
        })
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  return (
    <>
      <link rel="stylesheet" href={SWAGGER_CSS} precedence="default" />
      <div className="api-docs">
        {error ? (
          <p className="api-docs-error">
            Could not load Swagger UI ({error}). The raw specification is available at{' '}
            <a href="/api/openapi">/api/openapi</a>.
          </p>
        ) : (
          <div id="swagger-ui" />
        )}
      </div>
    </>
  )
}
