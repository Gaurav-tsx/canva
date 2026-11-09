import React from 'react';
import {
  PALETTE_COLORS,
  FILL_PALETTE_COLORS,
  CanvasElement,
  FillStyle,
  FontFamily,
  StrokeStyle,
  TextAlign,
} from 'shared';
import { ElementStyleState } from '../engine/elementUtils';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  BringToFront,
  SendToBack,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Lock,
  Unlock,
} from 'lucide-react';

interface StylePanelProps {
  currentStyles: ElementStyleState;
  onChangeStyle: (updates: Partial<ElementStyleState>) => void;
  selectedElements: CanvasElement[];
  onDuplicate: () => void;
  onDelete: () => void;
  onReorder: (action: 'front' | 'forward' | 'backward' | 'back') => void;
  onToggleLock?: () => void;
}

export const StylePanel: React.FC<StylePanelProps> = ({
  currentStyles,
  onChangeStyle,
  selectedElements,
  onDuplicate,
  onDelete,
  onReorder,
  onToggleLock,
}) => {
  const isTextSelected = selectedElements.some((e) => e.type === 'text');
  const hasSelection = selectedElements.length > 0;

  return (
    <aside className="style-panel" aria-label="Element style settings">
      {/* Stroke Color */}
      <div>
        <div className="style-section-title">Stroke</div>
        <div className="color-palette">
          {PALETTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-swatch ${currentStyles.strokeColor === c ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => onChangeStyle({ strokeColor: c })}
              title={c}
              aria-label={`Stroke color ${c}`}
            />
          ))}
          <input
            type="color"
            value={currentStyles.strokeColor.startsWith('#') ? currentStyles.strokeColor : '#000000'}
            onChange={(e) => onChangeStyle({ strokeColor: e.target.value })}
            className="color-swatch"
            style={{ padding: 0, cursor: 'pointer' }}
            title="Custom stroke color"
            aria-label="Custom stroke color"
          />
        </div>
      </div>

      {/* Background / Fill Color */}
      {!isTextSelected && (
        <div>
          <div className="style-section-title">Background</div>
          <div className="color-palette">
            {FILL_PALETTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${currentStyles.fillColor === c ? 'active' : ''}`}
                style={{
                  backgroundColor: c === 'transparent' ? '#ffffff' : c,
                  position: 'relative',
                }}
                onClick={() =>
                  onChangeStyle({
                    fillColor: c,
                    fillStyle: c === 'transparent' ? 'none' : currentStyles.fillStyle === 'none' ? 'hachure' : currentStyles.fillStyle,
                  })
                }
                title={c === 'transparent' ? 'Transparent' : c}
                aria-label={`Fill color ${c}`}
              >
                {c === 'transparent' && (
                  <span style={{ color: '#e03131', fontSize: '14px', fontWeight: 'bold' }}>✕</span>
                )}
              </button>
            ))}
            <input
              type="color"
              value={currentStyles.fillColor.startsWith('#') ? currentStyles.fillColor : '#ffffff'}
              onChange={(e) =>
                onChangeStyle({
                  fillColor: e.target.value,
                  fillStyle: currentStyles.fillStyle === 'none' ? 'hachure' : currentStyles.fillStyle,
                })
              }
              className="color-swatch"
              style={{ padding: 0, cursor: 'pointer' }}
              title="Custom fill color"
              aria-label="Custom fill color"
            />
          </div>
        </div>
      )}

      {/* Fill Style */}
      {!isTextSelected && currentStyles.fillColor !== 'transparent' && (
        <div>
          <div className="style-section-title">Fill Style</div>
          <div className="button-group">
            {(['hachure', 'cross-hatch', 'solid'] as FillStyle[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`button-group-item ${currentStyles.fillStyle === f ? 'active' : ''}`}
                onClick={() => onChangeStyle({ fillStyle: f })}
              >
                {f === 'hachure' ? 'Hatch' : f === 'cross-hatch' ? 'Cross' : 'Solid'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stroke Width */}
      {!isTextSelected && (
        <div>
          <div className="style-section-title">Stroke Width</div>
          <div className="button-group">
            {[
              { val: 1, label: 'Thin' },
              { val: 2, label: 'Med' },
              { val: 4, label: 'Bold' },
              { val: 6, label: 'X-Bold' },
            ].map((sw) => (
              <button
                key={sw.val}
                type="button"
                className={`button-group-item ${currentStyles.strokeWidth === sw.val ? 'active' : ''}`}
                onClick={() => onChangeStyle({ strokeWidth: sw.val })}
              >
                {sw.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stroke Style */}
      {!isTextSelected && (
        <div>
          <div className="style-section-title">Stroke Style</div>
          <div className="button-group">
            {(['solid', 'dashed', 'dotted'] as StrokeStyle[]).map((ss) => (
              <button
                key={ss}
                type="button"
                className={`button-group-item ${currentStyles.strokeStyle === ss ? 'active' : ''}`}
                onClick={() => onChangeStyle({ strokeStyle: ss })}
              >
                {ss.charAt(0).toUpperCase() + ss.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sloppiness / Roughness */}
      {!isTextSelected && (
        <div>
          <div className="style-section-title">Sloppiness</div>
          <div className="button-group">
            {[
              { val: 0, label: 'Architect' },
              { val: 1, label: 'Artist' },
              { val: 2, label: 'Cartoonist' },
            ].map((r) => (
              <button
                key={r.val}
                type="button"
                className={`button-group-item ${currentStyles.roughness === r.val ? 'active' : ''}`}
                onClick={() => onChangeStyle({ roughness: r.val })}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Text Settings (when text is selected) */}
      {isTextSelected && (
        <>
          <div>
            <div className="style-section-title">Font Size</div>
            <div className="button-group">
              {[
                { val: 16, label: 'S' },
                { val: 20, label: 'M' },
                { val: 28, label: 'L' },
                { val: 36, label: 'XL' },
              ].map((fs) => (
                <button
                  key={fs.val}
                  type="button"
                  className={`button-group-item ${currentStyles.fontSize === fs.val ? 'active' : ''}`}
                  onClick={() => onChangeStyle({ fontSize: fs.val })}
                >
                  {fs.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="style-section-title">Font Family</div>
            <div className="button-group">
              {(['hand', 'normal', 'code'] as FontFamily[]).map((ff) => (
                <button
                  key={ff}
                  type="button"
                  className={`button-group-item ${currentStyles.fontFamily === ff ? 'active' : ''}`}
                  onClick={() => onChangeStyle({ fontFamily: ff })}
                >
                  {ff === 'hand' ? 'Virgil' : ff === 'normal' ? 'Normal' : 'Code'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="style-section-title">Text Align</div>
            <div className="button-group">
              {[
                { val: 'left', icon: <AlignLeft size={14} /> },
                { val: 'center', icon: <AlignCenter size={14} /> },
                { val: 'right', icon: <AlignRight size={14} /> },
              ].map((ta) => (
                <button
                  key={ta.val}
                  type="button"
                  className={`button-group-item ${currentStyles.textAlign === ta.val ? 'active' : ''}`}
                  onClick={() => onChangeStyle({ textAlign: ta.val as TextAlign })}
                >
                  {ta.icon}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Opacity */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span className="style-section-title" style={{ margin: 0 }}>
            Opacity
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {currentStyles.opacity}%
          </span>
        </div>
        <input
          type="range"
          min="10"
          max="100"
          step="5"
          value={currentStyles.opacity}
          onChange={(e) => onChangeStyle({ opacity: parseInt(e.target.value, 10) })}
          style={{ width: '100%', accentColor: 'var(--border-active)' }}
          aria-label="Element opacity"
        />
      </div>

      {/* Layer Actions & Duplicate/Delete when elements selected */}
      {hasSelection && (
        <>
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
          <div>
            <div className="style-section-title">Layers</div>
            <div className="button-group">
              <button
                type="button"
                className="button-group-item"
                onClick={() => onReorder('front')}
                title="Bring to Front"
              >
                <BringToFront size={14} />
              </button>
              <button
                type="button"
                className="button-group-item"
                onClick={() => onReorder('forward')}
                title="Bring Forward"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="button-group-item"
                onClick={() => onReorder('backward')}
                title="Send Backward"
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                className="button-group-item"
                onClick={() => onReorder('back')}
                title="Send to Back"
              >
                <SendToBack size={14} />
              </button>
            </div>
          </div>

          <div>
            <div className="style-section-title">Actions</div>
            <div className="button-group">
              {onToggleLock && (
                <button
                  type="button"
                  className="button-group-item"
                  onClick={onToggleLock}
                  style={selectedElements.every((el) => el.isLocked) ? { color: '#ef4444' } : undefined}
                  title={selectedElements.every((el) => el.isLocked) ? 'Unlock in Place' : 'Lock in Place'}
                >
                  {selectedElements.every((el) => el.isLocked) ? (
                    <>
                      <Lock size={14} /> Locked
                    </>
                  ) : (
                    <>
                      <Unlock size={14} /> Lock
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                className="button-group-item"
                onClick={onDuplicate}
                title="Duplicate (Ctrl+D)"
              >
                <Copy size={14} /> Duplicate
              </button>
              <button
                type="button"
                className="button-group-item"
                onClick={onDelete}
                style={{ color: '#e03131' }}
                title="Delete (Del)"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
};

