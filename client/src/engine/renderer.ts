import rough from 'roughjs';
import { RoughCanvas } from 'roughjs/bin/canvas';
import { CanvasElement, getElementBounds, getSelectionBounds, UserPresence } from 'shared';
import { drawElement } from './roughRenderer';
import { Viewport } from './transform';

export interface Handle {
  type: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotation';
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getHandles(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  zoom: number = 1
): Handle[] {
  const size = 8 / zoom;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const rotY = bounds.minY - 24 / zoom;

  return [
    { type: 'nw', x: bounds.minX, y: bounds.minY, width: size, height: size },
    { type: 'n', x: cx, y: bounds.minY, width: size, height: size },
    { type: 'ne', x: bounds.maxX, y: bounds.minY, width: size, height: size },
    { type: 'e', x: bounds.maxX, y: cy, width: size, height: size },
    { type: 'se', x: bounds.maxX, y: bounds.maxY, width: size, height: size },
    { type: 's', x: cx, y: bounds.maxY, width: size, height: size },
    { type: 'sw', x: bounds.minX, y: bounds.maxY, width: size, height: size },
    { type: 'w', x: bounds.minX, y: cy, width: size, height: size },
    { type: 'rotation', x: cx, y: rotY, width: size, height: size },
  ];
}

export function renderScene(
  canvas: HTMLCanvasElement,
  elements: CanvasElement[],
  viewport: Viewport,
  selectedIds: string[],
  remoteUsers: UserPresence[],
  options: {
    showGrid: boolean;
    isDarkMode: boolean;
    selectionBox: { startX: number; startY: number; endX: number; endY: number } | null;
    laserTrail: { x: number; y: number; time: number }[];
    editingElementId?: string | null;
  }
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);

  // Clear canvas
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const dpr = window.devicePixelRatio || 1;
  ctx.scale(dpr, dpr);

  // Background color
  ctx.fillStyle = options.isDarkMode ? '#121214' : '#f8f9fa';
  ctx.fillRect(0, 0, width, height);

  // Apply camera/viewport transform
  ctx.translate(viewport.scrollX, viewport.scrollY);
  ctx.scale(viewport.zoom, viewport.zoom);

  // 1. Draw Grid
  if (options.showGrid) {
    drawDotGrid(ctx, viewport, width, height, options.isDarkMode);
  }

  // Rough Canvas instance
  const rc = rough.canvas(canvas);

  // 2. Draw Elements in zIndex order
  const sorted = [...elements]
    .filter((el) => !el.isDeleted)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const el of sorted) {
    // If element is actively being edited in the transparent textarea, do not duplicate text on canvas
    if (options.editingElementId && el.id === options.editingElementId && el.type === 'text') {
      continue;
    }
    drawElement(ctx, rc, el);
  }

  // 3. Draw Remote Users' Selections
  drawRemoteSelections(ctx, elements, remoteUsers);

  // 4. Draw Local Selection Box and Handles (skip if currently being edited in textarea)
  const selectedElements = sorted.filter(
    (el) => selectedIds.includes(el.id) && el.id !== options.editingElementId
  );
  if (selectedElements.length > 0) {
    drawLocalSelection(ctx, selectedElements, viewport);
  }

  // 5. Draw Marquee Selection Box (Drag-box)
  if (options.selectionBox) {
    drawMarqueeBox(ctx, options.selectionBox, options.isDarkMode);
  }

  // 6. Draw Laser Trails
  drawLaserTrails(ctx, options.laserTrail, remoteUsers);

  ctx.restore();
}

