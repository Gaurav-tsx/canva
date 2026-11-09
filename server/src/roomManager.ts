import { WebSocket } from 'ws';
import {
  CanvasElement,
  LIMITS,
  shouldOverwriteElement,
  UserPresence,
  WSClientMessage,
  WSServerMessage,
} from 'shared';
import { StorageEngine } from './storage';
import { RateLimiter } from './rateLimiter';
import { sanitizeText, sanitizeUserName } from './sanitize';

export interface ClientSession {
  ws: WebSocket;
  userId: string;
  userName: string;
  userColor: string;
  isReadOnly: boolean;
  rateLimiter: RateLimiter;
  lastActive: number;
  cursor: { x: number; y: number } | null;
  selectedElementIds: string[];
  laserPoints?: { x: number; y: number; time: number }[];
  viewport?: { scrollX: number; scrollY: number; zoom: number };
}

export class Room {
  public roomId: string;
  public elements: Map<string, CanvasElement> = new Map();
  public clients: Map<WebSocket, ClientSession> = new Map();
  public storage: StorageEngine;
  public dirty: boolean = false;
  public lastActive: number = Date.now();
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(roomId: string, storage: StorageEngine) {
    this.roomId = roomId;
    this.storage = storage;

    // Load initial board state from database
    const initialElements = this.storage.loadRoomElements(roomId);
    for (const el of initialElements) {
      this.elements.set(el.id, el);
    }
  }

  public addClient(
    ws: WebSocket,
    userId: string,
    userName: string,
    userColor: string,
    isReadOnly: boolean = false
  ): ClientSession {
    const session: ClientSession = {
      ws,
      userId,
      userName: sanitizeUserName(userName),
      userColor,
      isReadOnly,
      rateLimiter: new RateLimiter(),
      lastActive: Date.now(),
      cursor: null,
      selectedElementIds: [],
    };

    this.clients.set(ws, session);
    this.lastActive = Date.now();

    // 1. Send Full Board Sync to the new client
    const fullSyncMsg: WSServerMessage = {
      type: 'sync-full',
      roomId: this.roomId,
      elements: Array.from(this.elements.values()).filter((e) => !e.isDeleted),
      users: this.getPresenceList(),
      isReadOnly,
      serverTime: Date.now(),
    };
    this.sendTo(ws, fullSyncMsg);

    // 2. Notify other clients that this user joined
    const joinMsg: WSServerMessage = {
      type: 'user-joined',
      user: {
        userId: session.userId,
        userName: session.userName,
        userColor: session.userColor,
        cursor: null,
        selectedElementIds: [],
        lastActive: session.lastActive,
      },
    };
    this.broadcast(joinMsg, ws);

    return session;
  }

  public removeClient(ws: WebSocket): string | null {
    const session = this.clients.get(ws);
    if (!session) return null;

    const userId = session.userId;
    this.clients.delete(ws);
    this.lastActive = Date.now();

    // Notify other clients
    this.broadcast({
      type: 'user-left',
      userId,
    });

    // If room is now empty, flush pending writes immediately
    if (this.clients.size === 0) {
      this.flushToStorage();
    }

    return userId;
  }

  public handleElementUpdate(session: ClientSession, incoming: CanvasElement[]) {
    if (session.isReadOnly) return;

    // Enforce max board elements limit
    if (this.elements.size > LIMITS.MAX_ELEMENTS_PER_BOARD) {
      this.sendTo(session.ws, {
        type: 'error',
        message: 'Board element limit reached (max 20,000)',
      });
      return;
    }

    const applied: CanvasElement[] = [];

    for (const item of incoming) {
      // Validate element structure
      if (!item.id || !item.type) continue;

      // Sanitize text
      if (item.text) {
        item.text = sanitizeText(item.text);
      }

      const existing = this.elements.get(item.id);
      if (shouldOverwriteElement(item, existing)) {
        this.elements.set(item.id, item);
        applied.push(item);
      }
    }

    if (applied.length > 0) {
      this.dirty = true;
      this.lastActive = Date.now();

      // Broadcast within 50ms to other clients
      this.broadcast(
        {
          type: 'element-update',
          roomId: this.roomId,
          userId: session.userId,
          elements: applied,
        },
        session.ws
      );

      // Debounce persistence flush (~2 seconds)
      this.scheduleFlush();
    }
  }

