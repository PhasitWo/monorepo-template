/* eslint-disable consistent-return */
import { FastifyReply, FastifyRequest } from 'fastify';
import pino from 'pino';
import jwt from 'jsonwebtoken';
import { appConfig } from '../common/config/appConfig';

const logger = pino({ name: 'AuthMiddleware' });

export interface AuthUser {
  userId: string;
  username: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    isAuthenticated?: boolean;
    user?: AuthUser;
  }
}

export class AuthMiddleware {
  private readonly jwtSecret: string;
  constructor() {
    this.jwtSecret = appConfig.JWT_ACCESS_SECRET ?? 'your_secret';
  }

  authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        logger.warn({ url: request.url }, 'Authentication failed: No token provided');
        return reply.status(401).send({
          message: 'Authorization header missing or malformed',
        });
      }

      const token = authHeader.substring(7);

      let payload: AuthUser;
      try {
        payload = this.verifyJwt<AuthUser>(token);
      } catch (jwtError) {
        logger.warn(
          {
            url: request.url,
            error: jwtError instanceof Error ? jwtError.message : 'Unknown JWT error',
          },
          'Authentication failed: Invalid token',
        );
        return reply.status(401).send({
          message: 'invalid or expired token',
        });
      }

      request.isAuthenticated = true;
      request.user = { userId: payload.userId, username: payload.username };
      request.requestContext.set('audit', {
        ...request.requestContext.get('audit'),
        actorUserId: payload.userId,
        actorUsername: payload.username,
      });
    } catch {
      return reply.status(500).send({
        message: 'Authentication service error',
      });
    }
  };

  private verifyJwt<T = unknown>(token: string): T {
    return jwt.verify(token, this.jwtSecret) as T;
  }
}
