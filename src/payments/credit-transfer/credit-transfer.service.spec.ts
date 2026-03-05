import { Test, TestingModule } from '@nestjs/testing';
import { CreditTransferService } from './credit-transfer.service';

describe('CreditTransferService', () => {
  let service: CreditTransferService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CreditTransferService],
    }).compile();

    service = module.get<CreditTransferService>(CreditTransferService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
