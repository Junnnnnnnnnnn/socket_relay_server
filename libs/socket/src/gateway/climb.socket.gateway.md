# Climb Socket Gateway API 문서

## 개요

Climb Socket Gateway는 등반 게임을 위한 WebSocket 통신을 제공합니다. Socket.IO를 사용하며, `climb` 네임스페이스를 통해 연결됩니다. Display(디스플레이)와 Controller(컨트롤러) 두 가지 역할을 지원하며, 최대 2명의 플레이어가 동시에 게임에 참여할 수 있습니다.

## 연결 설정

### 기본 연결

```javascript
import io from 'socket.io-client';

// Display 연결
const displaySocket = io('https://static-dev.zipshowkorea.com/climb', {
  path: '/socket',
  query: {
    role: 'display', // 필수: 'display' 또는 'controller'
    room: 'ROOM1', // 필수: 방 코드
  },
  transports: ['websocket'],
  reconnection: true,
});

// Controller 연결
const controllerSocket = io('https://static-dev.zipshowkorea.com/climb', {
  path: '/socket',
  query: {
    role: 'controller', // 필수: 'display' 또는 'controller'
    room: 'ROOM1', // 필수: 방 코드
  },
  transports: ['websocket'],
  reconnection: true,
});
```

### 연결 이벤트

```javascript
socket.on('connect', () => {
  console.log('Connected to climb socket server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from climb socket server');
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
  // { code: 'NO_ROOM' | 'NO_SUCH_ROOM' | 'ROOM_FULL' | 'NOT_ENOUGH_PLAYERS' | 'NO_DISPLAY', message: string }
});
```

---

## 클라이언트 → 서버 이벤트 (Emit)

### 1. joinRoom

Controller가 방에 참가합니다. 연결 후 반드시 호출해야 게임에 참여할 수 있습니다.

**이벤트명:** `joinRoom`

**Payload:**

```typescript
{
  room: string;      // 필수: 방 코드
  name?: string;     // 선택: 플레이어 이름 (없으면 'P1', 'P2' 등 자동 생성)
}
```

**예제:**

```javascript
socket.emit('joinRoom', {
  room: 'ROOM1',
  name: 'Player1',
});
```

**응답 이벤트:**

- `joinedRoom` (자신에게만)
- `roomPlayerCount` (방의 모든 클라이언트에게)
- `stateUpdate` (방의 모든 클라이언트에게)

**에러:**

- `NO_SUCH_ROOM`: 방이 존재하지 않음
- `ROOM_FULL`: 방이 가득 참 (최대 2명)

---

### 2. startGame

게임을 시작합니다. Display 또는 Controller 모두 호출할 수 있습니다.

**이벤트명:** `startGame`

**Payload:**

```typescript
{
} // 빈 객체
```

**예제:**

```javascript
socket.emit('startGame');
```

**응답 이벤트:**

- `gameStarted` (방의 모든 클라이언트에게)
- `stateUpdate` (방의 모든 클라이언트에게)

**에러:**

- `NOT_ENOUGH_PLAYERS`: 플레이어가 2명 미만
- `NO_DISPLAY`: Display가 연결되지 않음

---

### 3. shake

Controller가 모션 센서 데이터를 전송합니다. 게임이 진행 중일 때만 유효합니다.

**이벤트명:** `shake`

**Payload:**

```typescript
{
  delta: number; // 필수: 가속도 변화량 (0~20 사이로 클램핑됨)
}
```

**예제:**

```javascript
// 50ms 간격으로 전송 (20Hz)
socket.emit('shake', {
  delta: 5.2, // 가속도 변화량
});
```

**응답 이벤트:**

- `stateUpdate` (진행률 업데이트, 방의 모든 클라이언트에게)
- `gameOver` (진행률이 100%에 도달한 경우)

**참고:**

- `delta` 값은 서버에서 0~20 사이로 클램핑됩니다 (안티치트)
- 진행률은 `delta * 0.05` 만큼 증가합니다
- 진행률이 100%에 도달하면 자동으로 게임 종료

---

## 서버 → 클라이언트 이벤트 (On)

### 1. roomPlayerCount

방의 플레이어 수가 변경되었을 때 받는 이벤트입니다. (플레이어 입장/퇴장 시)

**이벤트명:** `roomPlayerCount`

**Payload:**

