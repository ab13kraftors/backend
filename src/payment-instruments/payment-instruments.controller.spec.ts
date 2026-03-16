import { Test, TestingModule } from '@nestjs/testing';
import { PaymentInstrumentsController } from './payment-instruments.controller';

describe('PaymentInstrumentsController', () => {
  let controller: PaymentInstrumentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentInstrumentsController],
    }).compile();

    controller = module.get<PaymentInstrumentsController>(
      PaymentInstrumentsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
