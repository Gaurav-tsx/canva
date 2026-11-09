import { CanvasElement, Point } from './types';

export function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

export function rotatePoint(point: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + (dx * cos - dy * sin),
    y: center.y + (dx * sin + dy * cos),
  };
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function getElementBounds(element: CanvasElement): Bounds {
  if (element.type === 'freedraw') {
    if (!element.points || element.points.length === 0) {
      return {
        minX: element.x,
        minY: element.y,
        maxX: element.x + element.width,
        maxY: element.y + element.height,
        width: Math.abs(element.width) || 10,
        height: Math.abs(element.height) || 10,
      };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [px, py] of element.points) {
      const absX = element.x + px;
      const absY = element.y + py;
      if (absX < minX) minX = absX;
      if (absY < minY) minY = absY;
      if (absX > maxX) maxX = absX;
      if (absY > maxY) maxY = absY;
    }
    const pad = (element.strokeWidth || 2) * 2;
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
      width: Math.max(10, maxX - minX + pad * 2),
      height: Math.max(10, maxY - minY + pad * 2),
    };
  }

  if (element.type === 'line' || element.type === 'arrow') {
    const x1 = element.x;
    const y1 = element.y;
    const x2 = element.x + element.width;
    const y2 = element.y + element.height;
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const maxX = Math.max(x1, x2);
    const maxY = Math.max(y1, y2);
    const pad = Math.max(10, element.strokeWidth * 4);
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
      width: Math.max(10, maxX - minX + pad * 2),
      height: Math.max(10, maxY - minY + pad * 2),
    };
  }

  const minX = Math.min(element.x, element.x + element.width);
  const minY = Math.min(element.y, element.y + element.height);
  const maxX = Math.max(element.x, element.x + element.width);
  const maxY = Math.max(element.y, element.y + element.height);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function getSelectionBounds(elements: CanvasElement[]): Bounds | null {
  const visible = elements.filter((el) => !el.isDeleted);
  if (visible.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of visible) {
    const b = getElementBounds(el);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function isPointInElement(point: Point, element: CanvasElement): boolean {
  if (element.isDeleted) return false;

  const b = getElementBounds(element);
  const threshold = Math.max(8, element.strokeWidth * 2);

  // Quick bounding box check with padding
  if (
    point.x < b.minX - threshold ||
    point.x > b.maxX + threshold ||
    point.y < b.minY - threshold ||
    point.y > b.maxY + threshold
  ) {
    return false;
  }

  // Handle rotated element
  let p = point;
  if (element.angle && element.angle !== 0) {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    p = rotatePoint(point, { x: cx, y: cy }, -element.angle);
  }

  const ex = Math.min(element.x, element.x + element.width);
  const ey = Math.min(element.y, element.y + element.height);
  const ew = Math.abs(element.width);
  const eh = Math.abs(element.height);

  switch (element.type) {
    case 'rectangle':
    case 'image':
    case 'text': {
      if (element.fillStyle !== 'none' || element.type === 'text' || element.type === 'image') {
        return p.x >= ex && p.x <= ex + ew && p.y >= ey && p.y <= ey + eh;
      }
      // Outline only
      const onLeft = Math.abs(p.x - ex) <= threshold && p.y >= ey && p.y <= ey + eh;
      const onRight = Math.abs(p.x - (ex + ew)) <= threshold && p.y >= ey && p.y <= ey + eh;
      const onTop = Math.abs(p.y - ey) <= threshold && p.x >= ex && p.x <= ex + ew;
      const onBottom = Math.abs(p.y - (ey + eh)) <= threshold && p.x >= ex && p.x <= ex + ew;
      return onLeft || onRight || onTop || onBottom;
    }

    case 'ellipse': {
      const rx = ew / 2;
      const ry = eh / 2;
      const cx = ex + rx;
      const cy = ey + ry;
      if (rx === 0 || ry === 0) return false;
      const norm = Math.pow(p.x - cx, 2) / Math.pow(rx, 2) + Math.pow(p.y - cy, 2) / Math.pow(ry, 2);
      if (element.fillStyle !== 'none') {
        return norm <= 1.05;
      }
      // Ring boundary
      return Math.abs(Math.sqrt(norm) - 1) < 0.2;
    }

    case 'diamond': {
      const cx = ex + ew / 2;
      const cy = ey + eh / 2;
      const dx = Math.abs(p.x - cx) / (ew / 2 || 1);
      const dy = Math.abs(p.y - cy) / (eh / 2 || 1);
      const val = dx + dy;
      if (element.fillStyle !== 'none') {
        return val <= 1.1;
      }
      return Math.abs(val - 1) < 0.2;
    }

    case 'line':
    case 'arrow': {
      const p1 = { x: element.x, y: element.y };
      const p2 = { x: element.x + element.width, y: element.y + element.height };
      return distanceToSegment(point, p1, p2) <= threshold;
    }

    case 'freedraw': {
      if (!element.points || element.points.length === 0) return false;
      for (let i = 0; i < element.points.length - 1; i++) {
        const p1 = { x: element.x + element.points[i][0], y: element.y + element.points[i][1] };
        const p2 = { x: element.x + element.points[i + 1][0], y: element.y + element.points[i + 1][1] };
        if (distanceToSegment(point, p1, p2) <= threshold) {
          return true;
        }
      }
      return false;
    }

    default:
      return p.x >= ex && p.x <= ex + ew && p.y >= ey && p.y <= ey + eh;
  }
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
  if (l2 === 0) return distance(p, a);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj = {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  };
  return distance(p, proj);
}

export function snapToGrid(value: number, gridSize: number = 20): number {
  return Math.round(value / gridSize) * gridSize;
}

// math utilities

