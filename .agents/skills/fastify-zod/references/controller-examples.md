# Controller Examples

Canonical files:

- `apps/backend/src/controllers/tag.controller.ts` — smallest complete example (get / list / create / update)
- `apps/backend/src/controllers/user.controller.ts` — delete (`noContentResponse`), mapping a narrowed type
  (`SafeUser`)
- `apps/backend/src/controllers/baseController.ts` — response helpers, `processPagination`, `buildPaginationMeta`

## Shape

```typescript
function mapToTagDetailResponse(tag: Tag): TagDetailResponse {
  // Tag is the Prisma-generated type
  return {
    id: tag.id,
    runningId: tag.runningId,
    runningCode: tag.runningCode,
    name: tag.name,
    description: tag.description,
    isActive: tag.isActive,
    createdAt: tag.createdAt.toISOString(), // dates go out as ISO strings
    updatedAt: tag.updatedAt.toISOString(),
  };
}

export class TagController extends BaseController {
  constructor(private readonly tagService: TagService) {
    super('TagController');
  }

  getTagById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const tag = await this.tagService.getById(id); // throws NotFoundError → 404
    return this.successResponse(reply, mapToTagDetailResponse(tag));
  };

  listTag = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sortBy, sortOrder, search, ...rest } = request.query as ListTagQuery;
    const { page, all, pageSize, filters, isActive } = this.processPagination(rest);

    const { total, data } = await this.tagService.list({
      page,
      pageSize,
      sortBy,
      sortOrder,
      all,
      search,
      filters,
      isActive,
    });
    const resp: ListTagResponse = data.map(mapToTagDetailResponse);

    if (all) {
      return this.successResponse(reply, resp); // plain array, no pagination meta
    }
    return this.paginatedResponse(reply, resp, this.buildPaginationMeta(page, pageSize, total));
  };

  createTag = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateTagBody;
    const tag = await this.tagService.create(body);
    return this.createdResponse(reply, mapToTagDetailResponse(tag)); // 201
  };
}
```

## Rules recap

- Handlers are arrow-function properties, so routes pass `controller.method` without `.bind`.
- Cast `request.body` / `query` / `params` to the shared types — Fastify already validated them.
- `processPagination` caps `pageSize` at `MAX_PAGE_SIZE`, parses `filters` JSON and turns `isActive` into a boolean;
  a malformed value becomes a 400.
- No business logic here: no Prisma queries, no transactions, no audit, no `if (!x) throw NotFoundError` — the
  service does that.
- 200 for reads/updates, 201 (`createdResponse`) for creates, 204 (`noContentResponse`) for deletes. The frontend
  checks `resp.success`, and builds the success envelope itself for 204s (no body).
- Never put secrets in a response: map fields explicitly instead of spreading the Prisma row (the user mapper leaves
  out `deletedAt`, and the password is never loaded in the first place).
