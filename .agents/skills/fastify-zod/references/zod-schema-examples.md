# Zod Schema Examples

Canonical files (read these, they are the source of truth):

- `packages/shared/src/dto/tag/request.ts` / `response.ts` — smallest complete example
- `packages/shared/src/dto/user/request.ts` — `.regex()`, `.pick().partial()` for update bodies
- `packages/shared/src/dto/shared/index.ts` — `paginationQueryShape` and `filterQuerySchema` used by list endpoints
- `packages/shared/src/error/index.ts` — `ERROR_CODE` + user-facing `ERROR_CODE_TEXT_MAP`

## List query

Query params arrive as strings, so booleans and numbers are validated as strings and converted in the controller
(`BaseController.processPagination`).

```typescript
import z from 'zod';
import { paginationQueryShape } from '../shared';

export const listTagQuerySchema = z.object({
  ...paginationQueryShape, // all, page, pageSize, sortOrder
  sortBy: z.enum(['runningId', 'name', 'createdAt', 'updatedAt']).optional(),
  search: z.string().optional(),
  filters: z.string().optional(), // JSON-encoded filterQuery: [{ f, o, v1, v2 }]
  isActive: z.enum(['true', 'false']).optional(),
});
export type ListTagQuery = z.infer<typeof listTagQuerySchema>;
```

`sortBy` values must be real column names — the service passes them straight to `orderBy`.

## Body

```typescript
export const createTagBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().max(500).nullable().optional(),
});
export type CreateTagBody = z.infer<typeof createTagBodySchema>;

export const updateTagBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100).optional(), // absent = unchanged
  description: z.string().max(500).nullable().optional(), // null = clear
  isActive: z.boolean().optional(),
});
export type UpdateTagBody = z.infer<typeof updateTagBodySchema>;
```

The frontend reuses these schemas (or `.pick()`s of them) with `zodResolver`, so form and API validation agree.

## Response

Dates are `z.string()` — the controller serialises with `toISOString()`.

```typescript
export const tagDetailResponseSchema = z.object({
  id: z.string(),
  runningId: z.number(),
  runningCode: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  updatedAt: z.string(),
  createdAt: z.string(),
});
export type TagDetailResponse = z.infer<typeof tagDetailResponseSchema>;

export const listTagResponseSchema = z.array(tagDetailResponseSchema);
export type ListTagResponse = z.infer<typeof listTagResponseSchema>;
```

## Error codes

```typescript
export enum ERROR_CODE {
  DUPLICATE_TAG_NAME = 'DUPLICATE_TAG_NAME',
}
export const ERROR_CODE_TEXT_MAP: Record<keyof typeof ERROR_CODE, string> = {
  DUPLICATE_TAG_NAME: 'A tag with this name already exists.', // shown by the frontend's toastError
};
```

## Don't

- `.transform()` / `.pipe()` into another type — breaks OpenAPI generation.
- Declaring the same shape again in the frontend — import the type from `@repo/shared`.
- Forgetting `export * from './dto/<domain>/request'` (and `response`) in `packages/shared/src/index.ts`.
- Putting backend-only secrets or internal fields in a response schema.
