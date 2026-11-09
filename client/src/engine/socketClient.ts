import {
  CanvasElement,
  UserPresence,
  WSClientMessage,
  WSServerMessage,
  WSChatMessage,
} from 'shared';

export interface SocketCallbacks {
  onSyncFull: (elements: CanvasElement[], users: UserPresence[], isReadOnly: boolean) => void;
  onElementUpdate: (elements: CanvasElement[]) => void;
  onCursorMove: (userId: string, x: number | null, y: number | null, selectedElementIds: string[], isLaser?: boolean, laserPoints?: { x: number; y: number; time: number }[], viewport?: { scrollX: number; scrollY: number; zoom: number }) => void;
  onReaction: (reaction: { id: string; emoji: string; x: number; y: number; userName: string }) => void;
  onChatMessage: (message: WSChatMessage) => void;
  onUserJoined: (user: UserPresence) => void;
  onUserLeft: (userId: string) => void;
  onClearBoard: () => void;
  onStatusChange: (status: 'connected' | 'connecting' | 'disconnected') => void;
  onQueuedCountChange: (count: number) => void;
}

export class CollaborativeSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private roomId: string;
  private userId: string;
  private userName: string;
  private userColor: string;
  private isReadOnly: boolean;
  private callbacks: SocketCallbacks;

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private reconnectTimeout: any = null;
  private isExplicitlyClosed = false;

  private offlineQueue: CanvasElement[] = [];
  private lastCursorSendTime = 0;
  private pendingCursor: any = null;
  private cursorTimer: any = null;
  private pingInterval: any = null;

  constructor(
    roomId: string,
    userId: string,
    userName: string,
    userColor: string,
    isReadOnly: boolean,
    callbacks: SocketCallbacks
  ) {
    this.roomId = roomId;
    this.userId = userId;
    this.userName = userName;
    this.userColor = userColor;
    this.isReadOnly = isReadOnly;
    this.callbacks = callbacks;

    // Detect WS URL
    let wsUrl = import.meta.env.VITE_WS_URL;
    if (!wsUrl) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      if (window.location.port === '5173') {
        // Vite dev server port -> backend is at 3001
        wsUrl = `${protocol}//${window.location.hostname}:3001`;
      } else {
        wsUrl = `${protocol}//${window.location.host}`;
      }
    }
    this.url = wsUrl;
    this.connect();
  }

  public connect() {
    this.isExplicitlyClosed = false;
    this.callbacks.onStatusChange('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.callbacks.onStatusChange('connected');

        // Send Join Message
        this.sendMessage({
          type: 'join',
          roomId: this.roomId,
          userId: this.userId,
          userName: this.userName,
          userColor: this.userColor,
          isReadOnly: this.isReadOnly,
        });

        // Flush offline queue if any
        if (this.offlineQueue.length > 0 && !this.isReadOnly) {
          this.sendMessage({
            type: 'element-update',
            roomId: this.roomId,
            userId: this.userId,
            elements: [...this.offlineQueue],
          });
          this.offlineQueue = [];
          this.callbacks.onQueuedCountChange(0);
        }

        // Start ping heartbeat
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          this.sendMessage({ type: 'ping' });
        }, 15000);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: WSServerMessage = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      this.ws.onclose = () => {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.callbacks.onStatusChange('disconnected');
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket encountered an error', err);
        this.ws?.close();
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = Math.min(10000, 1000 * Math.pow(1.5, this.reconnectAttempts));
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private handleServerMessage(msg: WSServerMessage) {
    switch (msg.type) {
      case 'sync-full':
        this.callbacks.onSyncFull(msg.elements, msg.users, msg.isReadOnly);
        break;
      case 'element-update':
        this.callbacks.onElementUpdate(msg.elements);
        break;
      case 'cursor-move':
        this.callbacks.onCursorMove(
          msg.userId,
          msg.x,
          msg.y,
          msg.selectedElementIds,
          msg.isLaser,
          msg.laserPoints,
          msg.viewport
        );
        break;
      case 'reaction':
        this.callbacks.onReaction({
          id: msg.id,
          emoji: msg.emoji,
          x: msg.x,
          y: msg.y,
          userName: msg.userName,
        });
        break;
      case 'chat-message':
        this.callbacks.onChatMessage(msg);
        break;
      case 'user-joined':
        this.callbacks.onUserJoined(msg.user);
        break;
      case 'user-left':
        this.callbacks.onUserLeft(msg.userId);
        break;
      case 'clear-board':
        this.callbacks.onClearBoard();
        break;
    }
  }

  public sendElementUpdate(elements: CanvasElement[]) {
    if (this.isReadOnly) return;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue locally while offline
      this.offlineQueue.push(...elements);
      this.callbacks.onQueuedCountChange(this.offlineQueue.length);
      return;
    }

    this.sendMessage({
      type: 'element-update',
      roomId: this.roomId,
      userId: this.userId,
      elements,
    });
  }

  public sendCursorMove(
    x: number | null,
    y: number | null,
    selectedElementIds: string[],
    isLaser: boolean = false,
    laserPoints?: { x: number; y: number; time: number }[],
    viewport?: { scrollX: number; scrollY: number; zoom: number }
  ) {
    const now = Date.now();
    const data = { x, y, selectedElementIds, isLaser, laserPoints, viewport };

    if (now - this.lastCursorSendTime >= 35) { // ~30 fps throttle
      this.lastCursorSendTime = now;
      this.doSendCursor(data);
    } else {
      this.pendingCursor = data;
      if (!this.cursorTimer) {
        this.cursorTimer = setTimeout(() => {
          this.cursorTimer = null;
          if (this.pendingCursor) {
            this.doSendCursor(this.pendingCursor);
            this.pendingCursor = null;
            this.lastCursorSendTime = Date.now();
          }
        }, 35);
      }
    }
  }

  private doSendCursor(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendMessage({
        type: 'cursor-move',
        roomId: this.roomId,
        userId: this.userId,
        ...data,
      });
    }
  }

  public sendReaction(emoji: string, x: number, y: number) {
    this.sendMessage({
      type: 'reaction',
      roomId: this.roomId,
      userId: this.userId,
      userName: this.userName,
      emoji,
      x,
      y,
      id: Math.random().toString(36).slice(2),
    });
  }

  public sendChatMessage(text: string) {
    this.sendMessage({
      type: 'chat-message',
      roomId: this.roomId,
      id: Math.random().toString(36).slice(2),
      userId: this.userId,
      userName: this.userName,
      userColor: this.userColor,
      text,
      timestamp: Date.now(),
    });
  }

  public sendClearBoard() {
    if (this.isReadOnly) return;
    this.sendMessage({
      type: 'clear-board',
      roomId: this.roomId,
      userId: this.userId,
    });
  }

  public updateUserInfo(userName: string) {
    this.userName = userName;
    this.sendMessage({
      type: 'join',
      roomId: this.roomId,
      userId: this.userId,
      userName: this.userName,
      userColor: this.userColor,
      isReadOnly: this.isReadOnly,
    });
  }

  private sendMessage(msg: WSClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

