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
import { Injectable, Logger } from '@nestjs/common';
import { SocketService } from '../socket.service';

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
@Injectable()
export class ClimbSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private readonly socketService: SocketService) {}

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

  /**
   * 큐를 초기화합니다.
   *
   * @description
   * - 대기열의 모든 참가자를 제거하고 큐를 빈 상태로 만듭니다.
   * - 초기화 후 같은 프로젝트의 모든 클라이언트에게 'reset-queue' 이벤트를 브로드캐스트합니다.
   *
   * @param payload - 초기화할 큐가 속한 프로젝트 정보
   * @param payload.project - 프로젝트 이름
   *
   * @emits reset-queue - 큐가 초기화되었음을 알리는 이벤트
   */
  @SubscribeMessage('reset-queue')
  handleResetQueue(@MessageBody() payload: { project: string }) {
    this.socketService.resetQueue('climb');
    this.server.to(payload.project).emit('reset-queue', payload);
  }

  /**
   * 현재 큐의 상태를 조회합니다.
   *
   * @description
   * - 현재 대기열에 있는 모든 참가자의 목록을 반환합니다.
   * - 요청한 클라이언트에게만 큐 상태를 전송합니다 (브로드캐스트 X).
   *
   * @param socket - 큐 상태를 요청한 클라이언트의 소켓
   *
   * @emits status-queue - 현재 큐의 소켓 ID 배열
   */
  @SubscribeMessage('status-queue')
  handleStatusQueue(@ConnectedSocket() socket: Socket) {
    socket.emit('status-queue', this.socketService.getQueue('climb'));
  }

  /**
   * 클라이언트를 큐에 추가합니다.
   *
   * @description
   * - 요청한 클라이언트의 소켓 ID를 대기열에 추가합니다.
   * - 큐에 이미 존재하는 경우 중복 추가되지 않습니다 (SocketService에서 처리).
   * - 큐 변경 후 모든 연결된 클라이언트에게 업데이트된 큐 상태를 브로드캐스트합니다.
   *
   * @param socket - 큐에 참가하려는 클라이언트의 소켓
   *
   * @emits status-queue - 업데이트된 큐의 소켓 ID 배열을 모든 클라이언트에게 전송
   *
   * @example
   * // 클라이언트 측에서 큐에 참가
   * socket.emit('join-queue');
   *
   * // 모든 클라이언트가 받는 이벤트
   * socket.on('status-queue', (queue) => {
   *   console.log('현재 큐:', queue);
   * });
   */
  @SubscribeMessage('join-queue')
  handleJoinQueue(@ConnectedSocket() socket: Socket) {
    this.socketService.addToQueue('climb', socket.id);
    const queue = this.socketService.getQueue('climb');

    // 모든 클라이언트에게 브로드캐스트
    this.server.emit('status-queue', queue);

    console.log(`Socket ${socket.id} joined queue. Current queue:`, queue);
  }

  /**
   * 클라이언트를 큐에서 제거합니다.
   *
   * @description
   * - 요청한 클라이언트의 소켓 ID를 대기열에서 제거합니다.
   * - 큐에 존재하지 않는 경우 아무 동작도 하지 않습니다 (SocketService에서 처리).
   * - 큐 변경 후 모든 연결된 클라이언트에게 업데이트된 큐 상태를 브로드캐스트합니다.
   *
   * @param socket - 큐에서 나가려는 클라이언트의 소켓
   *
   * @emits status-queue - 업데이트된 큐의 소켓 ID 배열을 모든 클라이언트에게 전송
   *
   * @example
   * // 클라이언트 측에서 큐에서 나가기
   * socket.emit('leave-queue');
   *
   * // 모든 클라이언트가 받는 이벤트
   * socket.on('status-queue', (queue) => {
   *   console.log('현재 큐:', queue);
   * });
   */
  @SubscribeMessage('leave-queue')
  handleLeaveQueue(@ConnectedSocket() socket: Socket) {
    this.socketService.removeFromQueue('climb', socket.id);
    const queue = this.socketService.getQueue('climb');

    // 모든 클라이언트에게 브로드캐스트
    this.server.emit('status-queue', queue);

    console.log(`Socket ${socket.id} left queue. Current queue:`, queue);
  }
}
