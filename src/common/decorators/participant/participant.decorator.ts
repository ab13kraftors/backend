import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

// Custom decorator to extract participantId from request
export const Participant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    // Get HTTP request object
    const request = ctx.switchToHttp().getRequest();

    // Return participantId set by ParticipantGuard
    return request.participantId; // set by ParticipantGuard from participant-id header
  },
);
