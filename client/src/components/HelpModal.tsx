import React from 'react';
import { X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'V / 1', desc: 'Select / Move / Resize / Rotate' },
    { key: 'H', desc: 'Hand (Pan canvas)' },
    { key: 'R / 2', desc: 'Rectangle tool' },
    { key: 'D / 3', desc: 'Diamond tool' },
    { key: 'O / 4', desc: 'Ellipse / Circle tool' },
    { key: 'A / 5', desc: 'Arrow tool' },
    { key: 'L / 6', desc: 'Line tool' },
    { key: 'P / 7', desc: 'Pencil / Freehand draw' },
    { key: 'T / 8', desc: 'Text tool (click canvas to type)' },
    { key: 'N / 9', desc: 'Insert Image (or paste with Ctrl+V)' },
    { key: 'E / 0', desc: 'Eraser tool' },
    { key: 'K', desc: 'Laser pointer (fading trails)' },
    { key: 'Space + Drag', desc: 'Quick pan canvas' },
    { key: 'Ctrl + Scroll', desc: 'Zoom in / out at cursor' },
    { key: 'Ctrl + Z', desc: 'Undo (your actions)' },
    { key: 'Ctrl + Shift + Z / Y', desc: 'Redo' },
    { key: 'Ctrl + D', desc: 'Duplicate selected elements' },
    { key: 'Delete / Backspace', desc: 'Delete selected elements' },
    { key: 'Ctrl + A', desc: 'Select all elements' },
    { key: "Ctrl + '", desc: 'Toggle dot grid' },
    { key: 'Shift + Click', desc: 'Multi-select elements' },
    { key: 'Double Click Shape', desc: 'Add or edit text label on shape' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Keyboard Shortcuts</h2>
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

        <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 8px',
                borderRadius: '6px',
                background: idx % 2 === 0 ? 'var(--bg-canvas)' : 'transparent',
                fontSize: '13px',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>{s.desc}</span>
              <kbd
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

