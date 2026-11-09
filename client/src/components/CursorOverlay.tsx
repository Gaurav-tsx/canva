import React from 'react';
import { UserPresence } from 'shared';
import { canvasToScreen, Viewport } from '../engine/transform';

interface CursorOverlayProps {
  remoteUsers: UserPresence[];
  viewport: Viewport;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({
  remoteUsers,
  viewport,
}) => {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {remoteUsers.map((user) => {
        if (!user.cursor || user.cursor.x === null || user.cursor.y === null) return null;

        const screenPos = canvasToScreen(user.cursor.x, user.cursor.y, viewport);

        return (
          <div
            key={user.userId}
            className="cursor-pointer"
            style={{
              transform: `translate3d(${screenPos.x}px, ${screenPos.y}px, 0)`,
            }}
          >
            {/* SVG Mouse Cursor Arrow */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
            >
              <path
                d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                fill={user.userColor}
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </svg>

            {/* Name Badge */}
            <div
              className="cursor-tag"
              style={{
                backgroundColor: user.userColor,
              }}
            >
              {user.userName}
            </div>
          </div>
        );
      })}
    </div>
  );
};

