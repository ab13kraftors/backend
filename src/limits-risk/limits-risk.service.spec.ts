import { Test, TestingModule } from '@nestjs/testing';
import { LimitsRiskService } from './limits-risk.service';

describe('LimitsRiskService', () => {
  let service: LimitsRiskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LimitsRiskService],
    }).compile();

    service = module.get<LimitsRiskService>(LimitsRiskService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