```typescript
{
  room: string; // 방 코드
  playerCount: number; // 현재 플레이어 수 (Controller만 카운트, Display 제외)
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

### 2. joinedRoom

Controller가 방 참가가 완료되었을 때 받는 이벤트입니다.

**이벤트명:** `joinedRoom`

**Payload:**

```typescript
{
  room: string; // 방 코드
  playerCount: number; // 현재 방의 플레이어 수
}
```

**예제:**

```javascript
socket.on('joinedRoom', (data) => {
  console.log(`Joined room ${data.room} with ${data.playerCount} players`);
  // UI 업데이트: 게임 시작 버튼 활성화 등
});
```

---

### 3. stateUpdate

게임 상태가 업데이트되었을 때 받는 이벤트입니다. 플레이어 진행률, 게임 상태 등이 포함됩니다.

**이벤트명:** `stateUpdate`

**Payload:**

```typescript
{
  status: 'idle' | 'running' | 'ended'; // 게임 상태
  players: Array<{
    id: string; // 플레이어의 Socket ID
    name: string; // 플레이어 이름
    progress: number; // 진행률 (0~100)
  }>;
}
```

**예제:**

```javascript
socket.on('stateUpdate', (state) => {
  console.log(`Game status: ${state.status}`);
  state.players.forEach((player) => {
    console.log(`${player.name}: ${player.progress}%`);
  });
  // UI 업데이트: 진행률 표시, 플레이어 위치 업데이트 등
});
```

---

### 4. gameStarted

게임이 시작되었을 때 받는 이벤트입니다.

**이벤트명:** `gameStarted`

**Payload:**

없음 (이벤트만 전송)

**예제:**

```javascript
socket.on('gameStarted', () => {
  console.log('Game started!');
  // UI 업데이트: 게임 시작 애니메이션, 모션 센서 활성화 등
});
```

---

### 5. gameOver

게임이 종료되었을 때 받는 이벤트입니다.

**이벤트명:** `gameOver`

**Payload:**

```typescript
{
  winnerId: string | null; // 승자 Socket ID (null인 경우: Display 연결 해제 등)
  snapshot: {
    status: 'ended';
    players: Array<{
      id: string;
      name: string;
      progress: number;
    }>;
  };
  reason?: string; // 종료 사유 (예: 'display_disconnected')
}
```

**예제:**

```javascript
socket.on('gameOver', (data) => {
  if (data.winnerId === socket.id) {
    console.log('You won!');
    // UI 업데이트: 승리 모달 표시
  } else if (data.winnerId && data.winnerId !== socket.id) {
    console.log('You lost!');
    // UI 업데이트: 패배 모달 표시
  } else {
    console.log('Game stopped:', data.reason);
    // UI 업데이트: 게임 중단 알림
  }
});
```

---

## 전체 예제 코드

### Display 클라이언트

```javascript
import io from 'socket.io-client';

// 1. 연결 설정
const socket = io('https://static-dev.zipshowkorea.com/climb', {
  path: '/socket',
  query: {
    role: 'display',
    room: 'ROOM1',
  },
  transports: ['websocket'],
  reconnection: true,
});

// 2. 연결 이벤트
socket.on('connect', () => {
  console.log('Display connected');
});

socket.on('error', (error) => {
  console.error('Error:', error);
});

// 3. 플레이어 수 업데이트
socket.on('roomPlayerCount', (data) => {
  console.log(`Players: ${data.playerCount}`);
  // UI 업데이트
});

// 4. 게임 상태 업데이트
socket.on('stateUpdate', (state) => {
  console.log('State update:', state);
  // UI 업데이트: 플레이어 진행률 표시
  state.players.forEach((player) => {
    updatePlayerProgress(player.id, player.progress);
  });
});

// 5. 게임 시작
socket.on('gameStarted', () => {
  console.log('Game started');
  // UI 업데이트
});

// 6. 게임 종료
socket.on('gameOver', (data) => {
  console.log('Game over:', data);
  const winner = data.snapshot.players.find((p) => p.id === data.winnerId);
  if (winner) {
    console.log(`Winner: ${winner.name}`);
  }
  // UI 업데이트
});

// 7. 게임 시작 버튼 클릭
document.getElementById('startBtn').onclick = () => {
  socket.emit('startGame');
};
```

### Controller 클라이언트

```javascript
import io from 'socket.io-client';

// 1. 연결 설정
const socket = io('https://static-dev.zipshowkorea.com/climb', {
  path: '/socket',
  query: {
    role: 'controller',
    room: 'ROOM1',
  },
  transports: ['websocket'],
  reconnection: true,
});

// 2. 연결 이벤트
socket.on('connect', () => {
  console.log('Controller connected');
  // 방 참가
  socket.emit('joinRoom', {
    room: 'ROOM1',
    name: 'Player1',
  });
});

socket.on('error', (error) => {
  console.error('Error:', error);
});

// 3. 방 참가 완료
socket.on('joinedRoom', (data) => {
  console.log(`Joined room: ${data.room}, Players: ${data.playerCount}`);
  // UI 업데이트: 게임 시작 버튼 활성화
});

// 4. 플레이어 수 업데이트
socket.on('roomPlayerCount', (data) => {
  console.log(`Players: ${data.playerCount}`);
  // UI 업데이트
});

// 5. 게임 상태 업데이트
socket.on('stateUpdate', (state) => {
  console.log('State update:', state);
  const myPlayer = state.players.find((p) => p.id === socket.id);
  if (myPlayer) {
    updateProgressBar(myPlayer.progress);
  }
});

// 6. 게임 시작
socket.on('gameStarted', () => {
  console.log('Game started!');
  startMotionSensor(); // 모션 센서 활성화
});

// 7. 게임 종료
socket.on('gameOver', (data) => {
  stopMotionSensor(); // 모션 센서 비활성화
  if (data.winnerId === socket.id) {
    showModal('Win! 🎉', 'win');
  } else if (data.winnerId && data.winnerId !== socket.id) {
    showModal('Lose 😢', 'lose');
  }
});

