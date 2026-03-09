import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Participant } from './entities/participant.entity';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

// FIX C1: real login — validates credentials against DB with bcrypt
@Injectable()
export class AuthService {
  constructor(
    // Inject JWT service for token generation
    private readonly jwtService: JwtService,

    // Inject Participant repository
    @InjectRepository(Participant)
    private readonly participantRepo: Repository<Participant>,
  ) {}

  // ================== login ==================
  // Authenticates user and returns JWT token
  async login(dto: LoginDto): Promise<string> {
    const participant = await this.participantRepo.findOne({
      where: { username: dto.username, isActive: true },
    });

    // Validate user existence and password
    // Same error used to prevent username enumeration
    if (
      !participant ||
      !(await bcrypt.compare(dto.password, participant.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Create JWT payload
    const payload = {
      sub: participant.participantId,
      participantId: participant.participantId,
      username: participant.username,
      roles: participant.roles,
    };

    // Generate signed JWT token
    return this.jwtService.sign(payload);
  }

  // ================== validate ==================
  // Validates JWT payload during authentication
  async validate(payload: any) {
    if (!payload || !payload.sub || !payload.participantId) {
      throw new UnauthorizedException();
    }

    return payload;
  }
}
