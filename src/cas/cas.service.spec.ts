import { Test, TestingModule } from '@nestjs/testing';
import { CasService } from './cas.service';

describe('CasService', () => {
  let service: CasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CasService],
    }).compile();

    service = module.get<CasService>(CasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
