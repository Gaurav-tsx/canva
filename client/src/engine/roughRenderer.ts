import rough from 'roughjs';
import { RoughCanvas } from 'roughjs/bin/canvas';
import { CanvasElement } from 'shared';
import { drawFreedrawElement } from './freehandRenderer';
import { rotatePoint } from 'shared';

const imageCache = new Map<string, HTMLImageElement>();

export function getCachedImage(url: string): HTMLImageElement | null {
  if (imageCache.has(url)) {
    const img = imageCache.get(url)!;
    if (img.complete && img.naturalWidth > 0) return img;
    return null;
  }
  const img = new Image();
  img.src = url;
  imageCache.set(url, img);
  return null;
}

export function drawElement(
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  element: CanvasElement,
  isEditing: boolean = false
) {
  if (element.isDeleted) return;

  ctx.save();
  ctx.globalAlpha = (element.opacity || 100) / 100;

  // Handle rotation
  if (element.angle && element.angle !== 0) {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate(element.angle);
    ctx.translate(-cx, -cy);
  }

  const ex = Math.min(element.x, element.x + element.width);
  const ey = Math.min(element.y, element.y + element.height);
  const ew = Math.abs(element.width);
  const eh = Math.abs(element.height);

  const dashPattern =
    element.strokeStyle === 'dashed'
      ? [8, 8]
      : element.strokeStyle === 'dotted'
      ? [3, 6]
      : undefined;

  const roughOptions: any = {
    seed: element.seed || 12345,
    stroke: element.strokeColor,
    strokeWidth: element.strokeWidth,
    roughness: element.roughness,
    strokeLineDash: dashPattern,
    fill: element.fillColor && element.fillColor !== 'transparent' ? element.fillColor : undefined,
    fillStyle: element.fillStyle === 'none' ? undefined : element.fillStyle,
    hachureGap: Math.max(4, element.strokeWidth * 2.5),
    bowing: element.roughness > 0 ? 1 : 0,
  };

  switch (element.type) {
    case 'rectangle': {
      rc.rectangle(ex, ey, ew, eh, roughOptions);
      break;
    }

    case 'ellipse': {
      const cx = ex + ew / 2;
      const cy = ey + eh / 2;
      rc.ellipse(cx, cy, ew, eh, roughOptions);
      break;
    }

    case 'diamond': {
      const pTop: [number, number] = [ex + ew / 2, ey];
      const pRight: [number, number] = [ex + ew, ey + eh / 2];
      const pBottom: [number, number] = [ex + ew / 2, ey + eh];
      const pLeft: [number, number] = [ex, ey + eh / 2];
      rc.polygon([pTop, pRight, pBottom, pLeft], roughOptions);
      break;
    }

    case 'line': {
      const x1 = element.x;
      const y1 = element.y;
      const x2 = element.x + element.width;
      const y2 = element.y + element.height;
      rc.line(x1, y1, x2, y2, roughOptions);
      break;
    }

    case 'arrow': {
      const x1 = element.x;
      const y1 = element.y;
      const x2 = element.x + element.width;
      const y2 = element.y + element.height;
      rc.line(x1, y1, x2, y2, roughOptions);

      // Arrowhead calculations
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLength = Math.max(12, element.strokeWidth * 5);
      const arrowAngle = Math.PI / 6; // 30 degrees

      const leftX = x2 - headLength * Math.cos(angle - arrowAngle);
      const leftY = y2 - headLength * Math.sin(angle - arrowAngle);
      const rightX = x2 - headLength * Math.cos(angle + arrowAngle);
      const rightY = y2 - headLength * Math.sin(angle + arrowAngle);

      rc.line(x2, y2, leftX, leftY, { ...roughOptions, fill: undefined });
      rc.line(x2, y2, rightX, rightY, { ...roughOptions, fill: undefined });
      break;
    }

    case 'freedraw': {
      drawFreedrawElement(ctx, element);
      break;
    }

    case 'text': {
      drawTextElement(ctx, element, ex, ey, ew, eh);
      break;
    }

    case 'image': {
      if (element.imageUrl) {
        const img = getCachedImage(element.imageUrl);
        if (img) {
          ctx.drawImage(img, ex, ey, ew, eh);
        } else {
          // Placeholder loading box
          ctx.strokeStyle = '#cccccc';
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(ex, ey, ew, eh);
          ctx.fillStyle = '#888888';
          ctx.font = '12px sans-serif';
          ctx.fillText('Loading image...', ex + 10, ey + 20);
        }
      }
      break;
    }
  }

  // If a shape has attached text (e.g. double clicked to add label to shape)
  if (element.text && element.type !== 'text') {
    drawAttachedLabel(ctx, element, ex, ey, ew, eh);
  }

  ctx.restore();
}

function drawTextElement(
  ctx: CanvasRenderingContext2D,
  element: CanvasElement,
  ex: number,
  ey: number,
  ew: number,
  eh: number
) {
  if (!element.text) return;

  const fontSize = element.fontSize || 20;
  let fontFam = 'Caveat, Virgil, cursive';
  if (element.fontFamily === 'normal') fontFam = 'Inter, sans-serif';
  if (element.fontFamily === 'code') fontFam = 'Fira Code, monospace';

  ctx.font = `${fontSize}px ${fontFam}`;
  ctx.fillStyle = element.strokeColor;
  ctx.textBaseline = 'top';

  const lines = element.text.split('\n');
  const lineHeight = fontSize * 1.25;

  lines.forEach((line, index) => {
    let textX = ex;
    if (element.textAlign === 'center') {
      textX = ex + ew / 2;
      ctx.textAlign = 'center';
    } else if (element.textAlign === 'right') {
      textX = ex + ew;
      ctx.textAlign = 'right';
    } else {
      ctx.textAlign = 'left';
    }
    ctx.fillText(line, textX, ey + index * lineHeight);
  });
}

function drawAttachedLabel(
  ctx: CanvasRenderingContext2D,
  element: CanvasElement,
  ex: number,
  ey: number,
  ew: number,
  eh: number
) {
  if (!element.text) return;
  const fontSize = element.fontSize || 18;
  ctx.font = `${fontSize}px Caveat, cursive`;
  ctx.fillStyle = element.strokeColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = element.text.split('\n');
  const lineHeight = fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  const startY = ey + eh / 2 - totalHeight / 2 + lineHeight / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, ex + ew / 2, startY + i * lineHeight);
  });
}

