import { FastifyInstance } from 'fastify';
import { registerAuditLogRoutes } from '../auditLog.routes';
import { registerAuthRoutes } from '../auth.routes';
import { registerTagRoutes } from '../tag.routes';
import { registerUserRoutes } from '../user.routes';

function fakeFastify() {
  const routes: string[] = [];
  const record = (method: string) =>
    jest.fn((path: string) => {
      routes.push(`${method.toUpperCase()} ${path}`);
    });
  const instance = {
    get: record('get'),
    post: record('post'),
    put: record('put'),
    patch: record('patch'),
    delete: record('delete'),
  };
  return { instance: instance as unknown as FastifyInstance, routes };
}

// every routes file: add new ones here
describe('route registration', () => {
  it.each([
    ['auth', registerAuthRoutes, ['POST /auth/login', 'POST /auth/refresh']],
    ['audit log', registerAuditLogRoutes, ['GET /audit-logs']],
    ['tag', registerTagRoutes, ['GET /tags/:id', 'GET /tags', 'POST /tags', 'PUT /tags/:id']],
    [
      'user',
      registerUserRoutes,
      ['POST /users', 'GET /users/:id', 'GET /users', 'PUT /users/:id', 'DELETE /users/:id'],
    ],
  ])('wires %s routes', (_name, register, expected) => {
    const { instance, routes } = fakeFastify();

    register(instance);

    expect(routes).toEqual(expected);
  });
});
