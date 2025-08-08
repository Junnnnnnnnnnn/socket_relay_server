# Socket Relay Server

[![Stars](https://img.shields.io/github/stars/Junnnnnnnnnnn/socket_relay_server?style=flat-square)](https://github.com/Junnnnnnnnnnn/socket_relay_server/stargazers)
[![Forks](https://img.shields.io/github/forks/Junnnnnnnnnnn/socket_relay_server?style=flat-square)](https://github.com/Junnnnnnnnnnn/socket_relay_server/network/members)
[![Issues](https://img.shields.io/github/issues/Junnnnnnnnnnn/socket_relay_server?style=flat-square)](https://github.com/Junnnnnnnnnnn/socket_relay_server/issues)

A robust and scalable NestJS project designed for real-time, room-based message relaying using WebSockets. This server can act as both a WebSocket server for clients and a client to another WebSocket service, making it a flexible solution for various real-time communication architectures.

## ✨ Features

- **Real-time Communication**: Built with `@nestjs/websockets` and `socket.io` for low-latency, bidirectional communication.
- **Room-based Broadcasting**: Efficiently isolates communication to specific rooms, allowing for targeted message delivery.
- **Dual Functionality**: Includes both a `SocketGateway` (server) to manage client connections and a `SocketConnectorService` (client) to connect to other WebSocket endpoints.
- **Scalable Architecture**: Leverages the modular structure of NestJS, making it easy to extend and maintain.
- **Ready-to-Use**: Comes with a complete setup for development, testing, and production.
- **Clean Code**: Follows best practices with pre-configured linting (`ESLint`) and formatting (`Prettier`).

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)

### Installation

1.  **Clone the repository:**

    ```bash
    git clone <your-repository-url>
    cd socket_relay_server
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up your environment:**

    If you intend to use the `SocketConnectorService` to connect to another WebSocket server, create a `.env` file in the root of the project and add the target server's URL:

    ```
    # The WebSocket server URL for the SocketConnectorService to connect to
    SOCKET_HOST=ws://another-socket-server.com
    ```

### Running the Application

-   **Development Mode (with hot-reloading):**

    ```bash
    npm run start:dev
    ```

-   **Production Mode:**

    ```bash
    npm run build
    npm run start:prod
    ```

## 🧪 Testing

This project is equipped with Jest for unit and end-to-end testing.

1.  **Run unit tests:**

    ```bash
    npm run test
    ```

2.  **Run end-to-end tests:**

    ```bash
    npm run test:e2e
    ```

3.  **Check test coverage:**
    ```bash
    npm run test:cov
    ```

## 🤝 Contributing

Contributions are welcome! If you have any ideas, suggestions, or bug reports, please open an issue or create a pull request.

## 📄 License

This project is unlicensed as specified in `package.json`.