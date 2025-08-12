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

type RoomCode = string;

interface Batter {
  id: string;
  name: string;
  color: string;
  score: number;
}

interface Ball {
  id: string;
  spawnAt: number;
  plateTime: number;
  active: boolean;
  hitBy?: string; // batterId
}

interface RoomState {
  code: RoomCode;
  displayId?: string;
  batter?: Batter; // Only one batter allowed
  status: 'idle' | 'running';
  ballById: Map<string, Ball>;
  spawnTimer?: NodeJS.Timeout;
}

const rooms = new Map<RoomCode, RoomState>();

// ===== Game Parameters =====
const FALL_MS = 1600; // Ball fall time (top to home plate)
const SPAWN_INTERVAL_MS = 2200; // Spawn interval
const PERFECT_WINDOW_MS = 90; // |diff| <= 90ms -> center
const EXPIRE_AFTER_MS = 250; // Grace period for expiration after reaching the plate

@WebSocketGateway({ namespace: 'baseball', cors: { origin: '*' } })
export class BaseballSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(BaseballSocketGateway.name);

  // ===== Connection/Disconnection =====
  handleConnection(client: Socket) {
    const room = (client.handshake.query.room as string) || '';
    const role = (client.handshake.query.role as string) || 'controller';
    if (!room) {
      client.emit('error', { code: 'NO_ROOM', message: 'Room is required' });
      client.disconnect();
      return;
    }

    let state = rooms.get(room);
    if (!state) {
      state = { code: room, status: 'idle', ballById: new Map() };
      rooms.set(room, state);
    }
    client.join(room);

    if (role === 'display') {
      state.displayId = client.id;
      this.logger.log(`Display connected: room=${room}`);
      this.pushState(state);
    } else {
      this.logger.log(`Controller connected (pending join): room=${room}`);
      // Actual batter registration is handled in the joinRoom event
    }
  }

  handleDisconnect(client: Socket) {
    for (const state of rooms.values()) {
      // If display disconnects, end game and clean up room
      if (state.displayId === client.id) {
        this.stopSpawning(state);
        this.server
          .to(state.code)
          .emit('gameOver', {
            reason: 'display_disconnected',
            snapshot: this.snapshot(state),
          });
        rooms.delete(state.code);
        continue;
      }
      // If batter leaves, release the slot
      if (state.batter?.id === client.id) {
        state.batter = undefined;
        this.server.to(state.code).emit('batterLeft');
        // If in progress, stop spawning to simulate a pause (can also end the game if desired)
        this.stopSpawning(state);
        state.status = 'idle';
        this.pushState(state);
      }
      // If no one is left, remove the room
      if (!state.displayId && !state.batter) {
        rooms.delete(state.code);
      }
    }
  }

  // ===== Batter Join/Leave =====
  @SubscribeMessage('joinRoom')
  joinRoom(
    @MessageBody() data: { room: string; name?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const state = rooms.get(data.room);
    if (!state)
      return client.emit('error', {
        code: 'NO_SUCH_ROOM',
        message: 'Room not found',
      });

    if (state.batter && state.batter.id !== client.id) {
      return client.emit('error', {
        code: 'ROOM_OCCUPIED',
        message: 'Batter slot is occupied',
      });
    }

    // Register/update batter
    state.batter = {
      id: client.id,
      name: data.name?.slice(0, 16) || 'Batter',
      color: '#ffd43b',
      score: state.batter?.score ?? 0,
    };
    client.emit('joinedRoom', { room: data.room, role: 'batter' });
    this.server
      .to(state.code)
      .emit('batterReady', {
        id: client.id,
        name: state.batter.name,
        color: state.batter.color,
      });
    this.pushState(state);
  }

  @SubscribeMessage('leaveRoom')
  leaveRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: Socket,
  ) {
    const state = rooms.get(data.room);
    if (!state) return;
    if (state.batter?.id === client.id) {
      state.batter = undefined;
      this.server.to(state.code).emit('batterLeft');
      this.stopSpawning(state);
      state.status = 'idle';
      this.pushState(state);
    }
  }

  // ===== Game Start/Stop (Display Only) =====
  @SubscribeMessage('startGame')
  startGame(@MessageBody() _: any, @ConnectedSocket() client: Socket) {
    const state = this.findRoomBySocket(client.id);
    if (!state) return;
    if (state.displayId !== client.id)
      return client.emit('error', {
        code: 'NOT_DISPLAY',
        message: 'Only display can start',
      });
    if (!state.batter)
      return client.emit('error', {
        code: 'NO_BATTER',
        message: 'No batter in room',
      });

    // Initialize
    state.status = 'running';
    state.ballById.clear();
    this.server.to(state.code).emit('gameStarted');
    this.pushState(state);

    this.startSpawning(state);
  }

  @SubscribeMessage('stopGame')
  stopGame(@MessageBody() _: any, @ConnectedSocket() client: Socket) {
    const state = this.findRoomBySocket(client.id);
    if (!state) return;
    if (state.displayId !== client.id)
      return client.emit('error', {
        code: 'NOT_DISPLAY',
        message: 'Only display can stop',
      });

    this.stopSpawning(state);
    state.status = 'idle';
    this.server
      .to(state.code)
      .emit('gameOver', { reason: 'stopped', snapshot: this.snapshot(state) });
    this.pushState(state);
  }

  // ===== Swing (Batter Only) =====
  @SubscribeMessage('swing')
  swing(
    @MessageBody() data: { ballId: string; power?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const state = this.findRoomBySocket(client.id);
    if (!state || state.status !== 'running') return;
    if (!state.batter || state.batter.id !== client.id) return; // Only batter can swing

    const ball = state.ballById.get(data.ballId);
    if (!ball || !ball.active) return;
    if (ball.hitBy) return; // Already processed

    const now = Date.now();
    const diff = now - ball.plateTime; // (-) early / (+) late
    const outcome = this.judge(diff);
    const power = Math.max(0, Math.min(1, data.power ?? 0.8));

    ball.hitBy = client.id;
    ball.active = false;

    // Score (example): center=2, side=1
    state.batter.score += outcome === 'center' ? 2 : 1;

    this.server.to(state.code).emit('hit', {
      ballId: ball.id,
      outcome, // 'left' | 'center' | 'right'
      power,
      timingMs: diff,
      batter: {
        id: state.batter.id,
        name: state.batter.name,
        color: state.batter.color,
        score: state.batter.score,
      },
    });
    this.pushState(state);
  }

  // ===== Internal: Ball Spawn Loop =====
  private startSpawning(state: RoomState) {
    if (state.spawnTimer) clearInterval(state.spawnTimer);
    state.spawnTimer = setInterval(
      () => this.spawnBall(state),
      SPAWN_INTERVAL_MS,
    );
    this.spawnBall(state); // Spawn one immediately
  }

  private stopSpawning(state: RoomState) {
    if (state.spawnTimer) {
      clearInterval(state.spawnTimer);
      state.spawnTimer = undefined;
    }
    state.ballById.clear();
  }

  private spawnBall(state: RoomState) {
    if (state.status !== 'running' || !state.batter) return;

    const id = `b_${Math.random().toString(36).slice(2, 8)}`;
    const spawnAt = Date.now();
    const plateTime = spawnAt + FALL_MS;
    const ball: Ball = { id, spawnAt, plateTime, active: true };
    state.ballById.set(id, ball);

    this.server.to(state.code).emit('ballSpawn', {
      ballId: id,
      fallMs: FALL_MS,
      spawnAt, // Option for client-side synchronization
    });

    // Handle expiration (ball hits the ground)
    setTimeout(() => {
      const b = state.ballById.get(id);
      if (!b) return;
      if (!b.hitBy) {
        // Broadcast miss (optional)
        this.server.to(state.code).emit('miss', { ballId: id });
      }
      b.active = false;
      state.ballById.delete(id);
      this.server.to(state.code).emit('ballExpired', { ballId: id });
    }, FALL_MS + EXPIRE_AFTER_MS);
  }

  // ===== Judging =====
  private judge(diffMs: number): 'left' | 'center' | 'right' {
    if (Math.abs(diffMs) <= PERFECT_WINDOW_MS) return 'center';
    return diffMs < 0 ? 'left' : 'right';
  }

  // ===== Broadcasting =====
  private pushState(state: RoomState) {
    this.server.to(state.code).emit('stateUpdate', this.snapshot(state));
  }

  private snapshot(state: RoomState) {
    return {
      status: state.status,
      batter: state.batter
        ? {
            id: state.batter.id,
            name: state.batter.name,
            color: state.batter.color,
            score: state.batter.score,
          }
        : null,
    };
  }

  private findRoomBySocket(socketId: string): RoomState | undefined {
    for (const s of rooms.values()) {
      if (s.displayId === socketId) return s;
      if (s.batter?.id === socketId) return s;
    }
    return undefined;
  }
}
