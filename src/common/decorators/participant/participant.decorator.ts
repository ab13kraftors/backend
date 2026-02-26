import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const Participant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<any>();
    return request.participantId;
  },
);
