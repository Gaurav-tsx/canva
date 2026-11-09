import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  CanvasElement,
  distance,
  getElementBounds,
  getSelectionBounds,
  isPointInElement,
  rotatePoint,
  snapToGrid,
  ToolType,
  UserPresence,
} from 'shared';
import { getHandles, Handle, renderScene } from '../engine/renderer';
import { canvasToScreen, screenToCanvas, Viewport } from '../engine/transform';
import { createElement, DEFAULT_STYLES, ElementStyleState } from '../engine/elementUtils';
import { ContextMenu, ContextMenuState } from './ContextMenu';

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
  setShowGrid: (show: boolean) => void;
  snapGrid: boolean;
  isDarkMode: boolean;
  isReadOnly: boolean;
  remoteUsers: UserPresence[];
  onCommitChange: (before: CanvasElement[], after: CanvasElement[]) => void;
  onCursorMove: (x: number | null, y: number | null, isLaser?: boolean) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReorder: (action: 'front' | 'forward' | 'backward' | 'back') => void;
  onToggleLockSelected?: () => void;
  onZoomToFit: () => void;
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
  setShowGrid,
  snapGrid,
  isDarkMode,
  isReadOnly,
  remoteUsers,
  onCommitChange,
  onCursorMove,
  onDuplicate,
  onDelete,
  onReorder,
  onToggleLockSelected,
  onZoomToFit,
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
  const [textValue, setTextValue] = useState<string>('');
  const textValueRef = useRef<string>('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [hoverCursor, setHoverCursor] = useState<string>('default');

  // Snapshot before interaction for history
  const beforeSnapshotRef = useRef<CanvasElement[]>([]);
  const isSpacePressedRef = useRef<boolean>(false);
  const isFinishingTextRef = useRef<boolean>(false);

  // Keep elements and selectedIds in refs for event listeners
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  // Auto-focus textarea ONLY when a new text session starts (prevents re-triggering on every keystroke)
  const editingElementId = editingText?.elementId;
  useEffect(() => {
    if (editingElementId) {
      const initial = editingText?.text || '';
      setTextValue(initial);
      textValueRef.current = initial;
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [editingElementId]);

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
            editingElementId: editingText?.elementId,
          }
        );
      }
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [elements, viewport, selectedIds, remoteUsers, showGrid, isDarkMode, selectionBox, laserTrail, editingText]);

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
    // If context menu is open, close it
    if (contextMenu) {
      setContextMenu(null);
    }

    // If text editing was active and user clicked elsewhere, finish previous text
    if (editingText) {
      handleFinishEditingText(textValueRef.current);
      return;
    }

    const screenPos = { x: e.clientX, y: e.clientY };
    const canvasPos = screenToCanvas(e.clientX, e.clientY, viewportRef.current);
    setStartPoint(canvasPos);

    // Pan with spacebar, middle mouse, or Hand tool
    if (e.button === 1 || isSpacePressedRef.current || activeTool === 'hand') {
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      setMode('panning');
      setStartPoint(screenPos);
      setStartViewport(viewportRef.current);
      return;
    }

    if (isReadOnly) return;

    // Laser tool
    if (activeTool === 'laser') {
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      setMode('laser');
      const point = { x: canvasPos.x, y: canvasPos.y, time: Date.now() };
      setLaserTrail((prev) => [...prev, point]);
      onCursorMove(canvasPos.x, canvasPos.y, true);
      return;
    }

    // Eraser tool
    if (activeTool === 'eraser') {
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      setMode('erasing');
      beforeSnapshotRef.current = elementsRef.current;
      eraseAtPoint(canvasPos);
      return;
    }

    // Text tool: click to place text (DO NOT call setPointerCapture so textarea gets instant focus)
    if (activeTool === 'text') {
      let initX = canvasPos.x;
      let initY = canvasPos.y;
      if (snapGrid) {
        initX = snapToGrid(initX);
        initY = snapToGrid(initY);
      }

      const newEl = createElement(
        'text',
        initX,
        initY,
        currentStyles,
        userId,
        { text: '', width: 20, height: Math.round(currentStyles.fontSize * 1.3) }
      );
      beforeSnapshotRef.current = elementsRef.current;
      setElements((prev) => [...prev, newEl]);
      setSelectedIds([newEl.id]);
      selectedIdsRef.current = [newEl.id];
      textValueRef.current = '';
      setTextValue('');
      setEditingText({
        elementId: newEl.id,
        text: '',
        x: initX,
        y: initY,
        width: 20,
        height: Math.round(currentStyles.fontSize * 1.3),
        fontSize: currentStyles.fontSize,
        fontFamily: currentStyles.fontFamily,
        color: currentStyles.strokeColor,
        isNew: true,
      });
      return;
    }

    // For selection and shape drawing tools, capture pointer
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    // Selection tool
    if (activeTool === 'select') {
      beforeSnapshotRef.current = elementsRef.current;

      // 1. Check if clicking on resize / rotate handles
      if (selectedIdsRef.current.length > 0) {
        const selected = elementsRef.current.filter(
          (el) => selectedIdsRef.current.includes(el.id) && !el.isDeleted
        );
        const bounds = getSelectionBounds(selected);
        if (bounds) {
          const pad = 6;
          const isElementLocked = selected.every((el) => el.isLocked);

          // If elements are NOT locked, allow resizing, rotating, and moving
          if (!isElementLocked) {
            const handles = getHandles({
              minX: bounds.minX - pad,
              minY: bounds.minY - pad,
              maxX: bounds.maxX + pad,
              maxY: bounds.maxY + pad,
            }, viewportRef.current.zoom);

            for (const h of handles) {
              if (distance(canvasPos, { x: h.x, y: h.y }) <= 16 / viewportRef.current.zoom) {
                if (h.type === 'rotation') {
                  setMode('rotating');
                } else {
                  setMode('resizing');
                  setActiveHandle(h);
                }
                return;
              }
            }

            // 1b. If clicking INSIDE current selection bounds (without Shift), start moving selection!
            if (
              !e.shiftKey &&
              canvasPos.x >= bounds.minX - pad &&
              canvasPos.x <= bounds.maxX + pad &&
              canvasPos.y >= bounds.minY - pad &&
              canvasPos.y <= bounds.maxY + pad
            ) {
              setMode('moving');
              return;
            }
          } else {
            // Selected element is locked in place!
            if (
              !e.shiftKey &&
              canvasPos.x >= bounds.minX - pad &&
              canvasPos.x <= bounds.maxX + pad &&
              canvasPos.y >= bounds.minY - pad &&
              canvasPos.y <= bounds.maxY + pad
            ) {
              // Clicking inside keeps it selected without dragging/moving
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
            const next = selectedIdsRef.current.filter((id) => id !== hitElement.id);
            setSelectedIds(next);
            selectedIdsRef.current = next;
          } else {
            const next = [...selectedIdsRef.current, hitElement.id];
            setSelectedIds(next);
            selectedIdsRef.current = next;
          }
        } else {
          // If clicking an unselected element without shift, select only it
          if (!selectedIdsRef.current.includes(hitElement.id)) {
            setSelectedIds([hitElement.id]);
            selectedIdsRef.current = [hitElement.id];
          }
        }
        if (!hitElement.isLocked) {
          setMode('moving');
        }
        return;
      }

      // 3. Clicked empty space -> start marquee drag-select
      if (!e.shiftKey) {
        setSelectedIds([]);
        selectedIdsRef.current = [];
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

    // Handle cursor hover states when in selection mode
    if (mode === 'none' && activeTool === 'select') {
      if (selectedIdsRef.current.length > 0) {
        const selected = elementsRef.current.filter(
          (el) => selectedIdsRef.current.includes(el.id) && !el.isDeleted
        );
        const bounds = getSelectionBounds(selected);
        if (bounds) {
          const pad = 6;
          const isElementLocked = selected.every((el) => el.isLocked);

          if (isElementLocked) {
            if (
              canvasPos.x >= bounds.minX - pad &&
              canvasPos.x <= bounds.maxX + pad &&
              canvasPos.y >= bounds.minY - pad &&
              canvasPos.y <= bounds.maxY + pad
            ) {
              setHoverCursor('not-allowed');
              return;
            }
          } else {
            const handles = getHandles({
              minX: bounds.minX - pad,
              minY: bounds.minY - pad,
              maxX: bounds.maxX + pad,
              maxY: bounds.maxY + pad,
            }, viewportRef.current.zoom);

            let foundHandle: Handle | null = null;
            for (const h of handles) {
              if (distance(canvasPos, { x: h.x, y: h.y }) <= 16 / viewportRef.current.zoom) {
                foundHandle = h;
                break;
              }
            }

            if (foundHandle) {
              if (foundHandle.type === 'nw' || foundHandle.type === 'se') {
                setHoverCursor('nwse-resize');
              } else if (foundHandle.type === 'ne' || foundHandle.type === 'sw') {
                setHoverCursor('nesw-resize');
              } else if (foundHandle.type === 'n' || foundHandle.type === 's') {
                setHoverCursor('ns-resize');
              } else if (foundHandle.type === 'e' || foundHandle.type === 'w') {
                setHoverCursor('ew-resize');
              } else if (foundHandle.type === 'rotation') {
                setHoverCursor('grab');
              }
              return;
            }

            if (
              canvasPos.x >= bounds.minX - pad &&
              canvasPos.x <= bounds.maxX + pad &&
              canvasPos.y >= bounds.minY - pad &&
              canvasPos.y <= bounds.maxY + pad
            ) {
              setHoverCursor('move');
              return;
            }
          }
        }
      }

      const hit = elementsRef.current.some((el) => isPointInElement(canvasPos, el));
      if (hit) {
        setHoverCursor('move');
        return;
      }

      setHoverCursor('default');
    }

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
            if (el.isLocked) return el;
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
          if (el.isLocked) return el;

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

          // If text element, handle width/height boundaries and scale font size on corner/vertical drag
          let fontSize = el.fontSize;
          if (el.type === 'text') {
            const minHeight = 24;
            if (newH < minHeight) newH = minHeight;
            if (newW < 40) newW = 40;
            if (['nw', 'ne', 'se', 'sw', 'n', 's'].includes(activeHandle.type)) {
              fontSize = Math.max(12, Math.min(96, Math.round(newH * 0.6)));
            }
          }

          return {
            ...el,
            x: newX,
            y: newY,
            width: newW,
            height: newH,
            fontSize,
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
      if (selected.every((el) => el.isLocked)) return;
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
    try {
      if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {}

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

    if (mode === 'resizing') {
      setElements((prev) =>
        prev.map((el) => {
          if (!selectedIdsRef.current.includes(el.id)) return el;
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
          return { ...el, x, y, width, height };
        })
      );
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

  // Double click: switch to selection mode if in text tool; edit text/label if element clicked
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // If currently in Text tool, double click switches back to Selection mode (V)
    if (activeTool === 'text') {
      setActiveTool('select');
      return;
    }

    const canvasPos = screenToCanvas(e.clientX, e.clientY, viewportRef.current);
    const hit = [...elementsRef.current]
      .reverse()
      .find((el) => isPointInElement(canvasPos, el));

    if (hit) {
      handleStartEditText(hit);
    }
  };

  // Right-click context menu
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (editingText) {
      handleFinishEditingText(textValueRef.current);
    }

    const canvasPos = screenToCanvas(e.clientX, e.clientY, viewportRef.current);
    const hit = [...elementsRef.current]
      .reverse()
      .find((el) => isPointInElement(canvasPos, el)) || null;

    if (hit) {
      if (!selectedIdsRef.current.includes(hit.id)) {
        setSelectedIds([hit.id]);
      }
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      canvasX: canvasPos.x,
      canvasY: canvasPos.y,
      targetElement: hit,
    });
  };

  const handleAddTextAt = (x: number, y: number) => {
    const newEl = createElement(
      'text',
      x,
      y,
      currentStyles,
      userId,
      { text: '', width: 20, height: Math.round(currentStyles.fontSize * 1.3) }
    );
    beforeSnapshotRef.current = elementsRef.current;
    setElements((prev) => [...prev, newEl]);
    setSelectedIds([newEl.id]);
    selectedIdsRef.current = [newEl.id];
    textValueRef.current = '';
    setTextValue('');
    setEditingText({
      elementId: newEl.id,
      text: '',
      x,
      y,
      width: 20,
      height: Math.round(currentStyles.fontSize * 1.3),
      fontSize: currentStyles.fontSize,
      fontFamily: currentStyles.fontFamily,
      color: currentStyles.strokeColor,
      isNew: true,
    });
  };

  const handleAddFlowchartShape = (
    type: 'rectangle' | 'diamond' | 'ellipse',
    labelText: string,
    x: number,
    y: number
  ) => {
    const width = type === 'diamond' ? 140 : type === 'ellipse' ? 130 : 150;
    const height = type === 'diamond' ? 100 : type === 'ellipse' ? 60 : 70;

    const fillColors = {
      rectangle: '#a5d8ff',
      diamond: '#ffec99',
      ellipse: '#b2f2bb',
    };
    const strokeColors = {
      rectangle: '#1971c2',
      diamond: '#f08c00',
      ellipse: '#2f9e44',
    };

    const newEl = createElement(
      type,
      x - width / 2,
      y - height / 2,
      {
        ...currentStyles,
        fillStyle: 'hachure',
        fillColor: fillColors[type],
        strokeColor: strokeColors[type],
      },
      userId,
      {
        width,
        height,
        text: labelText,
      }
    );

    const before = elementsRef.current;
    const after = [...before, newEl];
    setElements(after);
    setSelectedIds([newEl.id]);
    onCommitChange(before, after);
  };

  const handleAddFlowchartTemplate = (cx: number, cy: number) => {
    const startX = cx - 70;
    const startY = cy - 140;

    const startNode = createElement(
      'ellipse',
      startX,
      startY,
      { ...currentStyles, fillStyle: 'hachure', fillColor: '#b2f2bb', strokeColor: '#2f9e44' },
      userId,
      { width: 140, height: 60, text: 'Start' }
    );

    const arrow1 = createElement(
      'arrow',
      startX + 70,
      startY + 60,
      { ...currentStyles, strokeColor: '#1e1e1e', strokeWidth: 2 },
      userId,
      { width: 0, height: 50 }
    );

    const processNode = createElement(
      'rectangle',
      startX - 10,
      startY + 110,
      { ...currentStyles, fillStyle: 'hachure', fillColor: '#a5d8ff', strokeColor: '#1971c2' },
      userId,
      { width: 160, height: 70, text: 'Process Step' }
    );

    const arrow2 = createElement(
      'arrow',
      startX + 70,
      startY + 180,
      { ...currentStyles, strokeColor: '#1e1e1e', strokeWidth: 2 },
      userId,
      { width: 0, height: 50 }
    );

    const decisionNode = createElement(
      'diamond',
      startX - 15,
      startY + 230,
      { ...currentStyles, fillStyle: 'hachure', fillColor: '#ffec99', strokeColor: '#f08c00' },
      userId,
      { width: 170, height: 90, text: 'Is Valid?' }
    );

    const arrow3 = createElement(
      'arrow',
      startX + 70,
      startY + 320,
      { ...currentStyles, strokeColor: '#1e1e1e', strokeWidth: 2 },
      userId,
      { width: 0, height: 50 }
    );

    const endNode = createElement(
      'ellipse',
      startX,
      startY + 370,
      { ...currentStyles, fillStyle: 'hachure', fillColor: '#b2f2bb', strokeColor: '#2f9e44' },
      userId,
      { width: 140, height: 60, text: 'End' }
    );

    const newItems = [startNode, arrow1, processNode, arrow2, decisionNode, arrow3, endNode];
    const before = elementsRef.current;
    const after = [...before, ...newItems];
    setElements(after);
    setSelectedIds(newItems.map((n) => n.id));
    onCommitChange(before, after);
  };

  const handleStartEditText = (target: CanvasElement) => {
    beforeSnapshotRef.current = elementsRef.current;
    const initial = target.text || '';
    textValueRef.current = initial;
    setTextValue(initial);
    setEditingText({
      elementId: target.id,
      text: initial,
      x: target.x,
      y: target.y,
      width: Math.max(140, target.width),
      height: Math.max(40, target.height),
      fontSize: target.fontSize || 20,
      fontFamily: target.fontFamily || 'hand',
      color: target.strokeColor,
      isNew: false,
    });
  };

  // Finish editing text
  const handleFinishEditingText = (finalText: string) => {
    if (!editingText || isFinishingTextRef.current) return;
    isFinishingTextRef.current = true;

    const trimmed = (finalText || '').trim();
    if (trimmed === '') {
      if (editingText.isNew) {
        // Delete empty new text element
        setElements((prev) => prev.filter((el) => el.id !== editingText.elementId));
      }
    } else {
      const lines = finalText.split('\n');
      const maxLineLen = Math.max(...lines.map((l) => l.length), 1);
      const fs = editingText.fontSize || 20;
      const width = Math.max(60, maxLineLen * (fs * 0.6) + 16);
      const height = Math.max(28, lines.length * (fs * 1.3));

      setElements((prev) =>
        prev.map((el) => {
          if (el.id === editingText.elementId) {
            return {
              ...el,
              text: finalText,
              width,
              height,
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
    const finishedId = editingText.elementId;
    setEditingText(null);
    setTextValue('');
    textValueRef.current = '';
    if (!isLocked && activeTool !== 'text') {
      setActiveTool('select');
    }
    if (trimmed !== '') {
      setSelectedIds([finishedId]);
      selectedIdsRef.current = [finishedId];
    } else {
      setSelectedIds([]);
      selectedIdsRef.current = [];
    }
    setTimeout(() => {
      isFinishingTextRef.current = false;
    }, 150);
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
    <div className="canvas-container" onContextMenu={handleContextMenu}>
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
              : mode === 'moving'
              ? 'move'
              : mode === 'resizing' && activeHandle
              ? activeHandle.type === 'nw' || activeHandle.type === 'se'
                ? 'nwse-resize'
                : activeHandle.type === 'ne' || activeHandle.type === 'sw'
                ? 'nesw-resize'
                : activeHandle.type === 'n' || activeHandle.type === 's'
                ? 'ns-resize'
                : 'ew-resize'
              : mode === 'rotating'
              ? 'grabbing'
              : activeTool === 'laser'
              ? 'crosshair'
              : activeTool === 'eraser'
              ? 'cell'
              : activeTool === 'text'
              ? 'text'
              : activeTool === 'select'
              ? hoverCursor
              : 'crosshair',
        }}
      />

      {/* Seamless Direct Inline Textarea */}
      {editingText && (
        <textarea
          ref={textareaRef}
          value={textValue}
          autoFocus
          spellCheck={false}
          onChange={(e) => {
            const val = e.target.value;
            setTextValue(val);
            textValueRef.current = val;

            // Live update canvas element so text appears in real time
            if (editingText) {
              const lines = val.split('\n');
              const maxLine = Math.max(...lines.map((l) => l.length), 1);
              const fs = editingText.fontSize;
              const w = Math.max(20, maxLine * (fs * 0.6));
              const h = Math.max(fs * 1.3, lines.length * (fs * 1.25));

              setElements((prev) =>
                prev.map((el) => {
                  if (el.id === editingText.elementId) {
                    return {
                      ...el,
                      text: val,
                      width: w,
                      height: h,
                      version: el.version + 1,
                      versionNonce: Date.now(),
                      updatedBy: userId,
                    };
                  }
                  return el;
                })
              );
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation(); // Stops global shortcuts from intercepting typing
            if (e.key === 'Escape') {
              handleFinishEditingText(textValueRef.current);
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              handleFinishEditingText(textValueRef.current);
            }
          }}
          onBlur={() => {
            handleFinishEditingText(textValueRef.current);
          }}
          style={{
            position: 'absolute',
            left: `${editScreenPos.x}px`,
            top: `${editScreenPos.y}px`,
            minWidth: '24px',
            width: `${Math.max(
              30,
              Math.max(...(textValue || ' ').split('\n').map((l) => l.length)) *
                (editingText.fontSize * viewport.zoom * 0.6) +
                24
            )}px`,
            height: `${Math.max(
              editingText.fontSize * viewport.zoom * 1.3,
              (textValue || ' ').split('\n').length * (editingText.fontSize * viewport.zoom * 1.25) + 6
            )}px`,
            fontSize: `${editingText.fontSize * viewport.zoom}px`,
            fontFamily:
              editingText.fontFamily === 'normal'
                ? 'Inter, sans-serif'
                : editingText.fontFamily === 'code'
                ? 'Fira Code, monospace'
                : 'Caveat, Virgil, cursive',
            color: editingText.color,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            padding: 0,
            margin: 0,
            resize: 'none',
            lineHeight: 1.25,
            zIndex: 100,
            caretColor: editingText.color || '#6366f1',
            whiteSpace: 'pre',
            overflow: 'hidden',
          }}
        />
      )}

      {/* Right-Click Context Menu */}
      <ContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onAddText={handleAddTextAt}
        onAddFlowchartShape={handleAddFlowchartShape}
        onAddFlowchartTemplate={handleAddFlowchartTemplate}
        onEditText={handleStartEditText}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onReorder={onReorder}
        onToggleLock={onToggleLockSelected}
        isLocked={elements.find((el) => selectedIds.includes(el.id))?.isLocked}
        onZoomToFit={onZoomToFit}
        onToggleGrid={() => setShowGrid(!showGrid)}
        hasSelection={selectedIds.length > 0}
      />
    </div>
  );
};

