import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import { SocketMessageName } from './socket.enum';

@Injectable()
export class SocketConnectorService implements OnModuleInit, OnModuleDestroy {
  private readonly wsUrl = process.env.SOCKET_HOST;
  private readonly logger: Logger;
  private client: Socket;

  onModuleInit() {
    this.connect();
  }
  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  private connect() {
    this.client = io(this.wsUrl, {
      query: {
        room: undefined,
      },
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to WebSocket server');
    });

    this.client.on('disconnect', () => {
      this.logger.log('Disconnected from WebSocket server');
    });

    this.client.on('error', (error) => {
      this.logger.error('WebSocket error:', error);
    });

    this.client.on('joinedRoom', (room) => {
      console.log(`✅ Joined room: ${room}`);
    });
  }

  connectRoom(room: string) {
    this.client.emit(SocketMessageName.JOIN_ROOM, { room });
  }

  sendLiveCount(data: { value: number; room: string }): void {
    if (this.client && this.client.connected) {
      this.client.emit(SocketMessageName.COUNT, data);
    } else {
      this.logger.warn('WebSocket not connected, cannot send message');
    }
  }
}
