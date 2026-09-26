import { requestContext } from '@fastify/request-context';

export interface AuditContext {
  actorUserId?: string | null;
  actorUsername?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

declare module '@fastify/request-context' {
  interface RequestContextData {
    audit: AuditContext;
  }
}

/** The current request's audit context (filled by server.ts and AuthMiddleware), or `{}` outside a request. */
export function getAuditContext(): AuditContext {
  // requestContext.get() returns undefined outside a request's async scope
  return requestContext.get('audit') ?? {};
}
