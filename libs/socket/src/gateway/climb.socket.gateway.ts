import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

type Role = 'display' | 'controller';
type RoomCode = string;

interface Player {
  id: string;
  name?: string;
  progress: number; // 0..100 (%)
}

interface RoomState {
  code: RoomCode;
  displayId?: string;
  players: Map<string, Player>;
  status: 'idle' | 'running' | 'ended';
  maxPlayers: number;
}

const rooms = new Map<RoomCode, RoomState>();

@WebSocketGateway({ namespace: 'climb', cors: { origin: '*' } })
export class ClimbSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ClimbSocketGateway.name);

  handleConnection(client: Socket) {
    const room = (client.handshake.query.room as string) || '';
    const role = (client.handshake.query.role as Role) || 'controller';

    if (!room) {
      client.emit('error', { code: 'NO_ROOM', message: 'Room is required' });
      client.disconnect();
      return;
    }

    let state = rooms.get(room);
    if (!state) {
      // Recommended to have the display create the room first
      state = { code: room, players: new Map(), status: 'idle', maxPlayers: 2 };
      rooms.set(room, state);
    }

    client.join(room);

    if (role === 'display') {
      state.displayId = client.id;
      this.logger.log(`Display connected for room ${room}`);
    } else {
      // Controller is finalized via joinRoom event (capacity is checked then)
      this.logger.log(`Controller connected (pending join) room ${room}`);
    }

    // 방의 현재 플레이어 수 브로드캐스트 (controller만 카운트)
    const playerCount = state.players.size;
    this.server.to(room).emit('roomPlayerCount', { room, playerCount });
  }

  handleDisconnect(client: Socket) {
    // Iterate through all rooms to clean up (usually only belongs to one room, but this is safer)
    for (const state of rooms.values()) {
      if (state.displayId === client.id) {
        // If display disconnects, broadcast game over and clean up the room
        this.server.to(state.code).emit('gameOver', {
          winnerId: null,
          snapshot: this.snapshot(state),
          reason: 'display_disconnected',
        });
        this.logger.log(`Display disconnected, closing room ${state.code}`);
        rooms.delete(state.code);
        continue;
      }

      if (state.players.has(client.id)) {
        state.players.delete(client.id);
        this.logger.log(`Player ${client.id} left room ${state.code}`);
        this.broadcastState(state);

        // 방의 현재 플레이어 수 브로드캐스트
        const playerCount = state.players.size;
        this.server
          .to(state.code)
          .emit('roomPlayerCount', { room: state.code, playerCount });

        // If the room is empty and there's no display, remove it
        if (!state.displayId && state.players.size === 0) {
          rooms.delete(state.code);
        }
      }
    }
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() data: { room: string; name?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const state = rooms.get(data.room);
    if (!state) {
      client.emit('error', { code: 'NO_SUCH_ROOM', message: 'Room not found' });
      return;
    }

    if (state.players.size >= state.maxPlayers) {
      client.emit('error', { code: 'ROOM_FULL', message: 'Room is full' });
      return;
    }

    state.players.set(client.id, {
      id: client.id,
      name: data.name || `P${state.players.size + 1}`,
      progress: 0,
    });

    // 방의 현재 플레이어 수 브로드캐스트
    const playerCount = state.players.size;
    client.emit('joinedRoom', { room: data.room, playerCount });
    this.server
      .to(data.room)
      .emit('roomPlayerCount', { room: data.room, playerCount });
    this.broadcastState(state);
  }

  @SubscribeMessage('startGame')
  handleStartGame(@MessageBody() _: any, @ConnectedSocket() client: Socket) {
    const state = this.findRoomBySocket(client.id);

    if (!state) return;
    if (state.players.size < 2) {
      client.emit('error', {
        code: 'NOT_ENOUGH_PLAYERS',
        message: 'Not enough players to start',
      });
      return;
    }
    if (state.displayId == undefined || state.displayId == null) {
      client.emit('error', {
        code: 'NO_DISPLAY',
        message: 'Display not found',
      });
      return;
    }

    // Initialize
    for (const p of state.players.values()) p.progress = 0;

    state.status = 'running';

    this.server.to(state.code).emit('gameStarted');
    this.broadcastState(state);
  }

  @SubscribeMessage('shake')
  handleShake(
    @MessageBody() data: { delta: number },
    @ConnectedSocket() client: Socket,
  ) {
    const state = this.findRoomBySocket(client.id);
    if (!state || state.status !== 'running') return;

    const player = state.players.get(client.id);
    if (!player) return;

    // Simple anti-cheat: input clamp & scale
    const clamped = Math.max(0, Math.min(data.delta ?? 0, 20)); // Max 20 per sample
    const gain = 0.05; // Difficulty adjustment
    player.progress = Math.max(
      0,
      Math.min(100, player.progress + clamped * gain),
    );

    console.log('player ::: ', player);
    // Victory condition check
    if (player.progress >= 100) {
      state.status = 'ended';
      this.server.to(state.code).emit('gameOver', {
        winnerId: player.id,
        snapshot: this.snapshot(state),
      });
    } else {
      // Broadcast progress
      this.broadcastState(state);
    }
  }

  private broadcastState(state: RoomState) {
    const payload = this.snapshot(state);
    this.server.to(state.code).emit('stateUpdate', payload);
  }

  private snapshot(state: RoomState) {
    return {
      status: state.status,
      players: Array.from(state.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        progress: p.progress,
      })),
    };
  }

  private findRoomBySocket(socketId: string): RoomState | undefined {
    for (const s of rooms.values()) {
      if (s.displayId === socketId) return s;
      if (s.players.has(socketId)) return s;
    }
    return undefined;
  }
}
