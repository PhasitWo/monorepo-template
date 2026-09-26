import { FastifyReply, FastifyRequest } from 'fastify';
import { LoginBody, RefreshTokenBody } from '@repo/shared';
import { BaseController } from './baseController';
import { AuthService } from '../services/auth.service';

export class AuthController extends BaseController {
  constructor(private readonly authService: AuthService) {
    super('AuthController');
  }

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const tokens = await this.authService.login(request.body as LoginBody);
    return this.successResponse(reply, tokens);
  };

  refresh = async (request: FastifyRequest, reply: FastifyReply) => {
    const tokens = await this.authService.refresh(request.body as RefreshTokenBody);
    return this.successResponse(reply, tokens);
  };
}
