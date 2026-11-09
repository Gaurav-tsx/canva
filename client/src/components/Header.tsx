import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Share2,
  Moon,
  Sun,
  Download,
  Upload,
  Trash2,
  HelpCircle,
  MessageSquare,
  Eye,
  Check,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { UserPresence } from 'shared';

interface HeaderProps {
  roomId: string;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  onShare: () => void;
  onExportClick: () => void;
  onImportClick: () => void;
  onClearBoard: () => void;
  onHelpClick: () => void;
  onToggleChat: () => void;
  unreadChatCount: number;
  users: UserPresence[];
  currentUser: { userId: string; userName: string; userColor: string };
  onUpdateUserName: (name: string) => void;
  followingUserId: string | null;
  onFollowUser: (userId: string | null) => void;
  isReadOnly: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  roomId,
  isDarkMode,
  setIsDarkMode,
  onShare,
  onExportClick,
  onImportClick,
  onClearBoard,
  onHelpClick,
  onToggleChat,
  unreadChatCount,
  users,
  currentUser,
  onUpdateUserName,
  followingUserId,
  onFollowUser,
  isReadOnly,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentUser.userName);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNameInput(currentUser.userName);
  }, [currentUser.userName]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleSaveName = () => {
    if (nameInput.trim()) {
      onUpdateUserName(nameInput.trim());
    }
    setIsEditingName(false);
  };

  return (
    <>
      {/* Top Left Menu */}
      <div className="header-left" ref={menuRef}>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          title="Main Menu"
          aria-label="Main Menu"
        >
          <Menu size={20} />
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div
            style={{
              position: 'absolute',
              top: '48px',
              left: 0,
              width: '230px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-lg)',
              padding: '6px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <button
              type="button"
              className="button-group-item"
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '13px' }}
              onClick={() => {
                setIsMenuOpen(false);
                onExportClick();
              }}
            >
              <Download size={16} /> Export (PNG, SVG, JSON)
            </button>
            <button
              type="button"
              className="button-group-item"
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '13px' }}
              onClick={() => {
                setIsMenuOpen(false);
                onImportClick();
              }}
            >
              <Upload size={16} /> Open / Import JSON
            </button>
            <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
            <button
              type="button"
              className="button-group-item"
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '13px' }}
              onClick={() => {
                setIsMenuOpen(false);
                setIsDarkMode(!isDarkMode);
              }}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button
              type="button"
              className="button-group-item"
              style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '13px' }}
              onClick={() => {
                setIsMenuOpen(false);
                onHelpClick();
              }}
            >
              <HelpCircle size={16} /> Keyboard Shortcuts
            </button>
            <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
            <button
              type="button"
              className="button-group-item"
              style={{
                justifyContent: 'flex-start',
                padding: '8px 12px',
                fontSize: '13px',
                color: '#e03131',
              }}
              onClick={() => {
                setIsMenuOpen(false);
                onClearBoard();
              }}
            >
              <Trash2 size={16} /> Reset / Clear Canvas
            </button>
          </div>
        )}

        {/* Read-Only Badge */}
        {isReadOnly && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              background: '#fef3c7',
              color: '#92400e',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Eye size={14} /> View Only
          </div>
        )}
      </div>

      {/* Top Right Collaboration & Actions */}
      <div className="header-right">
        {/* User Name Badge / Editor */}
        {isEditingName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="text"
              value={nameInput}
              autoFocus
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border-active)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                width: '110px',
              }}
            />
            <button
              type="button"
              className="icon-btn"
              style={{ width: '28px', height: '28px' }}
              onClick={handleSaveName}
            >
              <Check size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="icon-btn"
            style={{
              width: 'auto',
              padding: '0 10px',
              height: '34px',
              fontSize: '12px',
              fontWeight: 600,
              gap: '6px',
            }}
            onClick={() => setIsEditingName(true)}
            title="Click to change your display name"
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: currentUser.userColor,
                display: 'inline-block',
              }}
            />
            {currentUser.userName}
          </button>
        )}

        {/* Participant Avatars */}
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
          {users.slice(0, 5).map((u) => {
            const isMe = u.userId === currentUser.userId;
            const isFollowing = followingUserId === u.userId;
            const initials = u.userName
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <button
                key={u.userId}
                type="button"
                onClick={() => {
                  if (!isMe) {
                    onFollowUser(isFollowing ? null : u.userId);
                  }
                }}
                title={
                  isMe
                    ? `${u.userName} (You)`
                    : isFollowing
                    ? `Following ${u.userName} (Click to stop)`
                    : `Click to follow ${u.userName}`
                }
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: u.userColor,
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isFollowing ? '2px solid #ef4444' : '2px solid var(--bg-card)',
                  marginLeft: '-8px',
                  cursor: isMe ? 'default' : 'pointer',
                  position: 'relative',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {initials}
                {isFollowing && (
                  <Radio
                    size={10}
                    style={{ position: 'absolute', top: -3, right: -3, color: '#ef4444' }}
                  />
                )}
              </button>
            );
          })}
          {users.length > 5 && (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-card-hover)',
                color: 'var(--text-secondary)',
                fontSize: '10px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--bg-card)',
                marginLeft: '-8px',
              }}
            >
              +{users.length - 5}
            </div>
          )}
        </div>

        {/* Chat Toggle */}
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleChat}
          title="In-board Chat"
          style={{ position: 'relative' }}
          aria-label="In-board Chat"
        >
          <MessageSquare size={18} />
          {unreadChatCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                background: '#ef4444',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                borderRadius: '10px',
                padding: '1px 5px',
              }}
            >
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Share Button */}
        <button
          type="button"
          className="btn-primary"
          onClick={onShare}
          title="Share canvas link"
          aria-label="Share canvas link"
        >
          <Share2 size={16} />
          <span>Share</span>
        </button>
      </div>
    </>
  );
};

