import { Test, TestingModule } from '@nestjs/testing';
import { DefaultSocketGateway } from './gateway/socket.gateway';

describe('SocketService', () => {
  let service: DefaultSocketGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DefaultSocketGateway],
    }).compile();

    service = module.get<DefaultSocketGateway>(DefaultSocketGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
