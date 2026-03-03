import { Test, TestingModule } from '@nestjs/testing';
import { FinaddressController } from './finaddress.controller';

describe('FinaddressController', () => {
  let controller: FinaddressController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinaddressController],
    }).compile();

    controller = module.get<FinaddressController>(FinaddressController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
