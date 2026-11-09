import getStroke from 'perfect-freehand';
import { CanvasElement } from 'shared';

export function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return '';

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );

  d.push('Z');
  return d.join(' ');
}

export function drawFreedrawElement(
  ctx: CanvasRenderingContext2D,
  element: CanvasElement
) {
  if (!element.points || element.points.length === 0) return;

  // Offset points by element position
  const rawPoints = element.points.map(([px, py]) => [element.x + px, element.y + py]);

  const outline = getStroke(rawPoints, {
    size: Math.max(3, element.strokeWidth * 2.5),
    thinning: 0.5,
    smoothing: 0.6,
    streamline: 0.5,
    easing: (t) => t,
    start: {
      taper: 0,
      cap: true,
    },
    end: {
      taper: 0,
      cap: true,
    },
  });

  if (outline.length < 3) return;

  ctx.save();
  ctx.globalAlpha = (element.opacity || 100) / 100;
  ctx.fillStyle = element.strokeColor;

  ctx.beginPath();
  ctx.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    ctx.lineTo(outline[i][0], outline[i][1]);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

