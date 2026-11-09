import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { LIMITS, WSClientMessage } from 'shared';
import { SQLiteStorage } from './storage';
import { RoomManager, ClientSession } from './roomManager';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;
const storage = new SQLiteStorage();
const roomManager = new RoomManager(storage);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Basic Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// REST Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const meta = storage.getOrCreateRoom(roomId);
  const elements = storage.loadRoomElements(roomId);
  res.json({
    roomId: meta.roomId,
    viewToken: meta.viewToken,
    elementCount: elements.length,
  });
});

// Serve frontend in production
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// Catch-all route to serve client index.html (SPA routing for /board/:id and /view/:id)
app.get('*', (req, res) => {
  const indexHtml = path.join(clientDist, 'index.html');
  res.sendFile(indexHtml, (err) => {
    if (err) {
      res.status(200).send('Excalidraw Server is running. Frontend is available in client dev mode or once built.');
    }
  });
});

// WebSocket Server
const socketSessions = new Map<WebSocket, { session: ClientSession; roomId: string }>();

wss.on('connection', (ws: WebSocket, req) => {
  const ip = req.socket.remoteAddress || 'unknown';

  ws.on('message', (rawData: Buffer | string) => {
    // 1. Cap message size
    const byteLength = Buffer.byteLength(rawData as any);
    if (byteLength > LIMITS.MAX_WS_MESSAGE_BYTES) {
      ws.send(JSON.stringify({ type: 'error', message: 'Message payload too large' }));
      return;
    }

    try {
      const msg: WSClientMessage = JSON.parse(rawData.toString());

      // 2. Handle Join
      if (msg.type === 'join') {
        const { roomId, userId, userName, userColor, isReadOnly } = msg;
        if (!roomId || !userId) return;

        const room = roomManager.getOrCreateRoom(roomId);

        // Cap users per room
        if (room.clients.size >= LIMITS.MAX_USERS_PER_ROOM) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room capacity reached (max 50 participants)' }));
          ws.close();
          return;
        }

        const session = room.addClient(ws, userId, userName, userColor, !!isReadOnly);
        socketSessions.set(ws, { session, roomId });
        return;
      }

      // Check registered session for subsequent messages
      const socketData = socketSessions.get(ws);
      if (!socketData) return;

      const { session, roomId } = socketData;
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      // Rate limit check
      if (!session.rateLimiter.allow()) {
        ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded. Please slow down.' }));
        return;
      }

      // 3. Handle Ping
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      // 4. Handle Element Updates
      if (msg.type === 'element-update') {
        room.handleElementUpdate(session, msg.elements);
        return;
      }

      // 5. Handle Cursor Movement
      if (msg.type === 'cursor-move') {
        room.handleCursorMove(
          session,
          msg.x,
          msg.y,
          msg.selectedElementIds,
          msg.isLaser,
          msg.laserPoints,
          msg.viewport
        );
        return;
      }

      // 6. Handle Reaction
      if (msg.type === 'reaction') {
        room.handleReaction(session, msg.emoji, msg.x, msg.y, msg.id);
        return;
      }

      // 7. Handle Chat Message
      if (msg.type === 'chat-message') {
        room.handleChatMessage(session, msg.text, msg.id);
        return;
      }

      // 8. Handle Clear Board
      if (msg.type === 'clear-board') {
        room.handleClearBoard(session);
        return;
      }
    } catch (e) {
      console.error('Error handling WebSocket message', e);
    }
  });

  ws.on('close', () => {
    const socketData = socketSessions.get(ws);
    if (socketData) {
      const room = roomManager.getRoom(socketData.roomId);
      if (room) {
        room.removeClient(ws);
      }
      socketSessions.delete(ws);
    }
  });

  ws.on('error', (err) => {
    console.warn(`WebSocket error from ${ip}:`, err.message);
  });
});

// Periodic inactive rooms cleanup (every 24 hours)
setInterval(() => {
  storage.cleanupInactiveRooms();
}, 24 * 60 * 60 * 1000);

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down server, flushing data to disk...');
  roomManager.flushAll();
  storage.close();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, () => {
  console.log(`Excalidraw Realtime Server listening on http://localhost:${PORT}`);
});

