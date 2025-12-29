# Dart Socket Gateway API 문서

## 개요

Dart Socket Gateway는 다트 게임을 위한 WebSocket 통신을 제공합니다. Socket.IO를 사용하며, `dart` 네임스페이스를 통해 연결됩니다.

## 연결 설정

### 기본 연결

```javascript
import io from 'socket.io-client';

// 서버 URL과 네임스페이스 설정
const socket = io('http://your-server-url/dart', {
  query: {
    room: 'room-123', // 방 ID (선택사항, 연결 시점에 설정 가능)
    name: 'Player1', // 플레이어 이름 (선택사항, 연결 시점에 설정 가능)
  },
});
```

### 연결 이벤트

```javascript
socket.on('connect', () => {
  console.log('Connected to dart socket server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from dart socket server');
});
```

---

## 클라이언트 → 서버 이벤트 (Emit)

### 1. joinRoom

방에 참가합니다. 연결 시점에 방 정보가 없었거나, 다른 방으로 이동할 때 사용합니다.

**이벤트명:** `joinRoom`

**Payload:**

```typescript
{
  room: string;      // 필수: 방 ID
  name?: string;     // 선택: 플레이어 이름 (없으면 기존 이름 또는 'Unknown' 사용)
}
```

**예제:**

```javascript
socket.emit('joinRoom', {
  room: 'room-123',
  name: 'Player1',
});
```

**응답 이벤트:** `joinedRoom` (자신에게만), `roomPlayerCount` (방의 모든 클라이언트에게)

---

### 2. throw-dart

다트를 던졌을 때 발생하는 이벤트입니다.

**이벤트명:** `throw-dart`

**Payload:**

```typescript
{
  room: string; // 필수: 방 ID
  name: string; // 필수: 플레이어 이름
  aim: {
    x: number;
    y: number;
  } // 필수: 조준 위치 좌표
  score: number; // 필수: 획득한 점수
}
```

**예제:**

```javascript
socket.emit('throw-dart', {
  room: 'room-123',
  name: 'Player1',
  aim: { x: 100, y: 200 },
  score: 50,
});
```

**응답 이벤트:** `dart-thrown` (방의 모든 클라이언트에게)

---

### 3. aim-update

조준 위치를 업데이트할 때 발생하는 이벤트입니다. 실시간으로 조준 위치를 다른 플레이어에게 전달합니다.

**이벤트명:** `aim-update`

**Payload:**

```typescript
{
  room: string; // 필수: 방 ID
  name: string; // 필수: 플레이어 이름
  aim: {
    x: number;
    y: number;
  } // 필수: 조준 위치 좌표
}
```

**예제:**

```javascript
socket.emit('aim-update', {
  room: 'room-123',
  name: 'Player1',
  aim: { x: 150, y: 250 },
});
```

**응답 이벤트:** `aim-update` (방의 모든 클라이언트에게)

---

### 4. aim-off

조준을 종료했을 때 발생하는 이벤트입니다.

**이벤트명:** `aim-off`

**Payload:**

```typescript
{
  room: string; // 필수: 방 ID
  name: string; // 필수: 플레이어 이름
}
```

**예제:**

```javascript
socket.emit('aim-off', {
  room: 'room-123',
  name: 'Player1',
});
```

**응답 이벤트:** `aim-off` (방의 모든 클라이언트에게)

---

### 5. finish-game

게임을 종료할 때 발생하는 이벤트입니다. 모든 플레이어의 최종 점수를 전송합니다.

**이벤트명:** `finish-game`

**Payload:**

```typescript
{
  room: string; // 필수: 방 ID
  scores: Array<{
    socketId: string; // 플레이어의 Socket ID
    name: string; // 플레이어 이름
    score: number; // 최종 점수
  }>;
}
```

**예제:**

```javascript
socket.emit('finish-game', {
  room: 'room-123',
  scores: [
    { socketId: 'socket-id-1', name: 'Player1', score: 150 },
    { socketId: 'socket-id-2', name: 'Player2', score: 120 },
    { socketId: 'socket-id-3', name: 'Player3', score: 150 },
  ],
});
```

**응답 이벤트:** `game-result`, `game-finished` (방의 모든 클라이언트에게)

---

## 서버 → 클라이언트 이벤트 (On)

### 1. clientInfo

연결 시 자신의 클라이언트 정보를 받습니다.

**이벤트명:** `clientInfo`

**Payload:**

```typescript
{
  socketId: string; // 자신의 Socket ID
  name: string; // 자신의 이름
  room: string; // 현재 방 ID
}
```

**예제:**

```javascript
socket.on('clientInfo', (data) => {
  console.log('My client info:', data);
  // { socketId: 'abc123', name: 'Player1', room: 'room-123' }
});
```

---

### 2. joinedRoom

방 참가가 완료되었을 때 받는 이벤트입니다.

