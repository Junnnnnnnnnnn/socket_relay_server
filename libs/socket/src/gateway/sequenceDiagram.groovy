sequenceDiagram
  autonumber
  participant A as Player A (Client)
  participant S as Socket Server (/dart)
  participant B as Player B (Client)

  A->>S: connect(query: room, name)
  S-->>A: clientInfo
  S-->>A: roomPlayerCount (1)

  B->>S: connect(query: room, name)
  S-->>B: clientInfo
  S-->>A: roomPlayerCount (2)
  S-->>B: roomPlayerCount (2)

  Note over A,B: Frontend: roomPlayerCount==2 → IN_GAME 진입

  A->>S: aim-update {room,name,aim}
  S-->>B: aim-update {room,name,aim}

  A->>S: throw-dart {room,name,aim,score}
  S-->>B: dart-thrown {room,name,aim,score}
  S-->>A: dart-thrown {room,name,aim,score}

  A->>S: aim-off {room,name}
  S-->>B: aim-off {room,name}

  Note over A,B: 게임 종료 시점(라운드/턴/타이머)은 프론트가 결정

  A->>S: finish-game {room,scores[2]}
  S-->>A: game-result {results, ranking}
  S-->>B: game-result {results, ranking}
  S-->>A: game-finished {room, ranking}
  S-->>B: game-finished {room, ranking}

  B-->>S: disconnect
  S-->>A: roomPlayerCount (1)
