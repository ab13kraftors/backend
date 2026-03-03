import { Test, TestingModule } from '@nestjs/testing';
import { FinaddressService } from './finaddress.service';

describe('FinaddressService', () => {
  let service: FinaddressService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FinaddressService],
    }).compile();

    service = module.get<FinaddressService>(FinaddressService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
