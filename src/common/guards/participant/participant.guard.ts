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
    @InjectRepository(Participant)
    private readonly parRepo: Repository<Participant>,
  ) {}

  // ================== canActivate ==================
  // Validates participant-id header before allowing request
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const bankId = req.headers['participant-id'] as string;

    // Check if participant exists and is active
    const bank = await this.parRepo.findOne({
      where: {
        participantId: bankId,
        isActive: true,
      },
    });

    if (!bank)
      throw new UnauthorizedException(
        'This Participant ID is not registered or active',
      );

    // Attach participantId to request for downstream usage
    // (req as any).participantId = bankId;

    const rolesArray = [bank.roles];

    // 1. Attach to request root (as requested)
    const request = req as any;
    request.participantId = bank.participantId;
    request.bankId = bank.participantId;
    request.name = bank.username; // Using username as name
    request.roles = rolesArray;

    // 2. Attach to req.user for NestJS standard usage
    req.user = {
      id: bank.participantId,
      name: bank.username,
      roles: rolesArray,
    };

    return true;
  }
}
