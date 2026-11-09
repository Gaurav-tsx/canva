export interface Viewport {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

export function screenToCanvas(
  screenX: number,
  screenY: number,
  viewport: Viewport
): { x: number; y: number } {
  return {
    x: (screenX - viewport.scrollX) / viewport.zoom,
    y: (screenY - viewport.scrollY) / viewport.zoom,
  };
}

export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  viewport: Viewport
): { x: number; y: number } {
  return {
    x: canvasX * viewport.zoom + viewport.scrollX,
    y: canvasY * viewport.zoom + viewport.scrollY,
  };
}

