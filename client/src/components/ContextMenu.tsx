import React, { useEffect, useRef } from 'react';
import {
  Type,
  Square,
  Diamond,
  Circle,
  ArrowRight,
  Copy,
  Trash2,
  BringToFront,
  SendToBack,
  ZoomIn,
  Grid,
  Edit3,
  GitBranch,
} from 'lucide-react';
import { CanvasElement } from 'shared';

export interface ContextMenuState {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  targetElement: CanvasElement | null;
}

interface ContextMenuProps {
  menu: ContextMenuState | null;
  onClose: () => void;
  onAddText: (x: number, y: number) => void;
  onAddFlowchartShape: (type: 'rectangle' | 'diamond' | 'ellipse', text: string, x: number, y: number) => void;
  onEditText: (element: CanvasElement) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReorder: (action: 'front' | 'forward' | 'backward' | 'back') => void;
  onZoomToFit: () => void;
  onToggleGrid: () => void;
  hasSelection: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  menu,
  onClose,
  onAddText,
  onAddFlowchartShape,
  onEditText,
  onDuplicate,
  onDelete,
  onReorder,
  onZoomToFit,
  onToggleGrid,
  hasSelection,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (menu) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  // Keep menu within screen boundaries
  const menuWidth = 220;
  const menuHeight = 320;
  const left = Math.min(menu.x, window.innerWidth - menuWidth - 10);
  const top = Math.min(menu.y, window.innerHeight - menuHeight - 10);

  const isShapeOrText = menu.targetElement && ['rectangle', 'diamond', 'ellipse', 'text'].includes(menu.targetElement.type);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${menuWidth}px`,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-lg)',
        padding: '6px',
        zIndex: 150,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        fontSize: '13px',
        animation: 'fadeIn 0.12s ease-out',
      }}
    >
      {/* If clicked on an element with text capability */}
      {isShapeOrText && (
        <>
          <button
            type="button"
            className="button-group-item"
            style={{ justifyContent: 'flex-start', padding: '7px 10px', gap: '8px', color: '#6366f1', fontWeight: 600 }}
            onClick={() => {
              onEditText(menu.targetElement!);
              onClose();
            }}
          >
            <Edit3 size={15} /> Edit Text
          </button>
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '3px 0' }} />
        </>
      )}

      {/* Insert Options */}
      <button
        type="button"
        className="button-group-item"
        style={{ justifyContent: 'flex-start', padding: '7px 10px', gap: '8px' }}
        onClick={() => {
          onAddText(menu.canvasX, menu.canvasY);
          onClose();
        }}
      >
        <Type size={15} /> Add Text Note
      </button>

      {/* Flowchart Quick Shapes */}
      <div style={{ height: '1px', background: 'var(--border-color)', margin: '3px 0' }} />
      <div style={{ padding: '4px 10px 2px 10px', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
        Flowchart Shapes
      </div>

      <button
        type="button"
        className="button-group-item"
        style={{ justifyContent: 'flex-start', padding: '6px 10px', gap: '8px' }}
        onClick={() => {
          onAddFlowchartShape('rectangle', 'Process', menu.canvasX, menu.canvasY);
          onClose();
        }}
      >
        <Square size={14} color="#6366f1" /> Process Step
      </button>

      <button
        type="button"
        className="button-group-item"
        style={{ justifyContent: 'flex-start', padding: '6px 10px', gap: '8px' }}
        onClick={() => {
          onAddFlowchartShape('diamond', 'Decision?', menu.canvasX, menu.canvasY);
          onClose();
        }}
      >
        <Diamond size={14} color="#f59e0b" /> Decision Node
      </button>

      <button
        type="button"
        className="button-group-item"
        style={{ justifyContent: 'flex-start', padding: '6px 10px', gap: '8px' }}
        onClick={() => {
          onAddFlowchartShape('ellipse', 'Start / End', menu.canvasX, menu.canvasY);
          onClose();
        }}
      >
        <Circle size={14} color="#10b981" /> Start / End
      </button>

      {/* Element Actions if selection active */}
      {hasSelection && (
        <>
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '3px 0' }} />
          <button
            type="button"
            className="button-group-item"
            style={{ justifyContent: 'flex-start', padding: '6px 10px', gap: '8px' }}
            onClick={() => {
              onDuplicate();
              onClose();
            }}
          >
            <Copy size={14} /> Duplicate (Ctrl+D)
          </button>

          <button
            type="button"
            className="button-group-item"
            style={{ justifyContent: 'flex-start', padding: '6px 10px', gap: '8px' }}
            onClick={() => {
              onReorder('front');
              onClose();
            }}
          >
            <BringToFront size={14} /> Bring to Front
          </button>

          <button
            type="button"
            className="button-group-item"
            style={{ justifyContent: 'flex-start', padding: '6px 10px', gap: '8px' }}
            onClick={() => {
              onReorder('back');
              onClose();
            }}
          >
            <SendToBack size={14} /> Send to Back
          </button>

          <button
            type="button"
            className="button-group-item"
            style={{ justifyContent: 'flex-start', padding: '6px 10px', gap: '8px', color: '#e03131' }}
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            <Trash2 size={14} /> Delete (Del)
          </button>
        </>
      )}

      {/* Canvas Utilities */}
      <div style={{ height: '1px', background: 'var(--border-color)', margin: '3px 0' }} />
      <button
        type="button"
        className="button-group-item"
        style={{ justifyContent: 'flex-start', padding: '6px 10px', gap: '8px' }}
        onClick={() => {
          onZoomToFit();
          onClose();
        }}
      >
        <ZoomIn size={14} /> Zoom to Fit
      </button>
      <button
        type="button"
        className="button-group-item"
        style={{ justifyContent: 'flex-start', padding: '6px 10px', gap: '8px' }}
        onClick={() => {
          onToggleGrid();
          onClose();
        }}
      >
        <Grid size={14} /> Toggle Grid
      </button>
    </div>
  );
};
