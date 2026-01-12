# Dart Queue System - Sequence Diagrams

이 문서는 Dart Queue 시스템의 주요 시나리오에 대한 시퀀스 다이어그램을 포함합니다.

## 1. 큐 참가 (Join Queue)

```mermaid
sequenceDiagram
    participant C1 as Client A
    participant C2 as Client B
    participant GW as DartSocketGateway
    participant SVC as SocketService
    participant C3 as All Clients

    C1->>GW: emit('join-queue')
    GW->>SVC: addToQueue('dart', socketId)
    SVC->>SVC: queue.push(socketId)
    SVC-->>GW: success
    GW->>SVC: getQueue('dart')
    SVC-->>GW: ['socket1', 'socket2', ...]
    GW->>C3: broadcast('status-queue', queue)
    C3->>C3: updateUI(queue)
    Note over GW,C3: 모든 클라이언트가 업데이트된 큐 수신
```

---

## 2. 큐 나가기 (Leave Queue)

```mermaid
sequenceDiagram
    participant C1 as Client A
    participant GW as DartSocketGateway
    participant SVC as SocketService
    participant C2 as All Clients

    C1->>GW: emit('leave-queue')
    GW->>SVC: removeFromQueue('dart', socketId)
    SVC->>SVC: queue.filter(id !== socketId)
    SVC-->>GW: success
    GW->>SVC: getQueue('dart')
    SVC-->>GW: ['socket2', 'socket3', ...]
    GW->>C2: broadcast('status-queue', queue)
    C2->>C2: updateUI(queue)
    Note over GW,C2: Client A를 제외한 큐 상태 브로드캐스트
```

---

## 3. 큐 상태 조회 (Status Queue)

```mermaid
sequenceDiagram
    participant C1 as Client A
    participant GW as DartSocketGateway
    participant SVC as SocketService

    C1->>GW: emit('status-queue')
    GW->>SVC: getQueue('dart')
    SVC-->>GW: ['socket1', 'socket2', 'socket3']
    GW->>C1: emit('status-queue', queue)
    C1->>C1: displayQueue(queue)
    Note over C1,GW: 요청한 클라이언트만 큐 상태 수신
```

---

## 4. 큐 초기화 (Reset Queue)

```mermaid
sequenceDiagram
    participant Admin as Admin Client
    participant GW as DartSocketGateway
    participant SVC as SocketService
    participant Project as Project Clients

    Admin->>GW: emit('reset-queue', {project})
    GW->>SVC: resetQueue('dart')
    SVC->>SVC: queue = []
    SVC-->>GW: success
    GW->>Project: to(project).emit('reset-queue', {project})
    Project->>Project: clearQueueUI()
    Note over GW,Project: 같은 프로젝트의 모든 클라이언트에게 알림
```

---

## 5. 전체 플레이어 흐름 (Complete Player Flow)

```mermaid
sequenceDiagram
    participant P1 as Player 1
    participant P2 as Player 2
    participant P3 as Player 3
    participant GW as Gateway
    participant SVC as Service

    Note over P1,SVC: 초기 상태: 빈 큐

    P1->>GW: join-queue
    GW->>SVC: addToQueue('dart', P1)
    GW->>P1: status-queue: [P1]
    GW->>P2: status-queue: [P1]
    GW->>P3: status-queue: [P1]

    Note over P1,SVC: Player 1이 큐에 참가

    P2->>GW: join-queue
    GW->>SVC: addToQueue('dart', P2)
    GW->>P1: status-queue: [P1, P2]
    GW->>P2: status-queue: [P1, P2]
    GW->>P3: status-queue: [P1, P2]

    Note over P1,SVC: Player 2가 큐에 참가

    P3->>GW: join-queue
    GW->>SVC: addToQueue('dart', P3)
    GW->>P1: status-queue: [P1, P2, P3]
    GW->>P2: status-queue: [P1, P2, P3]
    GW->>P3: status-queue: [P1, P2, P3]

    Note over P1,SVC: Player 3이 큐에 참가

    P1->>GW: leave-queue
    GW->>SVC: removeFromQueue('dart', P1)
    GW->>P1: status-queue: [P2, P3]
    GW->>P2: status-queue: [P2, P3]
    GW->>P3: status-queue: [P2, P3]

    Note over P1,SVC: Player 1이 게임 완료 후 큐에서 나감
```