**이벤트명:** `joinedRoom`

**Payload:**

```typescript
{
  room: string; // 방 ID
  playerCount: number; // 현재 방의 플레이어 수
}
```

**예제:**

```javascript
socket.on('joinedRoom', (data) => {
  console.log(`Joined room ${data.room} with ${data.playerCount} players`);
});
```

---

### 3. roomPlayerCount

방의 플레이어 수가 변경되었을 때 받는 이벤트입니다. (플레이어 입장/퇴장 시)

**이벤트명:** `roomPlayerCount`

**Payload:**

```typescript
{
  room: string; // 방 ID
  playerCount: number; // 현재 방의 플레이어 수
}
```

**예제:**

```javascript
socket.on('roomPlayerCount', (data) => {
  console.log(`Room ${data.room} now has ${data.playerCount} players`);
  // UI 업데이트: 플레이어 수 표시
});
```

---

### 4. dart-thrown

다른 플레이어가 다트를 던졌을 때 받는 이벤트입니다.

**이벤트명:** `dart-thrown`

**Payload:**

```typescript
{
  room: string; // 방 ID
  name: string; // 다트를 던진 플레이어 이름
  aim: {
    x: number;
    y: number;
  } // 조준 위치
  score: number; // 획득한 점수
}
```

**예제:**

```javascript
socket.on('dart-thrown', (data) => {
  console.log(
    `${data.name} threw a dart at (${data.aim.x}, ${data.aim.y}) and scored ${data.score}`,
  );
  // UI 업데이트: 다트 표시, 점수 표시 등
});
```

---

### 5. aim-update

다른 플레이어의 조준 위치가 업데이트되었을 때 받는 이벤트입니다.

**이벤트명:** `aim-update`

**Payload:**

```typescript
{
  room: string; // 방 ID
  name: string; // 조준 중인 플레이어 이름
  aim: {
    x: number;
    y: number;
  } // 조준 위치
}
```

**예제:**

```javascript
socket.on('aim-update', (data) => {
  console.log(`${data.name} is aiming at (${data.aim.x}, ${data.aim.y})`);
  // UI 업데이트: 다른 플레이어의 조준 표시 업데이트
});
```

---

### 6. aim-off

다른 플레이어가 조준을 종료했을 때 받는 이벤트입니다.

**이벤트명:** `aim-off`

**Payload:**

```typescript
{
  room: string; // 방 ID
  name: string; // 조준을 종료한 플레이어 이름
}
```

**예제:**

```javascript
socket.on('aim-off', (data) => {
  console.log(`${data.name} stopped aiming`);
  // UI 업데이트: 다른 플레이어의 조준 표시 제거
});
```

---

### 7. game-result

게임 종료 시 각 플레이어의 결과를 받는 이벤트입니다. 자신의 결과를 확인할 수 있습니다.

**이벤트명:** `game-result`

**Payload:**

```typescript
{
  results: {
    [socketId: string]: {
      result: 'win' | 'lose' | 'tie';  // 게임 결과
      score: number;                    // 최종 점수
      rank: number;                     // 순위 (1부터 시작)
      totalPlayers: number;             // 전체 플레이어 수
      ranking: Array<{                  // 전체 순위표
        name: string;
        score: number;
        rank: number;
      }>;
    };
  };
  ranking: Array<{                      // 전체 순위표
    socketId: string;
    name: string;
    score: number;
    rank: number;
  }>;
}
```

**예제:**

```javascript
socket.on('game-result', (data) => {
  const mySocketId = socket.id;
  const myResult = data.results[mySocketId];

  if (myResult) {
    console.log(`My result: ${myResult.result}, Rank: ${myResult.rank}`);
    console.log('Full ranking:', data.ranking);
  }

  // UI 업데이트: 결과 화면 표시
});
```

---

### 8. game-finished

게임이 완료되었을 때 받는 이벤트입니다. 전체 순위 정보를 포함합니다.

**이벤트명:** `game-finished`

**Payload:**

```typescript
{
  room: string; // 방 ID
  ranking: Array<{
    // 전체 순위표
    name: string;
    score: number;
    rank: number;
  }>;
}
```

**예제:**

```javascript
socket.on('game-finished', (data) => {
  console.log('Game finished!');
  console.log('Ranking:', data.ranking);
  // UI 업데이트: 게임 종료 화면 표시
});
```

---

## 전체 예제 코드

