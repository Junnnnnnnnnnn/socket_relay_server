# Real-time Motion-Controlled Mini-Game Hub

[![Stars](https://img.shields.io/github/stars/Junnnnnnnnnnn/socket_relay_server?style=flat-square)](https://github.com/Junnnnnnnnnnn/socket_relay_server/stargazers)
[![Forks](https://img.shields.io/github/forks/Junnnnnnnnnnn/socket_relay_server?style=flat-square)](https://github.com/Junnnnnnnnnnn/socket_relay_server/network/members)
[![Issues](https://img.shields.io/github/issues/Junnnnnnnnnnn/socket_relay_server?style=flat-square)](https://github.com/Junnnnnnnnnnn/socket_relay_server/issues)

This project is a backend server, built with **NestJS** and **TypeScript**, that hosts a collection of real-time, interactive mini-games. It uses **Socket.io** to create a seamless, low-latency experience, allowing players to use their mobile phones as motion controllers.

## Key Features

- **Built with NestJS:** A modern, scalable Node.js framework.
- **Real-time Multiplayer:** WebSocket-based communication via Socket.io for instant interaction.
- **Multiple Games:** Features three distinct games, each running on its own dedicated namespace.
- **Motion Control:** Designed to use mobile device motion sensors for immersive gameplay.
- **Display & Controller Architecture:** Separates the game screen (Display) from the player's device (Controller) for a console-like experience.

## The Games

1.  **Baseball (`/baseball` namespace):** Step up to the plate and swing your phone to hit baseballs. Timing is everything!
2.  **Climb (`/climb` namespace):** Shake your device to climb a virtual wall. The faster you shake, the higher you go!
3.  **Dart (`/dart` namespace):** Take aim with your phone and flick your wrist to throw darts at the target.

## System Architecture

The server connects two types of clients:

- **Display:** The main game screen, typically running on a desktop browser, smart TV, or public display. It shows the game visuals.
- **Controller:** The player's mobile device, which sends motion data and commands to the server.

Clients connect to the same game "room" to synchronize the action between the controller and the display.

## Prerequisites

To deploy and run this server, you will need:

- Node.js (v18 or newer recommended)
- A publicly accessible server or hosting platform (e.g., AWS, DigitalOcean, Heroku).
- A public domain name for your server. **HTTPS is required** on both the client and server for mobile browsers to grant access to motion sensor data.

## Installation and Deployment

1.  **Clone the repository:**

    ```bash
    git clone <your-repository-url>
    cd socket_relay_server
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Build the application:**

    ```bash
    npm run build
    ```

4.  **Run the server:**
    ```bash
    npm run start:prod
    ```

The server will start, ready to accept WebSocket connections on its configured port. Ensure your server is deployed to a public domain so clients can connect.

## Client Setup

This repository contains the **backend server only**. The client-side applications (the HTML/JS for the Display and Controller) were implemented with the assistance of ChatGPT and must be hosted separately.

1.  **Host the Client Files:** Deploy the `display.html` and `controller.html` (and any associated CSS/JS) to a static web hosting service (like Vercel, Netlify, or a simple Nginx server).
2.  **Configure the Endpoint:** In your client-side JavaScript, make sure you are connecting to the public domain of your deployed NestJS socket server.
    ```javascript
    // Example client-side connection
    const socket = io('https://your-socket-server-domain.com/baseball');
    ```
3.  **Enable HTTPS:** Both the client-hosting server and this socket server must be served over HTTPS to use motion controls.

## How to Play

1.  Open the **Display** URL on a large screen (e.g., a laptop or TV).
2.  Open the **Controller** URL on your smartphone.
3.  Follow the on-screen instructions to connect your phone to the game room.
4.  Use your phone's motion sensors to play the game!

---

Enjoy the games!
