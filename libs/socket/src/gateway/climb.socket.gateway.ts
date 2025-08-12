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
  color: string;
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
const COLORS = ['#ff6b6b', '#4dabf7', '#51cf66', '#ffd43b'];

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
      state = { code: room, players: new Map(), status: 'idle', maxPlayers: 4 };
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

    // Assign color
    const color = COLORS[state.players.size % COLORS.length];
    state.players.set(client.id, {
      id: client.id,
      name: data.name || `P${state.players.size + 1}`,
      color,
      progress: 0,
    });

    client.emit('joinedRoom', { room: data.room });
    this.broadcastState(state);
  }

  @SubscribeMessage('startGame')
  handleStartGame(@MessageBody() _: any, @ConnectedSocket() client: Socket) {
    const state = this.findRoomBySocket(client.id);
    if (!state) return;
    if (state.displayId !== client.id) {
      client.emit('error', {
        code: 'NOT_DISPLAY',
        message: 'Only display can start',
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
    console.log('DATA ::: ', data);
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
        color: p.color,
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
