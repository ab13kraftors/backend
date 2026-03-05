import { Test, TestingModule } from '@nestjs/testing';
import { RtpService } from './rtp.service';

describe('RtpService', () => {
  let service: RtpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RtpService],
    }).compile();

    service = module.get<RtpService>(RtpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
