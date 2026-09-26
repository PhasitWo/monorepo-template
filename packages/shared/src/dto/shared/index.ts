import z from 'zod';

export const filterOperatorEnum = z.enum([
  'eq', // equals
  'neq', // not equals
  'ct', // contains
  'nct', // not contains
  'sw', // starts with
  'nsw', // not starts with
  'ew', // ends with
  'new', // not ends with
  'gt',
  'gte',
  'lt',
  'lte',
  'bf', // before (date)
  'af', // after (date)
  'btw', // between (date, uses v2)
  'nbtw', // not between (date, uses v2)
]);
export type FilterOperatorEnum = z.infer<typeof filterOperatorEnum>;

export const filterQueryUnitSchema = z.object({
  f: z.string().min(1), // field
  o: filterOperatorEnum, // operator
  v1: z.union([z.string().min(1), z.number(), z.boolean()]).nullable(),
  v2: z.union([z.string().min(1), z.number()]).nullable(),
});
export type FilterQueryUnit = z.infer<typeof filterQueryUnitSchema>;

/** Sent JSON-encoded in the `filters` query param of list endpoints. */
export const filterQuerySchema = z.array(filterQueryUnitSchema);
export type filterQuery = z.infer<typeof filterQuerySchema>;

/** Common list-query params; spread into each domain's list query schema. */
export const paginationQueryShape = {
  all: z.enum(['true', 'false']).optional(),
  page: z
    .string()
    .regex(/^[1-9]\d*$/)
    .optional(),
  pageSize: z
    .string()
    .regex(/^[1-9]\d*$/)
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
};
