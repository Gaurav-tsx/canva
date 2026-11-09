import React, { useState } from 'react';
import { REACTION_EMOJIS } from 'shared';
import { canvasToScreen, Viewport } from '../engine/transform';
import { Smile } from 'lucide-react';

export interface FloatingReactionItem {
  id: string;
  emoji: string;
  x: number;
  y: number;
}

interface ReactionOverlayProps {
  reactions: FloatingReactionItem[];
  viewport: Viewport;
  onSendReaction: (emoji: string) => void;
}

export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({
  reactions,
  viewport,
  onSendReaction,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      {/* Floating Reaction Elements */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {reactions.map((r) => {
          const screenPos = canvasToScreen(r.x, r.y, viewport);
          return (
            <div
              key={r.id}
              className="floating-reaction"
              style={{
                left: `${screenPos.x}px`,
                top: `${screenPos.y}px`,
              }}
            >
              {r.emoji}
            </div>
          );
        })}
      </div>

      {/* Emoji Reaction Trigger and Picker at Bottom Right */}
      <div className="bottom-right-controls">
        {showPicker && (
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '24px',
              padding: '4px 8px',
              gap: '4px',
              boxShadow: 'var(--shadow-md)',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="tool-button"
                style={{ width: '32px', height: '32px', fontSize: '18px' }}
                onClick={() => {
                  onSendReaction(emoji);
                  setShowPicker(false);
                }}
                title={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className={`icon-btn ${showPicker ? 'active' : ''}`}
          onClick={() => setShowPicker(!showPicker)}
          title="Send emoji reaction"
          aria-label="Send emoji reaction"
        >
          <Smile size={20} />
        </button>
      </div>
    </>
  );
};

