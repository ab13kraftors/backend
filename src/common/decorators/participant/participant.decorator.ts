import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

// export const Participant = createParamDecorator(
//   (_: unknown, ctx: ExecutionContext) => {
//     const request = ctx.switchToHttp().getRequest<any>();
//     return request.participantId;
//   },
// );

export const Participant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // Passport puts the JWT payload in request.user
    return request.user?.participantId;
  },
);
