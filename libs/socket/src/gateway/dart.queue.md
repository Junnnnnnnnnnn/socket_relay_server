# Dart Queue System Documentation

## 개요

Dart Socket Gateway의 큐 시스템은 다트 게임 참가자들의 대기열을 관리하는 기능을 제공합니다. 클라이언트들은 큐에 참가하거나 나갈 수 있으며, 실시간으로 큐의 상태를 확인할 수 있습니다.

## 주요 기능

### 1. 큐 참가 (Join Queue)

- **이벤트**: `join-queue`
- **설명**: 클라이언트가 대기열에 참가합니다.
- **동작**:
  - 클라이언트의 소켓 ID가 큐에 추가됩니다.
  - 이미 큐에 있는 경우 중복 추가되지 않습니다.
  - 모든 연결된 클라이언트에게 업데이트된 큐 상태가 브로드캐스트됩니다.

### 2. 큐 나가기 (Leave Queue)

- **이벤트**: `leave-queue`
- **설명**: 클라이언트가 대기열에서 나갑니다.
- **동작**:
  - 클라이언트의 소켓 ID가 큐에서 제거됩니다.
  - 큐에 없는 경우에도 에러 없이 처리됩니다.
  - 모든 연결된 클라이언트에게 업데이트된 큐 상태가 브로드캐스트됩니다.

### 3. 큐 상태 조회 (Status Queue)

- **이벤트**: `status-queue`
- **설명**: 현재 큐의 상태를 조회합니다.
- **동작**:
  - 요청한 클라이언트에게만 큐 상태를 전송합니다.
  - 현재 대기 중인 모든 참가자의 소켓 ID 배열을 반환합니다.

### 4. 큐 초기화 (Reset Queue)

- **이벤트**: `reset-queue`
- **설명**: 큐를 완전히 초기화합니다.
- **동작**:
  - 대기열의 모든 참가자가 제거됩니다.
  - 같은 프로젝트의 모든 클라이언트에게 초기화 알림이 전송됩니다.

## 이벤트 명세

### 클라이언트 → 서버

#### 1. join-queue

```typescript
socket.emit('join-queue');
```

**파라미터**: 없음

**응답**:

- 모든 클라이언트에게 `status-queue` 이벤트 브로드캐스트

---

#### 2. leave-queue

```typescript
socket.emit('leave-queue');
```

**파라미터**: 없음

**응답**:

- 모든 클라이언트에게 `status-queue` 이벤트 브로드캐스트

---

#### 3. status-queue (조회)

```typescript
socket.emit('status-queue');
```

**파라미터**: 없음

**응답**:

- 요청한 클라이언트에게만 `status-queue` 이벤트 전송

---

#### 4. reset-queue

```typescript
socket.emit('reset-queue', { project: 'project-name' });
```

**파라미터**:

```typescript
{
  project: string; // 프로젝트 이름
}
```

**응답**:

- 해당 프로젝트의 모든 클라이언트에게 `reset-queue` 이벤트 전송

---

### 서버 → 클라이언트

#### 1. status-queue

```typescript
socket.on('status-queue', (queue) => {
  console.log('Queue:', queue);
});
```

**데이터 구조**:

```typescript
string[]   // 큐에 있는 소켓 ID 배열
```

---

#### 2. reset-queue

```typescript
socket.on('reset-queue', (data) => {
  console.log('Queue has been reset for project:', data.project);
});
```

**데이터 구조**:

```typescript
{
  project: string; // 초기화된 프로젝트 이름
}
```

## 사용 예시

### 클라이언트 측 구현 예시

```typescript
// Socket.IO 클라이언트 초기화
const socket = io('http://localhost:3000/dart');

// 큐 상태 업데이트 리스너
socket.on('status-queue', (queue) => {
  console.log('현재 대기열:', queue);
  console.log('대기 인원:', queue.length);
  updateQueueUI(queue);
});

// 큐 참가
function joinQueue() {
  socket.emit('join-queue');
}

// 큐 나가기
function leaveQueue() {
  socket.emit('leave-queue');
}

// 큐 상태 조회
function checkQueueStatus() {
  socket.emit('status-queue');
}

// 큐 초기화 (관리자 기능)
function resetQueue(projectName) {
  socket.emit('reset-queue', { project: projectName });
}

// UI 업데이트 함수
function updateQueueUI(queue) {
  const queueList = document.getElementById('queue-list');
  queueList.innerHTML = queue
    .map(
      (socketId, index) =>
        `<li>${index + 1}. Player (${socketId.substring(0, 8)}...)</li>`,
    )
    .join('');
}
```

## 데이터 흐름

### 큐 참가 시나리오

1. **클라이언트 A**가 `join-queue` 이벤트 발생
2. **서버**는 SocketService를 통해 큐에 클라이언트 A의 소켓 ID 추가
3. **서버**는 업데이트된 큐를 조회
4. **서버**는 모든 연결된 클라이언트에게 `status-queue` 이벤트 브로드캐스트
5. **모든 클라이언트**는 업데이트된 큐 정보를 받아 UI 갱신

### 큐 나가기 시나리오

1. **클라이언트 B**가 `leave-queue` 이벤트 발생
2. **서버**는 SocketService를 통해 큐에서 클라이언트 B의 소켓 ID 제거
3. **서버**는 업데이트된 큐를 조회
4. **서버**는 모든 연결된 클라이언트에게 `status-queue` 이벤트 브로드캐스트
5. **모든 클라이언트**는 업데이트된 큐 정보를 받아 UI 갱신

## 주의사항

1. **중복 방지**: 동일한 소켓 ID는 큐에 중복으로 추가되지 않습니다.

2. **브로드캐스트 범위**:
   - `join-queue`, `leave-queue`는 **모든 연결된 클라이언트**에게 브로드캐스트
   - `status-queue` (조회)는 **요청한 클라이언트**에게만 전송
   - `reset-queue`는 **해당 프로젝트의 클라이언트**에게만 전송

3. **큐 순서**: 큐는 참가한 순서대로 유지됩니다 (FIFO).

4. **연결 해제**: 클라이언트가 연결을 해제해도 큐에서 자동으로 제거되지 않습니다. 명시적으로 `leave-queue`를 호출해야 합니다.

5. **네임스페이스**: 큐 시스템은 `dart` 네임스페이스에서 동작합니다.

## 아키텍처

### 관련 컴포넌트

- **DartSocketGateway**: WebSocket 게이트웨이, 큐 관련 이벤트 처리
- **SocketService**: 실제 큐 데이터 관리 (추가, 제거, 조회, 초기화)
- **Client**: Socket.IO 클라이언트

### 데이터 저장소

큐 데이터는 `SocketService` 내부의 메모리에 저장됩니다. 서버가 재시작되면 큐 정보는 초기화됩니다.

## 향후 개선 사항

1. **Redis 연동**: 서버 재시작 시에도 큐 상태 유지
2. **큐 제한**: 최대 대기 인원 설정
3. **자동 제거**: 연결 해제 시 큐에서 자동 제거
4. **우선순위 큐**: VIP 사용자 우선 처리
5. **큐 타임아웃**: 일정 시간 비활성 시 자동 제거
6. **큐 위치 알림**: 사용자에게 자신의 큐 순서 알림
