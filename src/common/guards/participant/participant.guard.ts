import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Participant } from 'src/auth/entities/participant.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ParticipantGuard implements CanActivate {
  constructor(
    // Inject Participant repository
    @InjectRepository(Participant)
    private readonly parRepo: Repository<Participant>,
  ) {}

  // ================== canActivate ==================
  // Validates participant-id header before allowing request
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get HTTP request object
    const req = context.switchToHttp().getRequest<Request>();

    // Extract participant-id from request headers
    const headerId = req.headers['participant-id'] as string;

    // Check if participant exists and is active
    const exists = await this.parRepo.findOne({
      where: {
        participantId: headerId,
        isActive: true,
      },
    });

    // Reject request if participant is invalid
    if (!exists)
      throw new UnauthorizedException(
        'This Participant ID is not registered or active',
      );

    // Attach participantId to request for downstream usage
    (req as any).participantId = headerId;

    return true;
  }
}