// 8. 모션 센서 데이터 전송 (50ms 간격)
let motionInterval = null;

function startMotionSensor() {
  let prevMagnitude = 0;
  let bucket = 0;

  // DeviceMotion 이벤트 리스너
  window.addEventListener('devicemotion', (e) => {
    const accel = e.acceleration ||
      e.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
    const magnitude = Math.hypot(accel.x || 0, accel.y || 0, accel.z || 0);
    const delta = Math.max(0, magnitude - prevMagnitude);
    prevMagnitude = magnitude;

    if (delta > 0.8) {
      // 노이즈 컷
      bucket += delta;
    }
  });

  // 50ms마다 서버로 전송
  motionInterval = setInterval(() => {
    if (bucket > 0) {
      const delta = Math.min(bucket, 20); // 최대 20으로 제한
      socket.emit('shake', { delta });
      bucket = 0;
    }
  }, 50);
}

function stopMotionSensor() {
  if (motionInterval) {
    clearInterval(motionInterval);
    motionInterval = null;
  }
}

// 9. 게임 시작 버튼 클릭
document.getElementById('startBtn').onclick = () => {
  socket.emit('startGame');
};
```

---

## 주의사항

1. **방 생성**: Display가 먼저 연결되어 방을 생성하는 것을 권장합니다. Controller가 먼저 연결되면 방이 자동 생성되지만, Display가 없으면 게임을 시작할 수 없습니다.

2. **플레이어 수 제한**: 최대 2명의 Controller만 게임에 참여할 수 있습니다. `maxPlayers`는 2로 고정되어 있습니다.

3. **게임 상태**:
   - `idle`: 대기 중 (플레이어 참가 대기)
   - `running`: 게임 진행 중
   - `ended`: 게임 종료

4. **진행률 계산**:
   - `delta` 값은 0~20 사이로 클램핑됩니다
   - 진행률 증가량 = `delta * 0.05`
   - 진행률은 0~100 사이로 제한됩니다

5. **게임 종료 조건**:
   - 플레이어의 진행률이 100%에 도달
   - Display가 연결 해제

6. **모션 센서 권한**: iOS Safari에서는 `DeviceMotionEvent.requestPermission()`을 호출하여 권한을 요청해야 합니다.

7. **이벤트 순서**:
   - 연결 → `roomPlayerCount` 수신
   - `joinRoom` 전송 → `joinedRoom` 및 `roomPlayerCount`, `stateUpdate` 수신
   - `startGame` 전송 → `gameStarted` 및 `stateUpdate` 수신
   - 게임 진행 중 → `shake` 전송 → `stateUpdate` 수신 (반복)
   - 진행률 100% 도달 → `gameOver` 수신

---

## TypeScript 타입 정의

프론트엔드에서 TypeScript를 사용하는 경우, 다음 타입 정의를 사용할 수 있습니다:

```typescript
// 역할 타입
type Role = 'display' | 'controller';

// 게임 상태
type GameStatus = 'idle' | 'running' | 'ended';

// 클라이언트가 서버로 보내는 이벤트 타입
interface JoinRoomPayload {
  room: string;
  name?: string;
}

interface StartGamePayload {
  // 빈 객체
}

interface ShakePayload {
  delta: number; // 0~20 사이로 클램핑됨
}

// 서버가 클라이언트로 보내는 이벤트 타입
interface RoomPlayerCountData {
  room: string;
  playerCount: number;
}

interface JoinedRoomData {
  room: string;
  playerCount: number;
}

interface Player {
  id: string;
  name: string;
  progress: number; // 0~100
}

interface StateUpdateData {
  status: GameStatus;
  players: Player[];
}

interface GameOverData {
  winnerId: string | null;
  snapshot: {
    status: 'ended';
    players: Player[];
  };
  reason?: string;
}

interface SocketError {
  code:
    | 'NO_ROOM'
    | 'NO_SUCH_ROOM'
    | 'ROOM_FULL'
    | 'NOT_ENOUGH_PLAYERS'
    | 'NO_DISPLAY';
  message: string;
}
```

---

## 에러 코드

### `NO_ROOM`

- **설명**: 연결 시 room 파라미터가 없음
- **해결 방법**: query에 `room` 파라미터 추가

### `NO_SUCH_ROOM`

- **설명**: 존재하지 않는 방에 참가 시도
- **해결 방법**: 올바른 방 코드 사용 또는 Display가 먼저 연결되도록 함

### `ROOM_FULL`

- **설명**: 방이 가득 참
- **해결 방법**: 다른 방 사용 또는 기존 플레이어가 나갈 때까지 대기

### `NOT_ENOUGH_PLAYERS`

- **설명**: 게임 시작 시 플레이어가 2명 미만
- **해결 방법**: 최소 2명의 Controller가 참가한 후 시작

### `NO_DISPLAY`

- **설명**: Display가 연결되지 않은 상태에서 게임 시작 시도
- **해결 방법**: Display가 먼저 연결되도록 함
