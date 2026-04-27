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
import { SocketService } from '../socket.service';

interface ClientInfo {
  id: string;
  name: string;
  room: string;
}

@WebSocketGateway({ namespace: 'dart', cors: { origin: '*' } })
@Injectable()
export class DartSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private readonly socketService: SocketService) {}

  @WebSocketServer() private readonly server: Server;
  private readonly logger = new Logger(DartSocketGateway.name);
  private readonly roomClients = new Map<string, Set<string>>();
  private readonly clientInfoMap = new Map<string, ClientInfo>(); // socketId -> ClientInfo
  private readonly MAX_NAME_LENGTH = 32;
  private readonly MAX_ROOM_LENGTH = 64;
  private readonly MAX_PLAYERS_PER_ROOM = 4;
  private readonly GAME_END_CLOSE_DELAY_MS = 5000; // 결과 표시 후 방 종료까지 대기 시간

  handleConnection(client: Socket) {
    const room = client.handshake.query.room as string;

    this.logger.log(`Client connected ${client.id} room: ${room}`);

    if (room) {
      // socket.io 내부 룸 조인만 수행. 참가자 등록/브로드캐스트는 joinRoom에서 처리.
      client.join(room);
    }
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.clientInfoMap.get(client.id);

    // 클라이언트 정보 제거
    this.clientInfoMap.delete(client.id);

    // joinRoom을 완료한(clientInfo가 있는) 클라이언트만 방 상태 갱신/브로드캐스트.
    // connect만 하고 joinRoom 없이 끊긴 observer/실패 케이스는 브로드캐스트 스킵.
    if (!clientInfo) {
      this.logger.log(`Client ${client.id} disconnected (not joined)`);
      return;
    }

    const room = clientInfo.room;
    this.leaveRoomAndBroadcast(client, room);

    this.logger.log(
      `Client ${client.id} (${clientInfo.name}) disconnected from room ${room}, remaining players: ${this.getRoomPlayerCount(room)}`,
    );
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() payload: { room: string; name?: string },
    @ConnectedSocket() client: Socket,
  ) {
    // 입력 검증
    const room = payload?.room;
    if (
      !room ||
      typeof room !== 'string' ||
      room.length === 0 ||
      room.length > this.MAX_ROOM_LENGTH
    ) {
      return;
    }

    const rawName =
      payload?.name || this.clientInfoMap.get(client.id)?.name || 'Unknown';
    const trimmedName = String(rawName).trim().slice(0, this.MAX_NAME_LENGTH);
    const name = trimmedName || 'Unknown';

    // 방이 가득 찼는지 확인 (이미 이 방에 있는 경우는 제외 — 재연결/이름변경 보호)
    const alreadyInRoom = this.roomClients.get(room)?.has(client.id) ?? false;
    if (
      !alreadyInRoom &&
      this.getRoomPlayerCount(room) >= this.MAX_PLAYERS_PER_ROOM
    ) {
      this.logger.log(
        `Client ${client.id} (${name}) rejected: room ${room} is full (max ${this.MAX_PLAYERS_PER_ROOM})`,
      );
      client.emit('roomFull', {
        room,
        maxPlayers: this.MAX_PLAYERS_PER_ROOM,
      });
      return;
    }

    // 이전에 다른 방에 속해 있었다면 먼저 나간다 (방 이동 시 스테일 엔트리 방지)
    const prevInfo = this.clientInfoMap.get(client.id);
    if (prevInfo && prevInfo.room !== room) {
      this.leaveRoomAndBroadcast(client, prevInfo.room);
    }

    client.join(room);

    // 클라이언트 정보 업데이트
    this.clientInfoMap.set(client.id, {
      id: client.id,
      name,
      room,
    });

    // 방의 클라이언트 목록에 추가 (이미 추가되어 있을 수 있음)
    if (!this.roomClients.has(room)) {
      this.roomClients.set(room, new Set());
    }
    this.roomClients.get(room)!.add(client.id);

    // 방의 현재 접속 인원 수 확인
    const playerCount = this.getRoomPlayerCount(room);
    const players = this.getRoomPlayers(room);

    // 참가자 리스트는 joinedRoom 이벤트에만 포함 — 방의 모든 클라이언트에게 브로드캐스트
    this.server.to(room).emit('joinedRoom', { room, playerCount, players });

    // 방의 모든 클라이언트에게 업데이트된 인원 수 전송 (count만)
    this.server.to(room).emit('roomPlayerCount', { room, playerCount });

    this.logger.log(
      `ClientId: ${client.id} (${name}) joined room: ${room}, current players: ${playerCount}`,
    );
  }

  /**
   * 클라이언트를 특정 방에서 제거하고 해당 방의 갱신된 상태를 브로드캐스트한다.
   * (다중 방 이동 시 이전 방 정리용)
   */
  private leaveRoomAndBroadcast(client: Socket, room: string) {
    client.leave(room);

    const roomSet = this.roomClients.get(room);
    if (roomSet) {
      roomSet.delete(client.id);
      if (roomSet.size === 0) {
        this.roomClients.delete(room);
      }
    }

    const playerCount = this.getRoomPlayerCount(room);
    const players = this.getRoomPlayers(room);
    this.server.to(room).emit('joinedRoom', { room, playerCount, players });
    this.server.to(room).emit('roomPlayerCount', { room, playerCount });
  }

  private getRoomPlayerCount(room: string): number {
    const roomSet = this.roomClients.get(room);
    return roomSet ? roomSet.size : 0;
  }

  private getRoomPlayers(
    room: string,
  ): Array<{ socketId: string; name: string }> {
    const roomSet = this.roomClients.get(room);
    if (!roomSet) return [];
    return Array.from(roomSet).map((socketId) => {
      const info = this.clientInfoMap.get(socketId);
      return {
        socketId,
        name: info?.name || 'Unknown',
      };
    });
  }

  /**
   * 해당 방의 모든 클라이언트를 서버에서 강제 연결 해제한다.
   *
   * @description
   * - 룸의 모든 소켓(observer 포함)을 disconnect한다.
   * - 각 클라이언트는 handleDisconnect를 통해 정상적으로 정리된다.
   *
   * @param payload.room - 연결 해제할 룸 이름
   */
  @SubscribeMessage('disconnect-room')
  handleDisconnectRoom(
    @MessageBody() payload: { room: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = payload?.room;
    if (
      !room ||
      typeof room !== 'string' ||
      room.length === 0 ||
      room.length > this.MAX_ROOM_LENGTH
    ) {
      return;
    }

    this.logger.log(
      `Client ${client.id} requested disconnect-room for room: ${room}`,
    );

    this.server.in(room).disconnectSockets();
  }

  @SubscribeMessage('throw-dart')
  handleThrow(
    @MessageBody()
    payload: {
      room: string;
      name: string;
      aim: { x: number; y: number };
      score: number;
    },
  ) {
    this.logger.log(`DART-THROWN ::: ${JSON.stringify(payload)}`);
    this.server.to(payload.room).emit('dart-thrown', payload);
  }

  @SubscribeMessage('aim-update')
  handleAimUpdate(
    @MessageBody()
    payload: {
      room: string;
      name: string;
      aim: { x: number; y: number };
    },
  ) {
    this.server.to(payload.room).emit('aim-update', payload);
  }

  @SubscribeMessage('aim-off')
  handleAimOff(@MessageBody() payload: { room: string; name: string }) {
    this.server.to(payload.room).emit('aim-off', payload);
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
    this.socketService.resetQueue('dart');
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
    socket.emit('status-queue', this.socketService.getQueue('dart'));
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
    this.socketService.addToQueue('dart', socket.id);
    const queue = this.socketService.getQueue('dart');

    // 모든 클라이언트에게 브로드캐스트
    this.server.emit('status-queue', queue);

    this.logger.log(
      `Socket ${socket.id} joined queue. Current queue: ${JSON.stringify(queue)}`,
    );
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
    this.socketService.removeFromQueue('dart', socket.id);
    const queue = this.socketService.getQueue('dart');

    // 모든 클라이언트에게 브로드캐스트
    this.server.emit('status-queue', queue);

    this.logger.log(
      `Socket ${socket.id} left queue. Current queue: ${JSON.stringify(queue)}`,
    );
  }

  @SubscribeMessage('finish-game')
  handleFinishGame(
    @MessageBody()
    payload: {
      room: string;
      scores: Array<{ socketId: string; name: string; score: number }>;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const { room, scores } = payload;
    if (!room || !scores || scores.length === 0) return;

    // 점수 순으로 정렬 (내림차순)
    const sortedScores = [...scores].sort((a, b) => b.score - a.score);
    const maxScore = sortedScores[0].score;
    const winners = sortedScores.filter((s) => s.score === maxScore);

    // 각 플레이어의 결과 계산
    const results = new Map<string, any>();
    sortedScores.forEach((player, index) => {
      const isWin = player.score === maxScore && index === 0;
      const isTie = winners.length > 1 && player.score === maxScore;

      results.set(player.socketId, {
        result: isTie ? 'tie' : isWin ? 'win' : 'lose',
        score: player.score,
        rank: index + 1,
        totalPlayers: sortedScores.length,
        ranking: sortedScores.map((p, i) => ({
          name: p.name,
          score: p.score,
          rank: i + 1,
        })),
      });
    });

    // 방의 모든 클라이언트에게 게임 결과 전송 (각 클라이언트가 자신의 결과만 처리)
    this.server.to(room).emit('game-result', {
      results: Object.fromEntries(results),
      ranking: sortedScores.map((p, i) => ({
        socketId: p.socketId,
        name: p.name,
        score: p.score,
        rank: i + 1,
      })),
    });

    // 방의 모든 클라이언트에게 게임 완료 알림
    this.server.to(room).emit('game-finished', {
      room,
      ranking: sortedScores.map((p, i) => ({
        name: p.name,
        score: p.score,
        rank: i + 1,
      })),
    });

    this.logger.log(
      `Game finished in room ${room}: ${JSON.stringify(sortedScores)}`,
    );
  }
}