function drawDotGrid(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  viewW: number,
  viewH: number,
  isDark: boolean
) {
  const gridSize = 20;
  const startX = Math.floor((-viewport.scrollX / viewport.zoom) / gridSize) * gridSize;
  const startY = Math.floor((-viewport.scrollY / viewport.zoom) / gridSize) * gridSize;
  const endX = startX + (viewW / viewport.zoom) + gridSize * 2;
  const endY = startY + (viewH / viewport.zoom) + gridSize * 2;

  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
  const radius = Math.max(1, 1 / viewport.zoom);

  for (let x = startX; x <= endX; x += gridSize) {
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLocalSelection(
  ctx: CanvasRenderingContext2D,
  selectedElements: CanvasElement[],
  viewport: Viewport
) {
  const bounds = getSelectionBounds(selectedElements);
  if (!bounds) return;

  const pad = 6;
  const minX = bounds.minX - pad;
  const minY = bounds.minY - pad;
  const maxX = bounds.maxX + pad;
  const maxY = bounds.maxY + pad;
  const w = maxX - minX;
  const h = maxY - minY;

  ctx.save();
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 1.5 / viewport.zoom;
  ctx.setLineDash([5 / viewport.zoom, 5 / viewport.zoom]);
  ctx.strokeRect(minX, minY, w, h);

  // Rotation handle line
  const cx = (minX + maxX) / 2;
  const rotY = minY - 24 / viewport.zoom;
  ctx.beginPath();
  ctx.setLineDash([]);
  ctx.moveTo(cx, minY);
  ctx.lineTo(cx, rotY);
  ctx.stroke();

  // Handles
  const handles = getHandles({ minX, minY, maxX, maxY }, viewport.zoom);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 1.5 / viewport.zoom;

  const handleSize = 8 / viewport.zoom;

  for (const handle of handles) {
    if (handle.type === 'rotation') {
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, handleSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    }
  }

  // Dimensions label
  const dimText = `${Math.round(bounds.width)} × ${Math.round(bounds.height)}`;
  ctx.font = `${Math.max(10, 11 / viewport.zoom)}px Inter, sans-serif`;
  ctx.fillStyle = '#6366f1';
  ctx.textAlign = 'center';
  ctx.fillText(dimText, cx, maxY + 16 / viewport.zoom);

  ctx.restore();
}

function drawRemoteSelections(
  ctx: CanvasRenderingContext2D,
  elements: CanvasElement[],
  remoteUsers: UserPresence[]
) {
  for (const user of remoteUsers) {
    if (!user.selectedElementIds || user.selectedElementIds.length === 0) continue;

    const userSelected = elements.filter(
      (el) => user.selectedElementIds.includes(el.id) && !el.isDeleted
    );
    const bounds = getSelectionBounds(userSelected);
    if (!bounds) continue;

    ctx.save();
    ctx.strokeStyle = user.userColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    const pad = 4;
    ctx.strokeRect(
      bounds.minX - pad,
      bounds.minY - pad,
      bounds.width + pad * 2,
      bounds.height + pad * 2
    );

    // User name badge above selection
    ctx.fillStyle = user.userColor;
    ctx.font = '11px Inter, sans-serif';
    ctx.fillRect(bounds.minX - pad, bounds.minY - pad - 18, ctx.measureText(user.userName).width + 10, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(user.userName, bounds.minX - pad + 5, bounds.minY - pad - 5);
    ctx.restore();
  }
}

function drawMarqueeBox(
  ctx: CanvasRenderingContext2D,
  box: { startX: number; startY: number; endX: number; endY: number },
  isDark: boolean
) {
  const x = Math.min(box.startX, box.endX);
  const y = Math.min(box.startY, box.endY);
  const w = Math.abs(box.endX - box.startX);
  const h = Math.abs(box.endY - box.startY);

  ctx.save();
  ctx.fillStyle = isDark ? 'rgba(129, 140, 248, 0.15)' : 'rgba(99, 102, 241, 0.15)';
  ctx.strokeStyle = isDark ? '#818cf8' : '#6366f1';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawLaserTrails(
  ctx: CanvasRenderingContext2D,
  localLaser: { x: number; y: number; time: number }[],
  remoteUsers: UserPresence[]
) {
  const now = Date.now();
  const maxAge = 1200; // 1.2s fade

  const trails = [
    { points: localLaser, color: '#ef4444' },
    ...remoteUsers
      .filter((u) => u.laserPoints && u.laserPoints.length > 0)
      .map((u) => ({ points: u.laserPoints!, color: u.userColor })),
  ];

  for (const trail of trails) {
    const valid = trail.points.filter((p) => now - p.time < maxAge);
    if (valid.length < 2) continue;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < valid.length - 1; i++) {
      const p1 = valid[i];
      const p2 = valid[i + 1];
      const age = now - p2.time;
      const alpha = Math.max(0, 1 - age / maxAge);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = trail.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 4 * alpha + 1;
      ctx.stroke();
    }
    ctx.restore();
  }
}

