import React from 'react';
import { Eye, X } from 'lucide-react';

interface FollowBannerProps {
  followingUserName: string | null;
  onStopFollowing: () => void;
}

export const FollowBanner: React.FC<FollowBannerProps> = ({
  followingUserName,
  onStopFollowing,
}) => {
  if (!followingUserName) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        border: '1.5px solid #6366f1',
        padding: '6px 14px',
        borderRadius: '24px',
        fontSize: '13px',
        fontWeight: 600,
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <Eye size={16} color="#6366f1" />
      <span>Following {followingUserName}</span>
      <button
        type="button"
        onClick={onStopFollowing}
        className="icon-btn"
        style={{ width: '22px', height: '22px', border: 'none', background: 'transparent' }}
        title="Stop following"
      >
        <X size={14} />
      </button>
    </div>
  );
};

