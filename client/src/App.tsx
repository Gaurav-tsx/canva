import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CanvasElement,
  generateId,
  generateRandomColor,
  generateRandomName,
  getElementBounds,
  getSelectionBounds,
  shouldOverwriteElement,
  ToolType,
  UserPresence,
  WSChatMessage,
} from 'shared';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { StylePanel } from './components/StylePanel';
import { Header } from './components/Header';
import { ZoomControls } from './components/ZoomControls';
import { ShareModal } from './components/ShareModal';
import { ExportModal } from './components/ExportModal';
import { ChatDrawer } from './components/ChatDrawer';
import { CursorOverlay } from './components/CursorOverlay';
import { ReactionOverlay, FloatingReactionItem } from './components/ReactionOverlay';
import { Toast, ToastMessage } from './components/Toast';
import { HelpModal } from './components/HelpModal';
import { ClearConfirmModal } from './components/ClearConfirmModal';
import { ConnectionStatus } from './components/ConnectionStatus';
import { FollowBanner } from './components/FollowBanner';
import { Viewport } from './engine/transform';
import {
  createElement,
  DEFAULT_STYLES,
  deleteElements,
  duplicateElements,
  ElementStyleState,
  reorderElements,
} from './engine/elementUtils';
import { HistoryManager } from './engine/history';
import { CollaborativeSocket } from './engine/socketClient';

