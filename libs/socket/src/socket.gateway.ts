import { Injectable, Logger } from '@nestjs/common';
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
  @WebSocketServer() private readonly server: Server;

  handleConnection(client: Socket) {
    const room = client.handshake.query.room as string;

    console.log(`Client connected ${client.id} room: ${room}`);

    if (room) client.join(room);
  }

  handleDisconnect(client: Socket) {
    const room = client.handshake.query.room as string;

    if (room) {
      client.leave(room);
      console.log(`Client ${client.id} disconnected from room ${room}`);
    } else {
      console.log(`Client ${client.id} disconnected (no room info)`);
    }
  }

  /**
   * Handles incoming COUNT events from a client.
   *
   * NOTE: On the client side, emit a COUNT event with a payload object:
   *   socket.emit(SocketMessageName.COUNT, { count: number });
   *
   * Then listen for COUNT broadcasts in the room:
   *   socket.on(SocketMessageName.COUNT, (updatedCount) => {
   *     console.log(`New count in room: ${updatedCount}`);
   *   });
   */
  @SubscribeMessage(SocketMessageName.COUNT)
  countHandleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody('count') count: number,
  ): void {
    console.log(`Message received: ${count}`);

    const room = client.handshake.query.room as string;

    this.server.to(room).emit(SocketMessageName.COUNT, count);

    console.log(`Sent to room: ${room}, data: ${count}`);
  }

  /**
   * Handles a client joining a room.
   *
   * NOTE: On the client side, you must register a listener for the 'joinedRoom' event:
   *   socket.on('joinedRoom', (room) => {
   *     console.log(`✅ Joined room: ${room}`);
   *     // proceed with further logic...
   *   });
   */
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody('room') room: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(room);
    client.emit('joinedRoom', room);
    console.log(`ClientId: ${client.id} Sent to room: ${room}`);
  }
}
