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
  @WebSocketServer() private readonly server: Server;
  private readonly roomClients = new Map<string, Set<string>>();
  private readonly clientInfoMap = new Map<string, ClientInfo>(); // socketId -> ClientInfo

  handleConnection(client: Socket) {
    const room = client.handshake.query.room as string;
    const name = (client.handshake.query.name as string) || 'Unknown';

    console.log(`Client connected ${client.id} room: ${room}, name: ${name}`);

    if (room) {
      client.join(room);

      // 클라이언트 정보 저장
      this.clientInfoMap.set(client.id, {
        id: client.id,
        name,
        room,
      });

      // 방의 클라이언트 목록에 추가
      if (!this.roomClients.has(room)) {
        this.roomClients.set(room, new Set());
      }
      this.roomClients.get(room)!.add(client.id);

      // 방의 현재 접속 인원 수 확인
      const playerCount = this.getRoomPlayerCount(room);

      // 방의 모든 클라이언트에게 업데이트된 인원 수 전송
      this.server.to(room).emit('roomPlayerCount', { room, playerCount });

      // 클라이언트에게 자신의 정보 전송
      client.emit('clientInfo', {
        socketId: client.id,
        name,
        room,
      });
    }
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.clientInfoMap.get(client.id);
    const room = clientInfo?.room || (client.handshake.query.room as string);

    // 클라이언트 정보 제거
    this.clientInfoMap.delete(client.id);

    if (room) {
      client.leave(room);

      // 방의 클라이언트 목록에서 제거
      const roomSet = this.roomClients.get(room);
      if (roomSet) {
        roomSet.delete(client.id);
        if (roomSet.size === 0) {
          this.roomClients.delete(room);
        }
      }

      // 방의 현재 접속 인원 수 확인
      const playerCount = this.getRoomPlayerCount(room);

      // 방의 모든 클라이언트에게 업데이트된 인원 수 전송
      this.server.to(room).emit('roomPlayerCount', { room, playerCount });

      console.log(
        `Client ${client.id} (${clientInfo?.name || 'Unknown'}) disconnected from room ${room}, remaining players: ${playerCount}`,
      );
    } else {
      console.log(`Client ${client.id} disconnected (no room info)`);
    }
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() payload: { room: string; name?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = payload?.room;
    if (!room || typeof room !== 'string') return;

    const name =
      payload?.name || this.clientInfoMap.get(client.id)?.name || 'Unknown';

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

    client.emit('joinedRoom', { room, playerCount });

    // 방의 모든 클라이언트에게 업데이트된 인원 수 전송
    this.server.to(room).emit('roomPlayerCount', { room, playerCount });

    console.log(
      `ClientId: ${client.id} (${name}) joined room: ${room}, current players: ${playerCount}`,
    );
  }

  private getRoomPlayerCount(room: string): number {
    const roomSet = this.roomClients.get(room);
    return roomSet ? roomSet.size : 0;
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
    console.log('DART-THROWN ::: ', payload);
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

    console.log(`Game finished in room ${room}:`, sortedScores);
  }
}
