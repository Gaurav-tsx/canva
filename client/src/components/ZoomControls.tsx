import React from 'react';
import { ZoomIn, ZoomOut, Undo2, Redo2, Grid, Maximize } from 'lucide-react';
import { Viewport } from '../engine/transform';

interface ZoomControlsProps {
  viewport: Viewport;
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  onZoomToFit: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  viewport,
  setViewport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  showGrid,
  setShowGrid,
  onZoomToFit,
}) => {
  const handleZoomIn = () => {
    setViewport((prev) => ({
      ...prev,
      zoom: Math.min(3, Math.round((prev.zoom + 0.1) * 10) / 10),
    }));
  };

  const handleZoomOut = () => {
    setViewport((prev) => ({
      ...prev,
      zoom: Math.max(0.1, Math.round((prev.zoom - 0.1) * 10) / 10),
    }));
  };

  const handleResetZoom = () => {
    setViewport((prev) => ({
      ...prev,
      zoom: 1,
    }));
  };

  return (
    <div className="bottom-left-controls" role="group" aria-label="Canvas zoom and history controls">
      <button
        type="button"
        className="tool-button"
        style={{ width: '30px', height: '30px' }}
        onClick={handleZoomOut}
        title="Zoom Out (Ctrl+-)"
        aria-label="Zoom Out"
      >
        <ZoomOut size={16} />
      </button>

      <button
        type="button"
        className="tool-button"
        style={{ width: '50px', height: '30px', fontSize: '11px', fontWeight: 600 }}
        onClick={handleResetZoom}
        title="Reset Zoom (Ctrl+0)"
        aria-label="Reset Zoom"
      >
        {Math.round(viewport.zoom * 100)}%
      </button>

      <button
        type="button"
        className="tool-button"
        style={{ width: '30px', height: '30px' }}
        onClick={handleZoomIn}
        title="Zoom In (Ctrl++)"
        aria-label="Zoom In"
      >
        <ZoomIn size={16} />
      </button>

      <button
        type="button"
        className="tool-button"
        style={{ width: '30px', height: '30px' }}
        onClick={onZoomToFit}
        title="Zoom to Fit (Shift+1)"
        aria-label="Zoom to Fit"
      >
        <Maximize size={16} />
      </button>

      <div className="toolbar-divider" style={{ height: '16px', margin: '0 2px' }} />

      <button
        type="button"
        className="tool-button"
        style={{ width: '30px', height: '30px', opacity: canUndo ? 1 : 0.4 }}
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <Undo2 size={16} />
      </button>

      <button
        type="button"
        className="tool-button"
        style={{ width: '30px', height: '30px', opacity: canRedo ? 1 : 0.4 }}
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        <Redo2 size={16} />
      </button>

      <div className="toolbar-divider" style={{ height: '16px', margin: '0 2px' }} />

      <button
        type="button"
        className={`tool-button ${showGrid ? 'active' : ''}`}
        style={{ width: '30px', height: '30px' }}
        onClick={() => setShowGrid(!showGrid)}
        title="Toggle Grid (Ctrl+')"
        aria-label="Toggle Grid"
      >
        <Grid size={16} />
      </button>
    </div>
  );
};

