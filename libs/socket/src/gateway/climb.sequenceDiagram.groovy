sequenceDiagram
  autonumber
  participant D as Display (Client)
  participant S as Socket Server (/climb)
  participant C1 as Controller 1 (Client)
  participant C2 as Controller 2 (Client)

  Note over D: Display creates room
  D->>S: connect(query: role=display, room=ROOM1)
  S-->>D: roomPlayerCount {room: ROOM1, playerCount: 0}
  
  Note over C1: Controller 1 joins
  C1->>S: connect(query: role=controller, room=ROOM1)
  S-->>D: roomPlayerCount {room: ROOM1, playerCount: 0}
  S-->>C1: roomPlayerCount {room: ROOM1, playerCount: 0}
  
  C1->>S: joinRoom {room: ROOM1, name: "Player1"}
  S-->>C1: joinedRoom {room: ROOM1, playerCount: 1}
  S-->>D: roomPlayerCount {room: ROOM1, playerCount: 1}
  S-->>D: stateUpdate {status: idle, players: [...]}
  S-->>C1: stateUpdate {status: idle, players: [...]}
  
  Note over C2: Controller 2 joins
  C2->>S: connect(query: role=controller, room=ROOM1)
  S-->>D: roomPlayerCount {room: ROOM1, playerCount: 1}
  S-->>C2: roomPlayerCount {room: ROOM1, playerCount: 1}
  S-->>C1: roomPlayerCount {room: ROOM1, playerCount: 1}
  
  C2->>S: joinRoom {room: ROOM1, name: "Player2"}
  S-->>C2: joinedRoom {room: ROOM1, playerCount: 2}
  S-->>D: roomPlayerCount {room: ROOM1, playerCount: 2}
  S-->>D: stateUpdate {status: idle, players: [P1, P2]}
  S-->>C1: stateUpdate {status: idle, players: [P1, P2]}
  S-->>C2: stateUpdate {status: idle, players: [P1, P2]}
  
  Note over D,C2: Game starts
  D->>S: startGame
  S-->>D: gameStarted
  S-->>C1: gameStarted
  S-->>C2: gameStarted
  S-->>D: stateUpdate {status: running, players: [...]}
  S-->>C1: stateUpdate {status: running, players: [...]}
  S-->>C2: stateUpdate {status: running, players: [...]}
  
  Note over C1,C2: Motion streaming (50ms interval)
  loop Every 50ms while game running
    C1->>S: shake {delta: 5.2}
    S->>S: Update player1.progress
    S-->>D: stateUpdate {status: running, players: [P1(progress: 25%), P2(...)]}
    S-->>C1: stateUpdate {status: running, players: [...]}
    S-->>C2: stateUpdate {status: running, players: [...]}
    
    C2->>S: shake {delta: 3.8}
    S->>S: Update player2.progress
    S-->>D: stateUpdate {status: running, players: [P1(...), P2(progress: 18%)]}
    S-->>C1: stateUpdate {status: running, players: [...]}
    S-->>C2: stateUpdate {status: running, players: [...]}
  end
  
  Note over C1: Player 1 reaches 100%
  C1->>S: shake {delta: 4.5}
  S->>S: Update player1.progress = 100%
  S->>S: Set status = 'ended'
  S-->>D: gameOver {winnerId: C1.id, snapshot: {...}}
  S-->>C1: gameOver {winnerId: C1.id, snapshot: {...}}
  S-->>C2: gameOver {winnerId: C1.id, snapshot: {...}}
  
  Note over D: Display disconnects (optional cleanup)
  D->>S: disconnect
  S-->>C1: gameOver {winnerId: null, reason: 'display_disconnected'}
  S-->>C2: gameOver {winnerId: null, reason: 'display_disconnected'}
  S->>S: Delete room

