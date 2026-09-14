import Fastify from 'fastify'
import compress from '@fastify/compress'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { registerErrorHandler } from './errors.js'
import { registerRoutes } from './routes/index.js'

/**
 * The OpenAPI docs (Swagger UI) are served outside production to avoid exposing
 * the full API surface publicly. Set ENABLE_API_DOCS=true to force them on in a
 * production container (the compose api service runs with NODE_ENV=production).
 */
function apiDocsEnabled(): boolean {
  return process.env.ENABLE_API_DOCS === 'true' || process.env.NODE_ENV !== 'production'
}

export async function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })

  // Routes attach a `schema` purely to document themselves (see src/openapi.ts).
  // Validation still lives in each route's manual `schema.parse(...)`, so these
  // documented schemas must NOT drive Fastify's validation. This validator
  // compiler passes the data straight through unchanged (it returns the received
  // value as-is, never rewriting it to undefined), so the body/params/query the
  // route reads is exactly what the client sent and every manual .parse() and
  // error code behaves as before.
  app.setValidatorCompiler(() => (data) => ({ value: data }))

  // Every response is JSON, which compresses well; this matters most on the slow mobile networks
  // the storefront targets. Test keeps responses uncompressed so `app.inject()` payloads stay plain JSON.
  if (process.env.NODE_ENV !== 'test') await app.register(compress, { global: true })
  // `credentials` lets the browser send the session cookie when the web app is served from another origin.
  await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'], credentials: true })
  await app.register(cookie)

  if (apiDocsEnabled()) {
    await app.register(swagger, {
      openapi: {
        info: { title: 'Cordillera API', version: '0.1.0' },
        tags: [
          { name: 'auth', description: 'Customer accounts and sessions' },
          { name: 'catalog', description: 'Collections, categories and products' },
          { name: 'cart', description: 'Session cart' },
          { name: 'checkout', description: 'Checkout and restock requests' },
          { name: 'admin', description: 'Admin panel (requires an admin session)' },
          { name: 'custom-design', description: 'Custom design (fursona) requests' },
          { name: 'artist', description: 'Artist panel (requires an artist session)' },
          { name: 'notifications', description: 'Customer notifications' },
          { name: 'system', description: 'Service health' },
        ],
      },
    })
    await app.register(swaggerUi, { routePrefix: '/api/docs' })
  }

  registerErrorHandler(app)
  app.get('/api/health', { schema: { tags: ['system'], summary: 'Service health probe' } }, async () => ({ status: 'ok' }))
  registerRoutes(app)

  return app
}
