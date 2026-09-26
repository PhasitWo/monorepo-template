import { FastifyReply, FastifyRequest } from 'fastify';

/** A request with a working requestContext; `store` exposes what was set on it. */
export function makeRequest(overrides: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { audit: { requestId: 'r1', ip: '::1' } };
  return {
    url: '/api/v1/x',
    headers: {},
    query: {},
    params: {},
    body: {},
    requestContext: {
      get: jest.fn((key: string) => store[key]),
      set: jest.fn((key: string, value: unknown) => {
        store[key] = value;
      }),
    },
    store,
    ...overrides,
  } as unknown as FastifyRequest & { store: Record<string, unknown> };
}

export function makeReply() {
  const reply = { status: jest.fn(), send: jest.fn() };
  reply.status.mockReturnValue(reply);
  reply.send.mockReturnValue(reply);
  return reply as unknown as FastifyReply & { status: jest.Mock; send: jest.Mock };
}

/** The body passed to the first reply.send() call. */
export const sent = (reply: { send: jest.Mock }) => reply.send.mock.calls[0][0];
