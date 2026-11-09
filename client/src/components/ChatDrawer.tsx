import React, { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { WSChatMessage } from 'shared';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: WSChatMessage[];
  onSendMessage: (text: string) => void;
  currentUserId: string;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  currentUserId,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '64px',
        right: '16px',
        bottom: '80px',
        width: '320px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: 600,
          fontSize: '14px',
        }}
      >
        <span>Board Chat</span>
        <button
          type="button"
          className="icon-btn"
          style={{ width: '26px', height: '26px' }}
          onClick={onClose}
          aria-label="Close Chat"
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontSize: '13px',
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>
            No messages yet. Say hi to your collaborators!
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.userId === currentUserId;
          return (
            <div
              key={m.id}
              style={{
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
              }}
            >
              {!isMe && (
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: m.userColor,
                    marginBottom: '2px',
                  }}
                >
                  {m.userName}
                </div>
              )}
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '12px',
                  background: isMe ? '#6366f1' : 'var(--bg-card-hover)',
                  color: isMe ? '#ffffff' : 'var(--text-primary)',
                  wordBreak: 'break-word',
                  lineHeight: 1.35,
                }}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        style={{
          padding: '10px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '6px',
        }}
      >
        <input
          type="text"
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-canvas)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          className="btn-primary"
          style={{ height: '35px', padding: '0 12px' }}
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};