export const App: React.FC = () => {
  // 1. URL & Room Routing
  const [roomId, setRoomId] = useState<string>('');
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/view/')) {
      const id = path.replace('/view/', '');
      setRoomId(id);
      setIsReadOnly(true);
    } else if (path.startsWith('/board/')) {
      const id = path.replace('/board/', '');
      setRoomId(id);
      setIsReadOnly(false);
    } else {
      // Visiting "/" -> create new unguessable room ID and redirect to /board/:roomId
      const newRoomId = generateId(11);
      window.history.replaceState(null, '', `/board/${newRoomId}`);
      setRoomId(newRoomId);
      setIsReadOnly(false);
    }
  }, []);

  // 2. User Profile (Name & Color)
  const [userId] = useState<string>(() => {
    const saved = localStorage.getItem('whiteboard_user_id');
    if (saved) return saved;
    const newId = generateId(10);
    localStorage.setItem('whiteboard_user_id', newId);
    return newId;
  });

  const [userName, setUserName] = useState<string>(() => {
    const saved = localStorage.getItem('whiteboard_user_name');
    if (saved) return saved;
    const newName = generateRandomName();
    localStorage.setItem('whiteboard_user_name', newName);
    return newName;
  });

  const [userColor] = useState<string>(() => {
    const saved = localStorage.getItem('whiteboard_user_color');
    if (saved) return saved;
    const newColor = generateRandomColor();
    localStorage.setItem('whiteboard_user_color', newColor);
    return newColor;
  });

  // 3. Canvas State
  const [elements, setElements] = useState<CanvasElement[]>(() => {
    // Try localStorage backup first
    if (typeof window !== 'undefined' && roomId) {
      const saved = localStorage.getItem(`whiteboard_elements_${roomId}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return [];
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [snapGrid, setSnapGrid] = useState<boolean>(false);
  const [currentStyles, setCurrentStyles] = useState<ElementStyleState>(DEFAULT_STYLES);

  const [viewport, setViewport] = useState<Viewport>({
    scrollX: window.innerWidth / 2 - 200,
    scrollY: window.innerHeight / 2 - 200,
    zoom: 1,
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('whiteboard_dark_mode') === 'true';
  });

  // 4. Collaboration State
  const [remoteUsers, setRemoteUsers] = useState<UserPresence[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [queuedChangesCount, setQueuedChangesCount] = useState<number>(0);
  const [chatMessages, setChatMessages] = useState<WSChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [reactions, setReactions] = useState<FloatingReactionItem[]>([]);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);

  // 5. Modals & Toasts
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Refs for history, clipboard and socket
  const historyRef = useRef<HistoryManager>(new HistoryManager());
  const socketRef = useRef<CollaborativeSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const addToast = useCallback((text: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  // Sync dark mode class on body
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    localStorage.setItem('whiteboard_dark_mode', isDarkMode ? 'true' : 'false');
  }, [isDarkMode]);

  // Fallback auto-save to localStorage
  useEffect(() => {
    if (roomId && elements.length > 0) {
      try {
        localStorage.setItem(`whiteboard_elements_${roomId}`, JSON.stringify(elements));
      } catch {}
    }
  }, [roomId, elements]);

  // Connect WebSocket when roomId is ready
  useEffect(() => {
    if (!roomId) return;

    const socket = new CollaborativeSocket(
      roomId,
      userId,
      userName,
      userColor,
      isReadOnly,
      {
        onSyncFull: (serverElements, users, readOnly) => {
          setIsReadOnly(readOnly);
          setRemoteUsers(users.filter((u) => u.userId !== userId));
          setElements((prev) => {
            const map = new Map<string, CanvasElement>();
            for (const el of serverElements) {
              map.set(el.id, el);
            }
            // Retain any pending local newer elements
            for (const el of prev) {
              const existing = map.get(el.id);
              if (!existing || el.version > existing.version) {
                map.set(el.id, el);
              }
            }
            return Array.from(map.values());
          });
        },
        onElementUpdate: (incomingElements) => {
          setElements((prev) => {
            const map = new Map<string, CanvasElement>(prev.map((e) => [e.id, e]));
            let changed = false;

            for (const incoming of incomingElements) {
              const existing = map.get(incoming.id);
              if (shouldOverwriteElement(incoming, existing)) {
                map.set(incoming.id, incoming);
                changed = true;
              }
            }

            return changed ? Array.from(map.values()) : prev;
          });
        },
        onCursorMove: (remoteUserId, x, y, selectedElementIds, isLaser, laserPoints, remoteViewport) => {
          setRemoteUsers((prev) => {
            const existing = prev.find((u) => u.userId === remoteUserId);
            if (!existing) return prev;
            return prev.map((u) =>
              u.userId === remoteUserId
                ? {
                    ...u,
                    cursor: x !== null && y !== null ? { x, y } : null,
                    selectedElementIds,
                    isLaser,
                    laserPoints: laserPoints || (u.laserPoints || []),
                    viewport: remoteViewport || u.viewport,
                    lastActive: Date.now(),
                  }
                : u
            );
          });

          // If following this user, smoothly align viewport
          if (followingUserId === remoteUserId && remoteViewport) {
            setViewport(remoteViewport);
          }
        },
        onReaction: (reaction) => {
          setReactions((prev) => [...prev, reaction]);
          setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
          }, 1600);
        },
        onChatMessage: (message) => {
          setChatMessages((prev) => [...prev, message]);
          if (!isChatOpen) {
            setUnreadChatCount((prev) => prev + 1);
          }
        },
        onUserJoined: (newUser) => {
          if (newUser.userId !== userId) {
            setRemoteUsers((prev) => {
              const filtered = prev.filter((u) => u.userId !== newUser.userId);
              return [...filtered, newUser];
            });
            addToast(`${newUser.userName} joined`);
          }
        },
        onUserLeft: (leftUserId) => {
          setRemoteUsers((prev) => {
            const user = prev.find((u) => u.userId === leftUserId);
            if (user) addToast(`${user.userName} left`);
            return prev.filter((u) => u.userId !== leftUserId);
          });
          if (followingUserId === leftUserId) {
            setFollowingUserId(null);
          }
        },
        onClearBoard: () => {
          setElements([]);
          setSelectedIds([]);
          historyRef.current.clear();
          addToast('Board was cleared by a participant');
        },
        onStatusChange: (status) => {
          setConnectionStatus(status);
        },
        onQueuedCountChange: (count) => {
          setQueuedChangesCount(count);
        },
      }
    );

    socketRef.current = socket;
    return () => {
      socket.disconnect();
    };
  }, [roomId, userId, userName, userColor, isReadOnly, addToast, followingUserId, isChatOpen]);

  // Update user name in localStorage & WebSocket
  const handleUpdateUserName = (newName: string) => {
    setUserName(newName);
    localStorage.setItem('whiteboard_user_name', newName);
    socketRef.current?.updateUserInfo(newName);
    addToast(`Name changed to ${newName}`);
  };

  // Commit changes from Canvas to History and Broadcast via WebSocket
  const handleCommitChange = useCallback(
    (before: CanvasElement[], after: CanvasElement[]) => {
      historyRef.current.record(before, after);

      // Find modified elements
      const changed = after.filter((el) => {
        const b = before.find((prev) => prev.id === el.id);
        return !b || JSON.stringify(b) !== JSON.stringify(el);
      });

      if (changed.length > 0) {
        socketRef.current?.sendElementUpdate(changed);
      }
    },
    []
  );

  // Send cursor move
  const handleCursorMove = useCallback(
    (x: number | null, y: number | null, isLaser: boolean = false) => {
      socketRef.current?.sendCursorMove(
        x,
        y,
        selectedIds,
        isLaser,
        undefined,
        viewportRef.current
      );
    },
    [selectedIds]
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (isReadOnly) return;
    const updated = historyRef.current.undo(elementsRef.current, userId);
    if (updated) {
      setElements(updated);
      socketRef.current?.sendElementUpdate(updated);
    }
  }, [isReadOnly, userId]);

  const handleRedo = useCallback(() => {
    if (isReadOnly) return;
    const updated = historyRef.current.redo(elementsRef.current, userId);
    if (updated) {
      setElements(updated);
      socketRef.current?.sendElementUpdate(updated);
    }
  }, [isReadOnly, userId]);

  // Duplicate Selected Elements
  const handleDuplicate = useCallback(() => {
    if (isReadOnly || selectedIds.length === 0) return;
    const before = elementsRef.current;
    const { newElements, newSelectedIds } = duplicateElements(before, selectedIds, userId);
    setElements(newElements);
    setSelectedIds(newSelectedIds);
    handleCommitChange(before, newElements);
    addToast('Elements duplicated');
  }, [isReadOnly, selectedIds, userId, handleCommitChange, addToast]);

  // Delete Selected Elements
  const handleDelete = useCallback(() => {
    if (isReadOnly || selectedIds.length === 0) return;
    const before = elementsRef.current;
    const after = deleteElements(before, selectedIds, userId);
    setElements(after);
    setSelectedIds([]);
    handleCommitChange(before, after);
    addToast('Deleted selection');
  }, [isReadOnly, selectedIds, userId, handleCommitChange, addToast]);

  // Reorder Elements (Bring to front / Send to back)
  const handleReorder = useCallback(
    (action: 'front' | 'forward' | 'backward' | 'back') => {
      if (isReadOnly || selectedIds.length === 0) return;
      const before = elementsRef.current;
      const after = reorderElements(before, selectedIds, action);
      setElements(after);
      handleCommitChange(before, after);
    },
    [isReadOnly, selectedIds, handleCommitChange]
  );

  // Clear Canvas
  const handleClearConfirm = useCallback(() => {
    if (isReadOnly) return;
    const before = elementsRef.current;
    const after = before.map((el) => ({
      ...el,
      isDeleted: true,
      version: el.version + 1,
      versionNonce: Date.now(),
      updatedBy: userId,
    }));
    setElements([]);
    setSelectedIds([]);
    handleCommitChange(before, after);
    socketRef.current?.sendClearBoard();
    addToast('Canvas cleared');
  }, [isReadOnly, userId, handleCommitChange, addToast]);

  // Change Style for Selection or Default
  const handleChangeStyle = useCallback(
    (updates: Partial<ElementStyleState>) => {
      setCurrentStyles((prev) => ({ ...prev, ...updates }));

      if (selectedIds.length > 0 && !isReadOnly) {
        const before = elementsRef.current;
        const after = before.map((el) => {
          if (selectedIds.includes(el.id)) {
            return {
              ...el,
              ...updates,
              version: el.version + 1,
              versionNonce: Date.now(),
              updatedBy: userId,
            };
          }
          return el;
        });
        setElements(after);
        handleCommitChange(before, after);
      }
    },
    [selectedIds, isReadOnly, userId, handleCommitChange]
  );

  // Zoom to Fit
  const handleZoomToFit = useCallback(() => {
    const visible = elementsRef.current.filter((e) => !e.isDeleted);
    if (visible.length === 0) {
      setViewport({
        scrollX: window.innerWidth / 2 - 200,
        scrollY: window.innerHeight / 2 - 200,
        zoom: 1,
      });
      return;
    }

    const bounds = getSelectionBounds(visible);
    if (!bounds) return;

    const pad = 80;
    const scaleX = (window.innerWidth - pad * 2) / bounds.width;
    const scaleY = (window.innerHeight - pad * 2) / bounds.height;
    const zoom = Math.min(1.5, Math.max(0.2, Math.min(scaleX, scaleY)));

    const scrollX = window.innerWidth / 2 - (bounds.minX + bounds.width / 2) * zoom;
    const scrollY = window.innerHeight / 2 - (bounds.minY + bounds.height / 2) * zoom;

    setViewport({ scrollX, scrollY, zoom });
  }, []);

  // Image Upload File Handler
  const handleImageFile = useCallback(
    (file: File) => {
      if (isReadOnly) return;
      if (!file.type.startsWith('image/')) {
        addToast('Please select an image file');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        addToast('Image too large (max 2MB)');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDim = 500;
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = (h / w) * maxDim;
              w = maxDim;
            } else {
              w = (w / h) * maxDim;
              h = maxDim;
            }
          }

          const cx = -viewportRef.current.scrollX / viewportRef.current.zoom + window.innerWidth / (2 * viewportRef.current.zoom) - w / 2;
          const cy = -viewportRef.current.scrollY / viewportRef.current.zoom + window.innerHeight / (2 * viewportRef.current.zoom) - h / 2;

          const newElement = createElement('image', cx, cy, currentStyles, userId, {
            width: w,
            height: h,
            imageUrl: dataUrl,
          });

          const before = elementsRef.current;
          const after = [...before, newElement];
          setElements(after);
          setSelectedIds([newElement.id]);
          handleCommitChange(before, after);
          addToast('Image inserted');
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [isReadOnly, currentStyles, userId, handleCommitChange, addToast]
  );

  // Paste Listener (Images & Elements)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isReadOnly) return;
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
        return;
      }

      if (e.clipboardData?.items) {
        for (const item of e.clipboardData.items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              handleImageFile(file);
              return;
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isReadOnly, handleImageFile]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (isCtrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicate();
        return;
      }

      if (isCtrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(
          elementsRef.current.filter((el) => !el.isDeleted).map((el) => el.id)
        );
        return;
      }

      if (isCtrl && e.key === "'") {
        e.preventDefault();
        setShowGrid((prev) => !prev);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
        return;
      }

      // Single-key Tool Shortcuts
      switch (e.key.toLowerCase()) {
        case 'v':
        case '1':
          setActiveTool('select');
          break;
        case 'h':
          setActiveTool('hand');
          break;
        case 'r':
        case '2':
          setActiveTool('rectangle');
          break;
        case 'd':
        case '3':
          setActiveTool('diamond');
          break;
        case 'o':
        case '4':
          setActiveTool('ellipse');
          break;
        case 'a':
        case '5':
          setActiveTool('arrow');
          break;
        case 'l':
        case '6':
          setActiveTool('line');
          break;
        case 'p':
        case '7':
          setActiveTool('freedraw');
          break;
        case 't':
        case '8':
          setActiveTool('text');
          break;
        case 'n':
        case '9':
          fileInputRef.current?.click();
          break;
        case 'e':
        case '0':
          setActiveTool('eraser');
          break;
        case 'k':
          setActiveTool('laser');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleDuplicate, handleDelete]);

  // Import JSON Board
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          const before = elementsRef.current;
          setElements(imported);
          handleCommitChange(before, imported);
          addToast('Board imported successfully!');
        } else {
          addToast('Invalid JSON file format');
        }
      } catch {
        addToast('Error reading JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const selectedElements = elements.filter(
    (e) => selectedIds.includes(e.id) && !e.isDeleted
  );
  const showStylePanel =
    !isReadOnly &&
    (selectedElements.length > 0 ||
      ['rectangle', 'ellipse', 'diamond', 'arrow', 'line', 'freedraw', 'text'].includes(activeTool));

  const followingUser = remoteUsers.find((u) => u.userId === followingUserId);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Hidden File Inputs for Image & JSON import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImageFile(f);
          e.target.value = '';
        }}
      />
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportJSON}
      />

      {/* Reconnecting / Offline Banner */}
      <ConnectionStatus
        status={connectionStatus}
        queuedCount={queuedChangesCount}
      />

      {/* Following Banner */}
      <FollowBanner
        followingUserName={followingUser ? followingUser.userName : null}
        onStopFollowing={() => setFollowingUserId(null)}
      />

      {/* Top Header */}
      <Header
        roomId={roomId}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        onShare={() => setIsShareModalOpen(true)}
        onExportClick={() => setIsExportModalOpen(true)}
        onImportClick={() => jsonInputRef.current?.click()}
        onClearBoard={() => setIsClearModalOpen(true)}
        onHelpClick={() => setIsHelpModalOpen(true)}
        onToggleChat={() => {
          setIsChatOpen(!isChatOpen);
          setUnreadChatCount(0);
        }}
        unreadChatCount={unreadChatCount}
        users={[
          {
            userId,
            userName,
            userColor,
            cursor: null,
            selectedElementIds: selectedIds,
            lastActive: Date.now(),
          },
          ...remoteUsers,
        ]}
        currentUser={{ userId, userName, userColor }}
        onUpdateUserName={handleUpdateUserName}
        followingUserId={followingUserId}
        onFollowUser={(targetId) => setFollowingUserId(targetId)}
        isReadOnly={isReadOnly}
      />

      {/* Floating Toolbar (Top Center) */}
      {!isReadOnly && (
        <Toolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          isLocked={isLocked}
          setIsLocked={setIsLocked}
          onImageUploadClick={() => fileInputRef.current?.click()}
        />
      )}

      {/* Floating Style Panel (Left) */}
      {showStylePanel && (
        <StylePanel
          currentStyles={currentStyles}
          onChangeStyle={handleChangeStyle}
          selectedElements={selectedElements}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />
      )}

      {/* Main Infinite Canvas */}
      <Canvas
        elements={elements}
        setElements={setElements}
        viewport={viewport}
        setViewport={(vp) => {
          setViewport(vp);
          if (followingUserId) setFollowingUserId(null); // Local movement breaks follow
        }}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        isLocked={isLocked}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        currentStyles={currentStyles}
        userId={userId}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        snapGrid={snapGrid}
        isDarkMode={isDarkMode}
        isReadOnly={isReadOnly}
        remoteUsers={remoteUsers}
        onCommitChange={handleCommitChange}
        onCursorMove={handleCursorMove}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onReorder={handleReorder}
        onZoomToFit={handleZoomToFit}
      />

      {/* Live Remote Cursors Overlay */}
      <CursorOverlay remoteUsers={remoteUsers} viewport={viewport} />

      {/* Floating Emoji Reactions & Reaction Picker */}
      <ReactionOverlay
        reactions={reactions}
        viewport={viewport}
        onSendReaction={(emoji) => {
          const cx = -viewport.scrollX / viewport.zoom + window.innerWidth / (2 * viewport.zoom);
          const cy = -viewport.scrollY / viewport.zoom + window.innerHeight / (2 * viewport.zoom);
          socketRef.current?.sendReaction(emoji, cx, cy);
          setReactions((prev) => [
            ...prev,
            { id: Math.random().toString(36), emoji, x: cx, y: cy },
          ]);
        }}
      />

      {/* Bottom Left Zoom Controls */}
      <ZoomControls
        viewport={viewport}
        setViewport={setViewport}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyRef.current.canUndo()}
        canRedo={historyRef.current.canRedo()}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        onZoomToFit={handleZoomToFit}
      />

      {/* In-board Chat Drawer */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        onSendMessage={(text) => socketRef.current?.sendChatMessage(text)}
        currentUserId={userId}
      />

      {/* Modals */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        roomId={roomId}
        onToast={addToast}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        elements={elements}
        isDarkMode={isDarkMode}
        onToast={addToast}
      />

      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      <ClearConfirmModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleClearConfirm}
      />

      {/* Toast Notifications */}
      <Toast toasts={toasts} />
    </div>
  );
};

