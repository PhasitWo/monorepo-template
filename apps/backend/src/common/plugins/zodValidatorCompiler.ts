import Ajv from 'ajv-v8';
import addFormats from 'ajv-formats';
import fp from 'fastify-plugin';
import z from 'zod';

import { ValidationError } from '../errors/errorTypes';

import type { FastifyPluginCallback } from 'fastify';

/**
 * Fastify plugin that registers a validator compiler supporting both:
 * - Zod schemas (detected via the `$zodSchema` property on the route schema)
 * - Standard JSON Schema (compiled with Ajv as fallback)
 *
 * Wrapped with fastify-plugin so setValidatorCompiler applies to the root
 * app instance, not just the plugin's encapsulated scope.
 *
 * Usage:
 *   await app.register(zodValidatorCompilerPlugin);
 */
const zodValidatorCompiler: FastifyPluginCallback = (app, opts, done) => {
  const ajv = new Ajv({ coerceTypes: true });
  addFormats(ajv);
  app.setValidatorCompiler(({ schema }) => {
    // 1. Zod schema — detected by the presence of $zodSchema on the route schema object
    const zodSchema = (schema as { $zodSchema?: z.ZodType }).$zodSchema;
    if (zodSchema instanceof z.ZodType) {
      return (data) => {
        const result = zodSchema.safeParse(data);
        if (result.success) {
          return { value: result.data };
        }
        return { error: new ValidationError(result.error.message) };
      };
    }

    // 2. Fallback — standard JSON Schema compiled with Ajv (params, headers, etc.)
    const validateFn = ajv.compile(schema);
    return (data) => {
      const isValid = validateFn(data);
      if (isValid) {
        return { value: data };
      }
      return {
        error: validateFn.errors
          ? new ValidationError(ajv.errorsText(validateFn.errors))
          : new ValidationError('Validation error'),
      };
    };
  });

  done();
};

export const zodValidatorCompilerPlugin = fp(zodValidatorCompiler, {
  name: 'zod-validator-compiler',
  fastify: '5.x',
});
