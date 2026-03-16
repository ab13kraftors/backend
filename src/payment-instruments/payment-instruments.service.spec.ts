import { Test, TestingModule } from '@nestjs/testing';
import { PaymentInstrumentsService } from './payment-instruments.service';

describe('PaymentInstrumentsService', () => {
  let service: PaymentInstrumentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentInstrumentsService],
    }).compile();

    service = module.get<PaymentInstrumentsService>(PaymentInstrumentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
