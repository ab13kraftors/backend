import { Test, TestingModule } from '@nestjs/testing';
import { LimitsRiskController } from './limits-risk.controller';

describe('LimitsRiskController', () => {
  let controller: LimitsRiskController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LimitsRiskController],
    }).compile();

    controller = module.get<LimitsRiskController>(LimitsRiskController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
