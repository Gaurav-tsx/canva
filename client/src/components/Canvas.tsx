import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  CanvasElement,
  distance,
  getElementBounds,
  isPointInElement,
  rotatePoint,
  snapToGrid,
  ToolType,
  UserPresence,
} from 'shared';
import { getHandles, Handle, renderScene } from '../engine/renderer';
import { canvasToScreen, screenToCanvas, Viewport } from '../engine/transform';
import { createElement, DEFAULT_STYLES, ElementStyleState } from '../engine/elementUtils';

interface CanvasProps {
  elements: CanvasElement[];
  setElements: React.Dispatch<React.SetStateAction<CanvasElement[]>>;
  viewport: Viewport;
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  isLocked: boolean;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  currentStyles: ElementStyleState;
  userId: string;
  showGrid: boolean;
  snapGrid: boolean;
  isDarkMode: boolean;
  isReadOnly: boolean;
  remoteUsers: UserPresence[];
  onCommitChange: (before: CanvasElement[], after: CanvasElement[]) => void;
  onCursorMove: (x: number | null, y: number | null, isLaser?: boolean) => void;
}

type InteractionMode =
  | 'none'
  | 'panning'
  | 'drawing'
  | 'moving'
  | 'resizing'
  | 'rotating'
  | 'marquee'
  | 'erasing'
  | 'laser';

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  setElements,
  viewport,
  setViewport,
  activeTool,
  setActiveTool,
  isLocked,
  selectedIds,
  setSelectedIds,
  currentStyles,
  userId,
  showGrid,
  snapGrid,
  isDarkMode,
  isReadOnly,
  remoteUsers,
  onCommitChange,
  onCursorMove,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Interaction State
  const [mode, setMode] = useState<InteractionMode>('none');
  const [activeHandle, setActiveHandle] = useState<Handle | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [startViewport, setStartViewport] = useState<Viewport>(viewport);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [laserTrail, setLaserTrail] = useState<{ x: number; y: number; time: number }[]>([]);

  // Text inline editing state
  const [editingText, setEditingText] = useState<{
    elementId: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontFamily: string;
    color: string;
    isNew: boolean;
  } | null>(null);

  // Snapshot before interaction for history
  const beforeSnapshotRef = useRef<CanvasElement[]>([]);
  const isSpacePressedRef = useRef<boolean>(false);

  // Keep elements and selectedIds in refs for event listeners
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  // Track window resize & high-DPI scaling
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Main 60fps render loop
  useEffect(() => {
    let animId: number;
    const render = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        renderScene(
          canvas,
          elements,
          viewport,
          selectedIds,
          remoteUsers,
          {
            showGrid,
            isDarkMode,
            selectionBox,
            laserTrail,
          }
        );
      }
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [elements, viewport, selectedIds, remoteUsers, showGrid, isDarkMode, selectionBox, laserTrail]);

  // Clean old laser trails
  useEffect(() => {
    if (laserTrail.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setLaserTrail((prev) => prev.filter((p) => now - p.time < 1200));
    }, 100);
    return () => clearInterval(interval);
  }, [laserTrail.length]);

  // Keyboard space listener for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'TEXTAREA') {
        isSpacePressedRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editingText) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const screenPos = { x: e.clientX, y: e.clientY };
    const canvasPos = screenToCanvas(e.clientX, e.clientY, viewportRef.current);
    setStartPoint(canvasPos);

    // Pan with spacebar, middle mouse, or Hand tool
    if (e.button === 1 || isSpacePressedRef.current || activeTool === 'hand') {
      setMode('panning');
      setStartPoint(screenPos);
      setStartViewport(viewportRef.current);
      return;
    }

    if (isReadOnly) return;

    // Laser tool
    if (activeTool === 'laser') {
      setMode('laser');
      const point = { x: canvasPos.x, y: canvasPos.y, time: Date.now() };
      setLaserTrail((prev) => [...prev, point]);
      onCursorMove(canvasPos.x, canvasPos.y, true);
      return;
    }

    // Eraser tool
    if (activeTool === 'eraser') {
      setMode('erasing');
      beforeSnapshotRef.current = elementsRef.current;
      eraseAtPoint(canvasPos);
      return;
    }

    // Text tool: click to place text
    if (activeTool === 'text') {
      const newEl = createElement(
        'text',
        canvasPos.x,
        canvasPos.y,
        currentStyles,
        userId,
        { text: '', width: 120, height: 32 }
      );
      beforeSnapshotRef.current = elementsRef.current;
      setElements((prev) => [...prev, newEl]);
      setEditingText({
        elementId: newEl.id,
        text: '',
        x: canvasPos.x,
        y: canvasPos.y,
        width: 160,
        height: 36,
        fontSize: currentStyles.fontSize,
        fontFamily: currentStyles.fontFamily,
        color: currentStyles.strokeColor,
        isNew: true,
      });
      return;
    }

    // Selection tool
    if (activeTool === 'select') {
      beforeSnapshotRef.current = elementsRef.current;

      // 1. Check if clicking on resize / rotate handles
      if (selectedIdsRef.current.length > 0) {
        const selected = elementsRef.current.filter(
          (el) => selectedIdsRef.current.includes(el.id) && !el.isDeleted
        );
        const { getSelectionBounds } = require('shared');
        const bounds = getSelectionBounds(selected);
        if (bounds) {
          const pad = 6;
          const handles = getHandles({
            minX: bounds.minX - pad,
            minY: bounds.minY - pad,
            maxX: bounds.maxX + pad,
            maxY: bounds.maxY + pad,
          });

          for (const h of handles) {
            const hx = h.type === 'rotation' ? (bounds.minX + bounds.maxX) / 2 : h.x + 4;
            const hy = h.type === 'rotation' ? bounds.minY - pad - 24 : h.y + 4;
            if (distance(canvasPos, { x: hx, y: hy }) <= 12 / viewportRef.current.zoom) {
              if (h.type === 'rotation') {
                setMode('rotating');
              } else {
                setMode('resizing');
                setActiveHandle(h);
              }
              return;
            }
          }
        }
      }

      // 2. Check if clicked an element
      const hitElement = [...elementsRef.current]
        .reverse()
        .find((el) => isPointInElement(canvasPos, el));

      if (hitElement) {
        if (e.shiftKey) {
          // Toggle selection with shift
          if (selectedIdsRef.current.includes(hitElement.id)) {
            setSelectedIds((prev) => prev.filter((id) => id !== hitElement.id));
          } else {
            setSelectedIds((prev) => [...prev, hitElement.id]);
          }
        } else {
          // If clicking an unselected element without shift, select only it
          if (!selectedIdsRef.current.includes(hitElement.id)) {
            setSelectedIds([hitElement.id]);
          }
        }
        setMode('moving');
        return;
      }

      // 3. Clicked empty space -> start marquee drag-select
      if (!e.shiftKey) {
        setSelectedIds([]);
      }
      setMode('marquee');
      setSelectionBox({
        startX: canvasPos.x,
        startY: canvasPos.y,
        endX: canvasPos.x,
        endY: canvasPos.y,
      });
      return;
    }

    // Drawing Tools (Rectangle, Ellipse, Diamond, Line, Arrow, Freehand)
    beforeSnapshotRef.current = elementsRef.current;
    let initX = canvasPos.x;
    let initY = canvasPos.y;
    if (snapGrid) {
      initX = snapToGrid(initX);
      initY = snapToGrid(initY);
    }

    const newElement = createElement(
      activeTool as any,
      initX,
      initY,
      currentStyles,
      userId
    );

    setActiveElementId(newElement.id);
    setSelectedIds([newElement.id]);
    setElements((prev) => [...prev, newElement]);
    setMode('drawing');
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvasPos = screenToCanvas(e.clientX, e.clientY, viewportRef.current);
    onCursorMove(canvasPos.x, canvasPos.y, mode === 'laser');

    if (mode === 'panning') {
      const dx = e.clientX - startPoint.x;
      const dy = e.clientY - startPoint.y;
      setViewport({
        ...startViewport,
        scrollX: startViewport.scrollX + dx,
        scrollY: startViewport.scrollY + dy,
      });
      return;
    }

    if (mode === 'laser') {
      const point = { x: canvasPos.x, y: canvasPos.y, time: Date.now() };
      setLaserTrail((prev) => [...prev, point]);
      return;
    }

    if (mode === 'erasing') {
      eraseAtPoint(canvasPos);
      return;
    }

    if (mode === 'marquee') {
      setSelectionBox({
        startX: startPoint.x,
        startY: startPoint.y,
        endX: canvasPos.x,
        endY: canvasPos.y,
      });

      // Find all elements overlapping marquee
      const minX = Math.min(startPoint.x, canvasPos.x);
      const maxX = Math.max(startPoint.x, canvasPos.x);
      const minY = Math.min(startPoint.y, canvasPos.y);
      const maxY = Math.max(startPoint.y, canvasPos.y);

      const inside = elementsRef.current
        .filter((el) => {
          if (el.isDeleted) return false;
          const b = getElementBounds(el);
          return (
            b.maxX >= minX &&
            b.minX <= maxX &&
            b.maxY >= minY &&
            b.minY <= maxY
          );
        })
        .map((el) => el.id);

      setSelectedIds(inside);
      return;
    }

    if (mode === 'drawing' && activeElementId) {
      let curX = canvasPos.x;
      let curY = canvasPos.y;
      if (snapGrid) {
        curX = snapToGrid(curX);
        curY = snapToGrid(curY);
      }

      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== activeElementId) return el;

          if (el.type === 'freedraw') {
            const relX = curX - el.x;
            const relY = curY - el.y;
            return {
              ...el,
              points: [...(el.points || []), [relX, relY] as [number, number]],
              version: el.version + 1,
              versionNonce: Date.now(),
            };
          }

          const width = curX - el.x;
          const height = curY - el.y;
          return {
            ...el,
            width,
            height,
            version: el.version + 1,
            versionNonce: Date.now(),
          };
        })
      );
      return;
    }

    if (mode === 'moving') {
      const dx = canvasPos.x - startPoint.x;
      const dy = canvasPos.y - startPoint.y;

      setElements((prev) =>
        prev.map((el) => {
          if (selectedIdsRef.current.includes(el.id)) {
            return {
              ...el,
              x: el.x + dx,
              y: el.y + dy,
              version: el.version + 1,
              versionNonce: Date.now(),
            };
          }
          return el;
        })
      );
      setStartPoint(canvasPos);
      return;
    }

    if (mode === 'resizing' && activeHandle && selectedIdsRef.current.length > 0) {
      const dx = canvasPos.x - startPoint.x;
      const dy = canvasPos.y - startPoint.y;

      setElements((prev) =>
        prev.map((el) => {
          if (!selectedIdsRef.current.includes(el.id)) return el;

          let newX = el.x;
          let newY = el.y;
          let newW = el.width;
          let newH = el.height;

          switch (activeHandle.type) {
            case 'se':
              newW += dx;
              newH += dy;
              break;
            case 'e':
              newW += dx;
              break;
            case 's':
              newH += dy;
              break;
            case 'nw':
              newX += dx;
              newY += dy;
              newW -= dx;
              newH -= dy;
              break;
            case 'n':
              newY += dy;
              newH -= dy;
              break;
            case 'w':
              newX += dx;
              newW -= dx;
              break;
            case 'ne':
              newY += dy;
              newW += dx;
              newH -= dy;
              break;
            case 'sw':
              newX += dx;
              newW -= dx;
              newH += dy;
              break;
          }

          return {
            ...el,
            x: newX,
            y: newY,
            width: newW,
            height: newH,
            version: el.version + 1,
            versionNonce: Date.now(),
          };
        })
      );
      setStartPoint(canvasPos);
      return;
    }

    if (mode === 'rotating' && selectedIdsRef.current.length > 0) {
      const selected = elementsRef.current.filter((el) => selectedIdsRef.current.includes(el.id));
      const { getSelectionBounds } = require('shared');
      const bounds = getSelectionBounds(selected);
      if (bounds) {
        const cx = bounds.minX + bounds.width / 2;
        const cy = bounds.minY + bounds.height / 2;
        const angle = Math.atan2(canvasPos.y - cy, canvasPos.x - cx) + Math.PI / 2;

        setElements((prev) =>
          prev.map((el) => {
            if (selectedIdsRef.current.includes(el.id)) {
              return {
                ...el,
                angle,
                version: el.version + 1,
                versionNonce: Date.now(),
              };
            }
            return el;
          })
        );
      }
      return;
    }
  };

  // Pointer Up
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (mode === 'drawing' && activeElementId) {
      // Normalize negative width/height
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== activeElementId) return el;
          if (el.type === 'freedraw') return el;

          let x = el.x;
          let y = el.y;
          let width = el.width;
          let height = el.height;

          if (width < 0) {
            x += width;
            width = Math.abs(width);
          }
          if (height < 0) {
            y += height;
            height = Math.abs(height);
          }

          // If tiny zero-size click, assign minimal default size
          if (width === 0 && height === 0) {
            width = 100;
            height = 60;
          }

          return { ...el, x, y, width, height };
        })
      );

      if (!isLocked) {
        setActiveTool('select');
      }
    }

    if (mode === 'drawing' || mode === 'moving' || mode === 'resizing' || mode === 'rotating' || mode === 'erasing') {
      onCommitChange(beforeSnapshotRef.current, elementsRef.current);
    }

    setMode('none');
    setActiveHandle(null);
    setActiveElementId(null);
    setSelectionBox(null);
  };

  // Erase element under point
  const eraseAtPoint = (point: { x: number; y: number }) => {
    const hit = [...elementsRef.current]
      .reverse()
      .find((el) => isPointInElement(point, el));

    if (hit) {
      setElements((prev) =>
        prev.map((el) =>
          el.id === hit.id
            ? {
                ...el,
                isDeleted: true,
                version: el.version + 1,
                versionNonce: Date.now(),
                updatedBy: userId,
              }
            : el
        )
      );
    }
  };

  // Double click on element: edit text or add label to shape!
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvasPos = screenToCanvas(e.clientX, e.clientY, viewportRef.current);
    const hit = [...elementsRef.current]
      .reverse()
      .find((el) => isPointInElement(canvasPos, el));

    if (hit) {
      beforeSnapshotRef.current = elementsRef.current;
      setEditingText({
        elementId: hit.id,
        text: hit.text || '',
        x: hit.x,
        y: hit.y,
        width: Math.max(120, hit.width),
        height: Math.max(40, hit.height),
        fontSize: hit.fontSize || 20,
        fontFamily: hit.fontFamily || 'hand',
        color: hit.strokeColor,
        isNew: false,
      });
    }
  };

  // Finish editing text
  const handleFinishEditingText = (textValue: string) => {
    if (!editingText) return;

    if (textValue.trim() === '') {
      if (editingText.isNew) {
        // Delete empty new text element
        setElements((prev) => prev.filter((el) => el.id !== editingText.elementId));
      }
    } else {
      setElements((prev) =>
        prev.map((el) => {
          if (el.id === editingText.elementId) {
            return {
              ...el,
              text: textValue,
              width: Math.max(100, textValue.length * 12),
              height: Math.max(30, textValue.split('\n').length * 28),
              version: el.version + 1,
              versionNonce: Date.now(),
              updatedBy: userId,
            };
          }
          return el;
        })
      );
    }

    onCommitChange(beforeSnapshotRef.current, elementsRef.current);
    setEditingText(null);
    if (!isLocked) setActiveTool('select');
  };

  // Wheel listener: Zoom with Ctrl/Cmd or trackpad pinch, Pan otherwise
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Zoom centered on cursor
      const zoomFactor = -e.deltaY * 0.002;
      const newZoom = Math.min(3, Math.max(0.1, viewport.zoom * (1 + zoomFactor)));

      // Keep point under cursor stationary
      const cursorX = e.clientX;
      const cursorY = e.clientY;

      const newScrollX = cursorX - (cursorX - viewport.scrollX) * (newZoom / viewport.zoom);
      const newScrollY = cursorY - (cursorY - viewport.scrollY) * (newZoom / viewport.zoom);

      setViewport({
        scrollX: newScrollX,
        scrollY: newScrollY,
        zoom: newZoom,
      });
    } else {
      // Pan
      setViewport((prev) => ({
        ...prev,
        scrollX: prev.scrollX - e.deltaX,
        scrollY: prev.scrollY - e.deltaY,
      }));
    }
  };

  // Calculate textarea position in screen coordinates
  let editScreenPos = { x: 0, y: 0 };
  if (editingText) {
    editScreenPos = canvasToScreen(editingText.x, editingText.y, viewport);
  }

  return (
    <div className="canvas-container">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        style={{
          cursor:
            mode === 'panning'
              ? 'grabbing'
              : activeTool === 'hand' || isSpacePressedRef.current
              ? 'grab'
              : activeTool === 'laser'
              ? 'crosshair'
              : activeTool === 'eraser'
              ? 'cell'
              : activeTool === 'text'
              ? 'text'
              : activeTool !== 'select'
              ? 'crosshair'
              : 'default',
        }}
      />

      {/* Inline Text Editing Textarea */}
      {editingText && (
        <textarea
          autoFocus
          defaultValue={editingText.text}
          onBlur={(e) => handleFinishEditingText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              handleFinishEditingText(e.currentTarget.value);
            }
          }}
          style={{
            position: 'absolute',
            left: `${editScreenPos.x}px`,
            top: `${editScreenPos.y}px`,
            minWidth: `${Math.max(120, editingText.width * viewport.zoom)}px`,
            minHeight: `${Math.max(40, editingText.height * viewport.zoom)}px`,
            fontSize: `${editingText.fontSize * viewport.zoom}px`,
            fontFamily:
              editingText.fontFamily === 'normal'
                ? 'Inter, sans-serif'
                : editingText.fontFamily === 'code'
                ? 'Fira Code, monospace'
                : 'Caveat, Virgil, cursive',
            color: editingText.color,
            background: 'transparent',
            border: '1.5px dashed #6366f1',
            borderRadius: '4px',
            outline: 'none',
            padding: '4px 6px',
            resize: 'both',
            lineHeight: 1.25,
            zIndex: 60,
          }}
        />
      )}
    </div>
  );
};

