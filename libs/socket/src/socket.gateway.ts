import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketMessageName } from './socket.enum';

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger: Logger;
  @WebSocketServer() private readonly server: Server;

  handleConnection(client: Socket) {
    const room = client.handshake.query.room as string;

    this.logger.log(`Client connected ${client.id} room: ${room}`);

    client.join(room);
  }

  handleDisconnect(client: any) {
    throw new Error('Method not implemented.');
  }

  @SubscribeMessage(SocketMessageName.COUNT)
  countHandleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: number,
  ) {
    this.logger.log(`Message received ${data}`);

    const room = client.handshake.query.room as string;

    this.server.to(room).emit(SocketMessageName.COUNT, data);

    this.logger.log(`Send room: ${room}, data: ${data}`);
  }
}
