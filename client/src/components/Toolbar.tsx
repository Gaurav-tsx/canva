import React from 'react';
import {
  Lock,
  Unlock,
  Hand,
  MousePointer2,
  Square,
  Diamond,
  Circle,
  ArrowRight,
  Minus,
  Pencil,
  Type,
  Image as ImageIcon,
  Eraser,
  Sparkles,
} from 'lucide-react';
import { CanvasElement, ToolType } from 'shared';

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  selectedElements?: CanvasElement[];
  onToggleLockSelected?: () => void;
  onImageUploadClick: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  setActiveTool,
  isLocked,
  setIsLocked,
  selectedElements,
  onToggleLockSelected,
  onImageUploadClick,
}) => {
  const hasSelection = !!selectedElements && selectedElements.length > 0;
  const areSelectedLocked = hasSelection && selectedElements.every((el) => el.isLocked);
  const isLockActive = hasSelection ? areSelectedLocked : isLocked;

  const handleLockClick = () => {
    if (hasSelection && onToggleLockSelected) {
      onToggleLockSelected();
    } else {
      setIsLocked(!isLocked);
    }
  };
  const tools: {
    id: ToolType;
    label: string;
    shortcut: string;
    icon: React.ReactNode;
  }[] = [
    { id: 'hand', label: 'Hand (Pan)', shortcut: 'H', icon: <Hand size={18} /> },
    { id: 'select', label: 'Selection', shortcut: 'V', icon: <MousePointer2 size={18} /> },
    { id: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: <Square size={18} /> },
    { id: 'diamond', label: 'Diamond', shortcut: 'D', icon: <Diamond size={18} /> },
    { id: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: <Circle size={18} /> },
    { id: 'arrow', label: 'Arrow', shortcut: 'A', icon: <ArrowRight size={18} /> },
    { id: 'line', label: 'Line', shortcut: 'L', icon: <Minus size={18} /> },
    { id: 'freedraw', label: 'Draw', shortcut: 'P', icon: <Pencil size={18} /> },
    { id: 'text', label: 'Text', shortcut: 'T', icon: <Type size={18} /> },
    { id: 'image', label: 'Insert Image', shortcut: 'N', icon: <ImageIcon size={18} /> },
    { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: <Eraser size={18} /> },
    { id: 'laser', label: 'Laser Pointer', shortcut: 'K', icon: <Sparkles size={18} /> },
  ];

  return (
    <div className="floating-toolbar" role="toolbar" aria-label="Drawing tools">
      <button
        type="button"
        className={`tool-button ${isLockActive ? 'active' : ''}`}
        onClick={handleLockClick}
        title={
          hasSelection
            ? areSelectedLocked
              ? 'Unlock selected elements'
              : 'Lock selected elements in place'
            : isLocked
            ? 'Tool is locked (won’t reset to selection)'
            : 'Tool lock (click to keep tool selected)'
        }
        aria-label="Lock / Unlock"
        style={hasSelection && areSelectedLocked ? { color: '#ef4444', borderColor: '#ef4444' } : undefined}
      >
        {isLockActive ? <Lock size={16} /> : <Unlock size={16} />}
      </button>

      <div className="toolbar-divider" />

      {tools.map((t) => {
        const isActive = activeTool === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className={`tool-button ${isActive ? 'active' : ''}`}
            onClick={() => {
              if (t.id === 'image') {
                onImageUploadClick();
              } else {
                setActiveTool(t.id);
              }
            }}
            title={`${t.label} (${t.shortcut})`}
            aria-label={t.label}
          >
            {t.icon}
            <span className="shortcut-badge">{t.shortcut}</span>
          </button>
        );
      })}
    </div>
  );
};

