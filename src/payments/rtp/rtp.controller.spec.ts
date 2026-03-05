import { Test, TestingModule } from '@nestjs/testing';
import { RtpController } from './rtp.controller';

describe('RtpController', () => {
  let controller: RtpController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RtpController],
    }).compile();

    controller = module.get<RtpController>(RtpController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
