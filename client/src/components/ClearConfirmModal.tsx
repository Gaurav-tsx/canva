import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ClearConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ClearConfirmModal: React.FC<ClearConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e03131', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} /> Clear Canvas
          </h2>
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

        <p style={{ fontSize: '14px', lineHeight: 1.5, marginBottom: '20px', color: 'var(--text-primary)' }}>
          Are you sure you want to clear the entire whiteboard? This will remove all elements for all connected participants in this room.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            className="icon-btn"
            style={{ width: 'auto', padding: '0 14px', height: '36px' }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ background: '#e03131', height: '36px' }}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <Trash2 size={16} /> Clear Everything
          </button>
        </div>
      </div>
    </div>
  );
};

