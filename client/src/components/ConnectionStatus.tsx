import React from 'react';
import { WifiOff, Loader2 } from 'lucide-react';

interface ConnectionStatusProps {
  status: 'connected' | 'connecting' | 'disconnected';
  queuedCount: number;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  queuedCount,
}) => {
  if (status === 'connected') return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: '#ef4444',
        color: '#ffffff',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: 600,
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {status === 'connecting' ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <WifiOff size={16} />
      )}
      <span>
        {status === 'connecting'
          ? 'Connecting to server...'
          : 'Offline. Reconnecting...'}
      </span>
      {queuedCount > 0 && (
        <span
          style={{
            background: 'rgba(0,0,0,0.2)',
            padding: '2px 8px',
            borderRadius: '10px',
            fontSize: '11px',
          }}
        >
          {queuedCount} changes queued
        </span>
      )}
    </div>
  );
};

