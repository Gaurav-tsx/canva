import { CanvasElement, UserPresence } from './types';

export interface WSJoinMessage {
  type: 'join';
  roomId: string;
  userId: string;
  userName: string;
  userColor: string;
  isReadOnly?: boolean;
}

export interface WSSyncFullMessage {
  type: 'sync-full';
  roomId: string;
  elements: CanvasElement[];
  users: UserPresence[];
  isReadOnly: boolean;
  serverTime: number;
}

export interface WSElementUpdateMessage {
  type: 'element-update';
  roomId: string;
  userId: string;
  elements: CanvasElement[];
}

export interface WSCursorMoveMessage {
  type: 'cursor-move';
  roomId: string;
  userId: string;
  x: number | null;
  y: number | null;
  selectedElementIds: string[];
  isLaser?: boolean;
  laserPoints?: { x: number; y: number; time: number }[];
  viewport?: { scrollX: number; scrollY: number; zoom: number };
}

export interface WSReactionMessage {
  type: 'reaction';
  roomId: string;
  userId: string;
  userName: string;
  emoji: string;
  x: number;
  y: number;
  id: string;
}

export interface WSChatMessage {
  type: 'chat-message';
  roomId: string;
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  text: string;
  timestamp: number;
}

export interface WSClearBoardMessage {
  type: 'clear-board';
  roomId: string;
  userId: string;
}

export interface WSUserJoinedMessage {
  type: 'user-joined';
  user: UserPresence;
}

export interface WSUserLeftMessage {
  type: 'user-left';
  userId: string;
}

export interface WSPingMessage {
  type: 'ping';
}

export interface WSPongMessage {
  type: 'pong';
}

export interface WSErrorMessage {
  type: 'error';
  message: string;
  code?: string;
}

export type WSClientMessage =
  | WSJoinMessage
  | WSElementUpdateMessage
  | WSCursorMoveMessage
  | WSReactionMessage
  | WSChatMessage
  | WSClearBoardMessage
  | WSPingMessage;

export type WSServerMessage =
  | WSSyncFullMessage
  | WSElementUpdateMessage
  | WSCursorMoveMessage
  | WSReactionMessage
  | WSChatMessage
  | WSClearBoardMessage
  | WSUserJoinedMessage
  | WSUserLeftMessage
  | WSPongMessage
  | WSErrorMessage;