---

## 6. 에러 케이스 - 중복 참가 시도

```mermaid
sequenceDiagram
    participant C as Client
    participant GW as Gateway
    participant SVC as Service
    participant All as All Clients

    C->>GW: join-queue
    GW->>SVC: addToQueue('dart', socketId)
    Note over SVC: queue = ['socket1', 'socket2']
    GW->>All: status-queue: [socket1, socket2]

    Note over C,SVC: 동일 클라이언트가 다시 참가 시도

    C->>GW: join-queue
    GW->>SVC: addToQueue('dart', socketId)
    Note over SVC: 중복 확인 후 추가 안함<br/>queue = ['socket1', 'socket2']
    GW->>All: status-queue: [socket1, socket2]

    Note over C,All: 큐 상태는 변경 없음
```

---

## 7. 연결 해제 시나리오 (현재 구현)

```mermaid
sequenceDiagram
    participant C as Client
    participant GW as Gateway
    participant SVC as Service
    participant All as All Clients

    Note over C,All: Client가 큐에 있는 상태
    Note over SVC: queue = ['socket1', 'socket2', 'socket3']

    C->>GW: disconnect
    GW->>GW: handleDisconnect()
    Note over GW: 큐에서 자동 제거되지 않음

    Note over SVC: queue = ['socket1', 'socket2', 'socket3']<br/>(여전히 socket2 포함)

    rect rgb(255, 200, 200)
        Note over C,All: 주의: 연결이 끊긴 클라이언트가<br/>큐에 남아있을 수 있음
    end
```

---

## 8. 게임 시작 플로우 (권장 패턴)

```mermaid
sequenceDiagram
    participant P1 as Player 1
    participant P2 as Player 2
    participant GW as Gateway
    participant Game as Game Logic
    participant SVC as Queue Service

    Note over P1,SVC: 큐에 플레이어들이 대기 중

    Game->>SVC: getQueue('dart')
    SVC-->>Game: [P1, P2]

    Game->>Game: selectPlayers(2)
    Note over Game: 상위 2명 선택

    Game->>GW: startGame([P1, P2])
    GW->>P1: emit('game-start')
    GW->>P2: emit('game-start')

    Note over P1,P2: 게임 진행...

    P1->>GW: finish-game
    GW->>Game: gameFinished([P1 result])

    Game->>GW: leave-queue (P1)
    GW->>SVC: removeFromQueue('dart', P1)
    GW->>All: status-queue: (updated queue array)

    Note over P1,SVC: 게임 완료 후 큐에서 제거
```

---

## 다이어그램 렌더링

위의 다이어그램들은 Mermaid 문법으로 작성되었습니다.
다음 도구들에서 렌더링할 수 있습니다:

- **GitHub**: `.md` 파일에서 자동 렌더링
- **VS Code**: Mermaid 확장 프로그램 설치
- **Mermaid Live Editor**: https://mermaid.live/
- **Notion, Confluence** 등 다양한 문서 도구

## 주요 패턴 요약

1. **브로드캐스트 패턴**: `join-queue`, `leave-queue`는 모든 클라이언트에게 상태 전파
2. **유니캐스트 패턴**: `status-queue` 조회는 요청자에게만 응답
3. **프로젝트 기반 브로드캐스트**: `reset-queue`는 특정 프로젝트에만 전송
4. **명시적 제거**: 연결 해제 시 자동 제거되지 않으므로 명시적 호출 필요
