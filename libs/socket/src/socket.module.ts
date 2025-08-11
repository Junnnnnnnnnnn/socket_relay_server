import { Module } from '@nestjs/common';
import { DefaultSocketGateway } from './gateway/socket.gateway';

@Module({
  providers: [DefaultSocketGateway],
  exports: [DefaultSocketGateway],
})
export class SocketModule {}
