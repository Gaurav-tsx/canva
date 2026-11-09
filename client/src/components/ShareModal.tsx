import React, { useState } from 'react';
import { X, Copy, Check, ShieldAlert, Eye, Lock } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onToast: (msg: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  roomId,
  onToast,
}) => {
  const [copiedEdit, setCopiedEdit] = useState(false);
  const [copiedView, setCopiedView] = useState(false);

  if (!isOpen) return null;

  const origin = window.location.origin;
  const editUrl = `${origin}/board/${roomId}`;
  const viewUrl = `${origin}/view/${roomId}`;

  const handleCopyEdit = () => {
    navigator.clipboard.writeText(editUrl);
    setCopiedEdit(true);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.7 } });
    onToast('Link copied to clipboard!');
    setTimeout(() => setCopiedEdit(false), 2000);
  };

  const handleCopyView = () => {
    navigator.clipboard.writeText(viewUrl);
    setCopiedView(true);
    onToast('Read-only link copied!');
    setTimeout(() => setCopiedView(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Share Canvas</h2>
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

        {/* Edit Link */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            Collaboration Link (Anyone can edit)
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              readOnly
              value={editUrl}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-canvas)',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
            />
            <button
              type="button"
              className="btn-primary"
              style={{ height: '36px' }}
              onClick={handleCopyEdit}
            >
              {copiedEdit ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedEdit ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Read-Only Link */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            Read-Only Link (View only, no edits)
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              readOnly
              value={viewUrl}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-canvas)',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
            />
            <button
              type="button"
              className="icon-btn"
              style={{ height: '36px', width: '36px' }}
              onClick={handleCopyView}
              title="Copy Read-Only Link"
            >
              {copiedView ? <Check size={16} color="#10b981" /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            padding: '12px',
            background: 'rgba(99, 102, 241, 0.08)',
            borderRadius: '10px',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            fontSize: '12px',
            lineHeight: 1.4,
            color: 'var(--text-primary)',
          }}
        >
          <ShieldAlert size={20} style={{ color: '#6366f1', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Open collaboration:</strong> Anyone who opens this link can instantly draw and edit on this board in real time. No accounts or logins are ever required.
          </div>
        </div>
      </div>
    </div>
  );
};

