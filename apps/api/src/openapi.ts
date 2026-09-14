import { z } from 'zod'
import type { FastifySchema } from 'fastify'

/**
 * OpenAPI documentation helpers.
 *
 * The routes keep validating with their manual `schema.parse(...)` calls; these
 * helpers only turn the same Zod schemas into JSON Schema so Swagger can show
 * accurate request shapes. Nothing here participates in request validation:
 * `buildApp` installs a no-op validator compiler for the documented schemas so
 * Fastify never re-validates the body/params/query with them.
 */

/**
 * Convert a Zod schema to JSON Schema for documentation.
 *
 * `io: 'input'` documents what a client sends (before transforms), and
 * `unrepresentable: 'any'` keeps refinements/transforms (e.g. the "clear a field
 * with an empty string" union) from throwing during conversion.
 */
function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>
}

interface RouteDocInput {
  tags: string[]
  summary: string
  body?: z.ZodType
  params?: z.ZodType
  querystring?: z.ZodType
}

/**
 * Build a Fastify `schema` object for documentation only. Attach the result to a
 * route's options so `@fastify/swagger` picks it up; the paired no-op validator
 * compiler in `buildApp` makes sure it does not affect runtime validation.
 */
export function routeDoc(input: RouteDocInput): FastifySchema {
  const schema: FastifySchema = { tags: input.tags, summary: input.summary }
  if (input.body) schema.body = toJsonSchema(input.body)
  if (input.params) schema.params = toJsonSchema(input.params)
  if (input.querystring) schema.querystring = toJsonSchema(input.querystring)
  return schema
}
