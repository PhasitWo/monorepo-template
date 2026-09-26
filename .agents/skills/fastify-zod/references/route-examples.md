# Route Examples

Canonical files:

- `apps/backend/src/routes/tag.routes.ts` — smallest complete example
- `apps/backend/src/routes/user.routes.ts` — delete (204)
- `apps/backend/src/routes/auth.routes.ts` — public routes (`publicSchema`), a service built from another service
- `apps/backend/src/routes/routeBuilder.ts` — `registerRoutes`, `baseSchema`, `publicSchema`, `idParamsSchema`,
  `successResponseSchema`, `commonErrorResponses`
- `apps/backend/src/server.ts` — where each `register<Domain>Routes` is called; the auth middleware is added there as
  a hook, so routes never add it

## Wiring and registration

```typescript
export const registerTagRoutes = (fastify: FastifyInstance): void => {
  // manual DI: services → controller
  const tagService = new TagService(new UnitOfWork(), new AuditLogService());
  const controller = new TagController(tagService);

  registerRoutes(fastify, [
    {
      method: 'get',
      path: '/tags/:id',
      options: {
        schema: {
          ...baseSchema('Tag', 'Get tag by ID', 'Retrieve a tag by ID'),
          params: idParamsSchema, // JSON schema, not Zod
          response: {
            ...commonErrorResponses,
            200: successResponseSchema(tagDetailResponseSchema, 'Tag retrieved successfully'),
          },
        },
      },
      handler: controller.getTagById,
    },
    {
      method: 'get',
      path: '/tags',
      options: {
        schema: {
          ...baseSchema('Tag', 'List tags', 'Retrieve a paginated list of tags'),
          querystring: useZodSchema(listTagQuerySchema),
          response: {
            ...commonErrorResponses,
            200: successResponseSchema(listTagResponseSchema, 'Tags retrieved successfully'),
          },
        },
      },
      handler: controller.listTag,
    },
    {
      method: 'post',
      path: '/tags',
      options: {
        schema: {
          ...baseSchema('Tag', 'Create a tag', 'Create a tag'),
          body: useZodSchema(createTagBodySchema),
          response: {
            ...commonErrorResponses,
            201: successResponseSchema(tagDetailResponseSchema, 'Tag created successfully'),
          },
        },
      },
      handler: controller.createTag,
    },
  ]);
};
```

Then in `server.ts`, inside the authenticated plugin:

```typescript
instance.addHook('preHandler', authMiddleware.authenticate.bind(authMiddleware));
registerUserRoutes(instance);
registerTagRoutes(instance); // ← new routes files go here
```

## Rules recap

- Paths are relative; `server.ts` mounts them under `/api/v1`.
- `body` / `querystring` → `useZodSchema(schema)`. `params` → plain JSON schema (`idParamsSchema`).
- `response` → `...commonErrorResponses` + the success status: `200`, `201` (create) or `204` (delete,
  `successResponseSchema(undefined, '...')`).
- Public routes use `publicSchema` and are registered in the separate public plugin in `server.ts`.
- Add the new route list to `apps/backend/src/routes/__tests__/routes.test.ts`.
- When services depend on each other, share instances (`auth.routes.ts` passes one `UnitOfWork` and
  `AuditLogService` to both `UserService` and `AuthService`).
- Swagger UI at `http://localhost:3000/docs` shows the result.
