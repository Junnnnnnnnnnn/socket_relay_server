import { Test, TestingModule } from '@nestjs/testing';
import { SocketGateway } from './socket.gateway';

describe('SocketService', () => {
  let service: SocketGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SocketGateway],
    }).compile();

    service = module.get<SocketGateway>(SocketGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
