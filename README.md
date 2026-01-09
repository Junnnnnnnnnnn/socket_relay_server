# Real-time Motion-Controlled Mini-Game Hub

[![Stars](https://img.shields.io/github/stars/Junnnnnnnnnnn/socket_relay_server?style=flat-square)](https://github.com/Junnnnnnnnnnn/socket_relay_server/stargazers)
[![Forks](https://img.shields.io/github/forks/Junnnnnnnnnnn/socket_relay_server?style=flat-square)](https://github.com/Junnnnnnnnnnn/socket_relay_server/network/members)
[![Issues](https://img.shields.io/github/issues/Junnnnnnnnnnn/socket_relay_server?style=flat-square)](https://github.com/Junnnnnnnnnnn/socket_relay_server/issues)

모바일 기기의 모션 센서를 이용하여 미니게임을 즐길 수 있는 실시간 멀티플레이 서버입니다.

## 핵심 원리

이 프로젝트는 **Display(화면)**와 **Controller(컨트롤러)**를 분리한 구조로 동작합니다.

- **Display**: 게임 화면이 표시되는 큰 화면 (PC, TV 등)
- **Controller**: 플레이어의 스마트폰 (모션 센서 데이터 전송)

두 클라이언트는 **Socket.io**를 통해 실시간으로 연결되며, 서버가 중계 역할을 수행합니다.

```
[스마트폰 Controller] --모션 데이터--> [NestJS Server] --게임 상태--> [Display 화면]
                                          ↓
                                   룸(Room) 기반으로
                                   여러 게임 세션 관리
```

## 게임 목록

1. **Baseball** - 야구공을 스윙해서 치는 게임
2. **Climb** - 기기를 흔들어 벽을 오르는 게임
3. **Dart** - 손목을 튕겨 다트를 던지는 게임

각 게임은 독립된 Socket.io **네임스페이스**(`/baseball`, `/climb`, `/dart`)로 분리되어 있습니다.

## 기술 스택

- **NestJS** + **TypeScript**: 백엔드 서버 프레임워크
- **Socket.io**: WebSocket 기반 실시간 양방향 통신
- **모션 센서 API**: 스마트폰의 가속도계, 자이로스코프 활용

## 실행 방법

```bash
npm install
npm run build
npm run start:prod
```

**주의**: HTTPS 환경이 필수입니다. 모바일 브라우저에서 모션 센서에 접근하려면 보안 연결이 필요합니다.
