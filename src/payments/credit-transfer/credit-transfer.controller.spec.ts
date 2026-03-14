import { Test, TestingModule } from '@nestjs/testing';
import { CreditTransferController } from './credit-transfer.controller';

describe('CreditTransferController', () => {
  let controller: CreditTransferController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreditTransferController],
    }).compile();

    controller = module.get<CreditTransferController>(CreditTransferController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
