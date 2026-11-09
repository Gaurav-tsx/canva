import { ADJECTIVES, ANIMALS, USER_COLORS } from './constants';
import { CanvasElement } from './types';

export function generateRandomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}

export function generateRandomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

export function generateId(length: number = 12): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return result;
}

/**
 * Last-Write-Wins element conflict resolution.
 * Returns true if incoming element should overwrite local element.
 */
export function shouldOverwriteElement(
  incoming: CanvasElement,
  existing?: CanvasElement
): boolean {
  if (!existing) return true;
  if (incoming.version > existing.version) return true;
  if (incoming.version === existing.version) {
    return incoming.versionNonce >= existing.versionNonce;
  }
  return false;
}

