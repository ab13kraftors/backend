import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ParticipantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const participantId = req.headers['participant-id'];
    if (!participantId || typeof participantId !== 'string') {
      throw new BadRequestException('participant-id header is requied');
    }
    // attach to req for downstream usage
    (req as any).participantId = participantId;
    return true;
  }
}