```javascript
import io from 'socket.io-client';

// 1. 연결 설정
const socket = io('http://localhost:3000/dart', {
  query: {
    room: 'room-123',
    name: 'Player1',
  },
});

// 2. 연결 이벤트
socket.on('connect', () => {
  console.log('Connected');
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});

// 3. 클라이언트 정보 수신
socket.on('clientInfo', (data) => {
  console.log('My info:', data);
});

// 4. 방 참가 완료
socket.on('joinedRoom', (data) => {
  console.log(`Joined room: ${data.room}, Players: ${data.playerCount}`);
});

// 5. 플레이어 수 업데이트
socket.on('roomPlayerCount', (data) => {
  console.log(`Player count: ${data.playerCount}`);
});

// 6. 다트 던지기
socket.on('dart-thrown', (data) => {
  console.log(`${data.name} scored ${data.score}`);
});

// 7. 조준 업데이트
socket.on('aim-update', (data) => {
  console.log(`${data.name} aiming at (${data.aim.x}, ${data.aim.y})`);
});

// 8. 조준 종료
socket.on('aim-off', (data) => {
  console.log(`${data.name} stopped aiming`);
});

// 9. 게임 결과
socket.on('game-result', (data) => {
  const myResult = data.results[socket.id];
  if (myResult) {
    console.log(`Result: ${myResult.result}, Rank: ${myResult.rank}`);
  }
});

// 10. 게임 완료
socket.on('game-finished', (data) => {
  console.log('Game finished!', data.ranking);
});

// ===== 클라이언트가 서버로 이벤트 전송 =====

// 방 참가 (또는 재참가)
socket.emit('joinRoom', {
  room: 'room-123',
  name: 'Player1',
});

// 다트 던지기
socket.emit('throw-dart', {
  room: 'room-123',
  name: 'Player1',
  aim: { x: 100, y: 200 },
  score: 50,
});

// 조준 업데이트
socket.emit('aim-update', {
  room: 'room-123',
  name: 'Player1',
  aim: { x: 150, y: 250 },
});

// 조준 종료
socket.emit('aim-off', {
  room: 'room-123',
  name: 'Player1',
});

// 게임 종료
socket.emit('finish-game', {
  room: 'room-123',
  scores: [
    { socketId: socket.id, name: 'Player1', score: 150 },
    { socketId: 'other-socket-id', name: 'Player2', score: 120 },
  ],
});
```

---

## 주의사항

1. **방 참가**: 연결 시점에 `room`과 `name`을 쿼리 파라미터로 전달하거나, `joinRoom` 이벤트로 나중에 참가할 수 있습니다.

2. **Socket ID**: 자신의 Socket ID는 `socket.id`로 확인할 수 있으며, `clientInfo` 이벤트에서도 받을 수 있습니다.

3. **게임 종료**: `finish-game` 이벤트를 보낼 때는 방의 모든 플레이어 정보를 포함해야 합니다. 각 플레이어의 `socketId`가 정확해야 결과가 올바르게 계산됩니다.

4. **점수 정렬**: 서버에서 자동으로 점수 순으로 정렬하여 순위를 계산합니다. 동점인 경우 `tie` 결과가 반환됩니다.

5. **이벤트 순서**:
   - 연결 → `clientInfo` 수신
   - `joinRoom` 전송 → `joinedRoom` 및 `roomPlayerCount` 수신
   - 플레이어 입장/퇴장 → `roomPlayerCount` 수신
   - `finish-game` 전송 → `game-result` 및 `game-finished` 수신

---

## TypeScript 타입 정의

프론트엔드에서 TypeScript를 사용하는 경우, 다음 타입 정의를 사용할 수 있습니다:

```typescript
// 클라이언트가 서버로 보내는 이벤트 타입
interface JoinRoomPayload {
  room: string;
  name?: string;
}

interface ThrowDartPayload {
  room: string;
  name: string;
  aim: { x: number; y: number };
  score: number;
}

interface AimUpdatePayload {
  room: string;
  name: string;
  aim: { x: number; y: number };
}

interface AimOffPayload {
  room: string;
  name: string;
}

interface FinishGamePayload {
  room: string;
  scores: Array<{
    socketId: string;
    name: string;
    score: number;
  }>;
}

// 서버가 클라이언트로 보내는 이벤트 타입
interface ClientInfo {
  socketId: string;
  name: string;
  room: string;
}

interface JoinedRoomData {
  room: string;
  playerCount: number;
}

interface RoomPlayerCountData {
  room: string;
  playerCount: number;
}

interface DartThrownData {
  room: string;
  name: string;
  aim: { x: number; y: number };
  score: number;
}

interface AimUpdateData {
  room: string;
  name: string;
  aim: { x: number; y: number };
}

interface AimOffData {
  room: string;
  name: string;
}

interface PlayerResult {
  result: 'win' | 'lose' | 'tie';
  score: number;
  rank: number;
  totalPlayers: number;
  ranking: Array<{
    name: string;
    score: number;
    rank: number;
  }>;
}

interface GameResultData {
  results: { [socketId: string]: PlayerResult };
  ranking: Array<{
    socketId: string;
    name: string;
    score: number;
    rank: number;
  }>;
}

interface GameFinishedData {
  room: string;
  ranking: Array<{
    name: string;
    score: number;
    rank: number;
  }>;
}
```

