export type ToolType =
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'freedraw'
  | 'text'
  | 'image'
  | 'eraser'
  | 'laser';

export type ElementType =
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'freedraw'
  | 'text'
  | 'image';

export type FillStyle = 'none' | 'hachure' | 'solid' | 'cross-hatch';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type FontFamily = 'hand' | 'normal' | 'code';
export type TextAlign = 'left' | 'center' | 'right';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface ArrowBinding {
  elementId: string;
  focus: number; // -1 to 1 along edge
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number; // in radians
  strokeColor: string;
  fillColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number; // 0 = straight/architect, 1 = artist, 2 = cartoonist
  opacity: number; // 0 to 100
  points?: [number, number][]; // for freedraw & multi-point arrows/lines
  text?: string;
  fontSize?: number;
  fontFamily?: FontFamily;
  textAlign?: TextAlign;
  imageUrl?: string;
  arrowStartBinding?: ArrowBinding | null;
  arrowEndBinding?: ArrowBinding | null;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  zIndex: number;
  updatedBy: string;
  seed: number;
}

export interface UserPresence {
  userId: string;
  userName: string;
  userColor: string;
  cursor: { x: number; y: number } | null;
  selectedElementIds: string[];
  lastActive: number;
  isLaser?: boolean;
  laserPoints?: { x: number; y: number; time: number }[];
  isPresenter?: boolean;
  viewport?: { scrollX: number; scrollY: number; zoom: number };
}

export interface RoomMeta {
  roomId: string;
  viewToken: string;
  createdAt: number;
  lastActiveAt: number;
  elementCount: number;
}