  public handleCursorMove(
    session: ClientSession,
    x: number | null,
    y: number | null,
    selectedElementIds: string[],
    isLaser?: boolean,
    laserPoints?: { x: number; y: number; time: number }[],
    viewport?: { scrollX: number; scrollY: number; zoom: number }
  ) {
    session.cursor = x !== null && y !== null ? { x, y } : null;
    session.selectedElementIds = selectedElementIds || [];
    session.laserPoints = laserPoints;
    session.viewport = viewport;
    session.lastActive = Date.now();

    // Broadcast cursor position to all other clients
    this.broadcast(
      {
        type: 'cursor-move',
        roomId: this.roomId,
        userId: session.userId,
        x,
        y,
        selectedElementIds,
        isLaser,
        laserPoints,
        viewport,
      },
      session.ws
    );
  }

  public handleReaction(session: ClientSession, emoji: string, x: number, y: number, id: string) {
    this.broadcast({
      type: 'reaction',
      roomId: this.roomId,
      userId: session.userId,
      userName: session.userName,
      emoji: emoji.slice(0, 4),
      x,
      y,
      id: id || Math.random().toString(36),
    });
  }

  public handleChatMessage(session: ClientSession, text: string, id: string) {
    const cleanText = sanitizeText(text);
    if (!cleanText.trim()) return;

    this.broadcast({
      type: 'chat-message',
      roomId: this.roomId,
      id: id || Math.random().toString(36),
      userId: session.userId,
      userName: session.userName,
      userColor: session.userColor,
      text: cleanText,
      timestamp: Date.now(),
    });
  }

  public handleClearBoard(session: ClientSession) {
    if (session.isReadOnly) return;

    // Mark all elements as deleted
    const now = Date.now();
    for (const [id, el] of this.elements.entries()) {
      this.elements.set(id, {
        ...el,
        isDeleted: true,
        version: el.version + 1,
        versionNonce: now,
        updatedBy: session.userId,
      });
    }

    this.dirty = true;
    this.flushToStorage();

    // Broadcast clear event
    this.broadcast({
      type: 'clear-board',
      roomId: this.roomId,
      userId: session.userId,
    });
  }

  public scheduleFlush() {
    if (this.debounceTimer) return;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.flushToStorage();
    }, 2000);
  }

  public flushToStorage() {
    if (!this.dirty) return;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const elementsArray = Array.from(this.elements.values());
    this.storage.saveRoomElements(this.roomId, elementsArray);
    this.dirty = false;
  }

  public getPresenceList(): UserPresence[] {
    const users: UserPresence[] = [];
    for (const session of this.clients.values()) {
      users.push({
        userId: session.userId,
        userName: session.userName,
        userColor: session.userColor,
        cursor: session.cursor,
        selectedElementIds: session.selectedElementIds,
        lastActive: session.lastActive,
        laserPoints: session.laserPoints,
        viewport: session.viewport,
      });
    }
    return users;
  }

  public broadcast(msg: WSServerMessage, excludeWs?: WebSocket) {
    const data = JSON.stringify(msg);
    for (const [clientWs] of this.clients) {
      if (clientWs !== excludeWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    }
  }

  public sendTo(ws: WebSocket, msg: WSServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private storage: StorageEngine;

  constructor(storage: StorageEngine) {
    this.storage = storage;

    // Periodic memory cleanup: evict idle empty rooms every 5 minutes
    setInterval(() => {
      this.cleanupIdleRooms();
    }, 5 * 60 * 1000);
  }

  public getOrCreateRoom(roomId: string): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Room(roomId, this.storage);
      this.rooms.set(roomId, room);
    }
    return room;
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  public cleanupIdleRooms() {
    const now = Date.now();
    const idleTimeout = 5 * 60 * 1000; // 5 mins of no clients

    for (const [id, room] of this.rooms.entries()) {
      if (room.clients.size === 0 && now - room.lastActive > idleTimeout) {
        room.flushToStorage();
        this.rooms.delete(id);
      }
    }
  }

  public flushAll() {
    for (const room of this.rooms.values()) {
      room.flushToStorage();
    }
  }
}

