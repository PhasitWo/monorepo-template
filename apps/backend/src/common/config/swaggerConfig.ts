import z from 'zod';

import { toJSONSchema } from '../utils/zodToJsonSchema';

import type { FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import type { FastifySwaggerUiOptions } from '@fastify/swagger-ui';
import type { FastifySchema } from 'fastify';

export const swaggerUiOptions: FastifySwaggerUiOptions = {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
  },

  staticCSP: true,
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject) => swaggerObject,
  transformSpecificationClone: true,
};

/**
 * Recursively walks a schema value and replaces any object that carries
 * `$zodSchema` with its JSON Schema equivalent, stripping both `$zodSchema`
 * and `$customOpenApiSchema` from the output at every level.
 */
function transformSchemaValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(transformSchemaValue);
  }

  if (value !== null && typeof value === 'object') {
    const { $zodSchema, $customOpenApiSchema, ...rest } = value as Record<string, unknown>;

    // Recursively transform all remaining child properties first
    const transformedRest = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, transformSchemaValue(v)]));

    if ($zodSchema instanceof z.ZodType) {
      let jsonSchema: Record<string, unknown>;
      if ($customOpenApiSchema) {
        jsonSchema = { ...($customOpenApiSchema as Record<string, unknown>) };
      } else {
        try {
          jsonSchema = toJSONSchema($zodSchema) as Record<string, unknown>;
        } catch (error) {
          console.warn('Failed to convert Zod schema to JSON Schema:', JSON.stringify($zodSchema), error);
          jsonSchema = {};
        }
      }
      return { ...jsonSchema, ...transformedRest };
    }

    return transformedRest;
  }

  return value;
}

export const getSwaggerOptions: (
  _title: string,
  _description: string,
  _version: string,
) => FastifyDynamicSwaggerOptions = (title, description, version) => ({
  transform: ({ schema, url }) => ({
    schema: transformSchemaValue(schema) as FastifySchema,
    url,
  }),
  openapi: {
    info: {
      title,
      description,
      version,
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
});
