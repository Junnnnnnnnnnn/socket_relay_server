import { Module } from '@nestjs/common';
import { DefaultSocketGateway } from './gateway/socket.gateway';
import { BaseballSocketGateway } from './gateway/baseball.socket.gateway';
import { ClimbSocketGateway } from './gateway/climb.socket.gateway';
import { DartSocketGateway } from './gateway/dart.socket.gateway';
import { SocketService } from './socket.service';

@Module({
  providers: [
    DefaultSocketGateway,
    BaseballSocketGateway,
    ClimbSocketGateway,
    DartSocketGateway,
    SocketService,
  ],
  exports: [
    DefaultSocketGateway,
    BaseballSocketGateway,
    ClimbSocketGateway,
    DartSocketGateway,
    SocketService,
  ],
})
export class SocketModule {}
