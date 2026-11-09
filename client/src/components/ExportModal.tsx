import React, { useState } from 'react';
import { X, Image, FileCode, FileJson, Download } from 'lucide-react';
import { CanvasElement, getSelectionBounds } from 'shared';
import rough from 'roughjs';
import { drawElement } from '../engine/roughRenderer';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: CanvasElement[];
  isDarkMode: boolean;
  onToast: (msg: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  elements,
  isDarkMode,
  onToast,
}) => {
  const [withBackground, setWithBackground] = useState(true);
  const [exportDark, setExportDark] = useState(isDarkMode);

  if (!isOpen) return null;

  const visibleElements = elements.filter((e) => !e.isDeleted);

  const exportPNG = () => {
    if (visibleElements.length === 0) {
      onToast('Canvas is empty!');
      return;
    }

    const bounds = getSelectionBounds(visibleElements);
    if (!bounds) return;

    const pad = 40;
    const exportWidth = bounds.width + pad * 2;
    const exportHeight = bounds.height + pad * 2;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = exportWidth * 2; // 2x for sharp retina export
    offCanvas.height = exportHeight * 2;

    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(2, 2);

    if (withBackground) {
      ctx.fillStyle = exportDark ? '#121214' : '#ffffff';
      ctx.fillRect(0, 0, exportWidth, exportHeight);
    }

    ctx.translate(-bounds.minX + pad, -bounds.minY + pad);

    const rc = rough.canvas(offCanvas);
    const sorted = [...visibleElements].sort((a, b) => a.zIndex - b.zIndex);

    for (const el of sorted) {
      drawElement(ctx, rc, el);
    }

    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = offCanvas.toDataURL('image/png');
    link.click();
    onToast('Exported PNG successfully!');
    onClose();
  };

  const exportJSON = () => {
    const data = JSON.stringify(visibleElements, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    onToast('Exported JSON successfully!');
    onClose();
  };

  const exportSVG = () => {
    if (visibleElements.length === 0) {
      onToast('Canvas is empty!');
      return;
    }

    const bounds = getSelectionBounds(visibleElements);
    if (!bounds) return;

    const pad = 40;
    const exportWidth = bounds.width + pad * 2;
    const exportHeight = bounds.height + pad * 2;

    // Use roughjs svg generation or html-based SVG
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('width', `${exportWidth}`);
    svg.setAttribute('height', `${exportHeight}`);
    svg.setAttribute('viewBox', `0 0 ${exportWidth} ${exportHeight}`);

    if (withBackground) {
      const rect = document.createElementNS(svgNs, 'rect');
      rect.setAttribute('width', '100%');
      rect.setAttribute('height', '100%');
      rect.setAttribute('fill', exportDark ? '#121214' : '#ffffff');
      svg.appendChild(rect);
    }

    const g = document.createElementNS(svgNs, 'g');
    g.setAttribute('transform', `translate(${-bounds.minX + pad}, ${-bounds.minY + pad})`);

    const roughSvg = rough.svg(svg);
    const sorted = [...visibleElements].sort((a, b) => a.zIndex - b.zIndex);

    for (const el of sorted) {
      const ex = Math.min(el.x, el.x + el.width);
      const ey = Math.min(el.y, el.y + el.height);
      const ew = Math.abs(el.width);
      const eh = Math.abs(el.height);
      const ro: any = {
        seed: el.seed,
        stroke: el.strokeColor,
        strokeWidth: el.strokeWidth,
        roughness: el.roughness,
        fill: el.fillColor !== 'transparent' ? el.fillColor : undefined,
      };

      let node: SVGGElement | null = null;
      if (el.type === 'rectangle') {
        node = roughSvg.rectangle(ex, ey, ew, eh, ro);
      } else if (el.type === 'ellipse') {
        node = roughSvg.ellipse(ex + ew / 2, ey + eh / 2, ew, eh, ro);
      } else if (el.type === 'line' || el.type === 'arrow') {
        node = roughSvg.line(el.x, el.y, el.x + el.width, el.y + el.height, ro);
      } else if (el.type === 'text' && el.text) {
        const textNode = document.createElementNS(svgNs, 'text');
        textNode.setAttribute('x', `${ex}`);
        textNode.setAttribute('y', `${ey + 20}`);
        textNode.setAttribute('fill', el.strokeColor);
        textNode.setAttribute('font-family', 'Caveat, cursive');
        textNode.setAttribute('font-size', `${el.fontSize || 20}px`);
        textNode.textContent = el.text;
        g.appendChild(textNode);
      }

      if (node) g.appendChild(node);
    }

    svg.appendChild(g);

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    onToast('Exported SVG successfully!');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Export Whiteboard</h2>
          <button
            type="button"
            className="icon-btn"
            style={{ width: '28px', height: '28px' }}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={withBackground}
              onChange={(e) => setWithBackground(e.target.checked)}
            />
            Include Background
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={exportDark}
              onChange={(e) => setExportDark(e.target.checked)}
            />
            Dark Theme
          </label>
        </div>

        {/* Export Formats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="button-group-item"
            style={{
              padding: '12px 16px',
              border: '1px solid var(--border-color)',
              justifyContent: 'flex-start',
              gap: '12px',
              fontSize: '14px',
            }}
            onClick={exportPNG}
          >
            <Image size={20} color="#6366f1" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600 }}>Export as PNG</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                High-resolution image for presentations and sharing
              </div>
            </div>
          </button>

          <button
            type="button"
            className="button-group-item"
            style={{
              padding: '12px 16px',
              border: '1px solid var(--border-color)',
              justifyContent: 'flex-start',
              gap: '12px',
              fontSize: '14px',
            }}
            onClick={exportSVG}
          >
            <FileCode size={20} color="#10b981" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600 }}>Export as SVG</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Scalable vector graphic suitable for web & editing
              </div>
            </div>
          </button>

          <button
            type="button"
            className="button-group-item"
            style={{
              padding: '12px 16px',
              border: '1px solid var(--border-color)',
              justifyContent: 'flex-start',
              gap: '12px',
              fontSize: '14px',
            }}
            onClick={exportJSON}
          >
            <FileJson size={20} color="#f59e0b" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600 }}>Export as JSON</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Complete board file backup (can be re-imported anytime)
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

