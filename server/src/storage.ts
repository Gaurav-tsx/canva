import fs from 'fs';
import path from 'path';
import { CanvasElement, LIMITS } from 'shared';

export interface StorageEngine {
  init(): void;
  getOrCreateRoom(roomId: string): { roomId: string; viewToken: string; isNew: boolean };
  loadRoomElements(roomId: string): CanvasElement[];
  saveRoomElements(roomId: string, elements: CanvasElement[]): void;
  cleanupInactiveRooms(): number;
  close(): void;
}

export class SQLiteStorage implements StorageEngine {
  private db: any = null;
  private dbPath: string;

  constructor(customPath?: string) {
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = customPath || path.join(dataDir, 'whiteboards.sqlite');
    this.init();
  }

  public init() {
    try {
      const { DatabaseSync } = require('node:sqlite');
      this.db = new DatabaseSync(this.dbPath);

      // WAL mode for fast concurrency & durability
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');

      // Create Tables
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS rooms (
          room_id TEXT PRIMARY KEY,
          view_token TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS elements (
          id TEXT PRIMARY KEY,
          room_id TEXT NOT NULL,
          data TEXT NOT NULL,
          version INTEGER NOT NULL,
          version_nonce INTEGER NOT NULL,
          is_deleted INTEGER NOT NULL,
          z_index REAL NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_elements_room ON elements (room_id, is_deleted);
        CREATE INDEX IF NOT EXISTS idx_rooms_updated ON rooms (updated_at);
      `);

      this.cleanupInactiveRooms();
    } catch (err) {
      console.error('Failed to initialize SQLite database, fallback to in-memory', err);
    }
  }

  public getOrCreateRoom(roomId: string): { roomId: string; viewToken: string; isNew: boolean } {
    if (!this.db) {
      return { roomId, viewToken: `view-${roomId}`, isNew: false };
    }

    const selectStmt = this.db.prepare('SELECT room_id, view_token FROM rooms WHERE room_id = ?');
    const existing = selectStmt.get(roomId);

    if (existing) {
      // Touch updated_at
      const touchStmt = this.db.prepare('UPDATE rooms SET updated_at = ? WHERE room_id = ?');
      touchStmt.run(Date.now(), roomId);
      return { roomId: existing.room_id, viewToken: existing.view_token, isNew: false };
    }

    const now = Date.now();
    const viewToken = `view-${roomId}`;
    const insertStmt = this.db.prepare(
      'INSERT INTO rooms (room_id, view_token, created_at, updated_at) VALUES (?, ?, ?, ?)'
    );
    insertStmt.run(roomId, viewToken, now, now);
    return { roomId, viewToken, isNew: true };
  }

  public loadRoomElements(roomId: string): CanvasElement[] {
    if (!this.db) return [];

    const selectStmt = this.db.prepare(
      'SELECT data FROM elements WHERE room_id = ? AND is_deleted = 0 ORDER BY z_index ASC'
    );
    const rows = selectStmt.all(roomId);
    const elements: CanvasElement[] = [];

    for (const row of rows) {
      try {
        elements.push(JSON.parse(row.data));
      } catch (e) {
        console.error('Failed to parse element JSON from database', e);
      }
    }
    return elements;
  }

  public saveRoomElements(roomId: string, elements: CanvasElement[]) {
    if (!this.db || elements.length === 0) return;

    this.getOrCreateRoom(roomId);
    const now = Date.now();

    const upsertStmt = this.db.prepare(`
      INSERT INTO elements (id, room_id, data, version, version_nonce, is_deleted, z_index, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        version = excluded.version,
        version_nonce = excluded.version_nonce,
        is_deleted = excluded.is_deleted,
        z_index = excluded.z_index,
        updated_at = excluded.updated_at
      WHERE excluded.version > elements.version
         OR (excluded.version = elements.version AND excluded.version_nonce >= elements.version_nonce)
    `);

    // In node:sqlite, wrap batch operations
    this.db.exec('BEGIN TRANSACTION;');
    try {
      for (const el of elements) {
        upsertStmt.run(
          el.id,
          roomId,
          JSON.stringify(el),
          el.version,
          el.versionNonce,
          el.isDeleted ? 1 : 0,
          el.zIndex,
          now
        );
      }
      const touchStmt = this.db.prepare('UPDATE rooms SET updated_at = ? WHERE room_id = ?');
      touchStmt.run(now, roomId);
      this.db.exec('COMMIT;');
    } catch (e) {
      this.db.exec('ROLLBACK;');
      console.error('Failed to save elements in transaction', e);
    }
  }

  public cleanupInactiveRooms(): number {
    if (!this.db) return 0;

    const cutoff = Date.now() - LIMITS.INACTIVE_ROOM_DAYS * 24 * 60 * 60 * 1000;
    try {
      this.db.exec('BEGIN TRANSACTION;');
      const deleteElementsStmt = this.db.prepare(`
        DELETE FROM elements WHERE room_id IN (
          SELECT room_id FROM rooms WHERE updated_at < ?
        )
      `);
      deleteElementsStmt.run(cutoff);

      const deleteRoomsStmt = this.db.prepare('DELETE FROM rooms WHERE updated_at < ?');
      deleteRoomsStmt.run(cutoff);
      this.db.exec('COMMIT;');
      return 1;
    } catch (e) {
      this.db.exec('ROLLBACK;');
      console.error('Error cleaning up inactive rooms', e);
      return 0;
    }
  }

  public close() {
    if (this.db) {
      try {
        this.db.close();
      } catch {}
    }
  }
}

