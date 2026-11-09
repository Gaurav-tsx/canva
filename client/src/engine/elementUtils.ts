import {
  CanvasElement,
  ElementType,
  FillStyle,
  FontFamily,
  generateId,
  StrokeStyle,
  TextAlign,
} from 'shared';

export interface ElementStyleState {
  strokeColor: string;
  fillColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  fontSize: number;
  fontFamily: FontFamily;
  textAlign: TextAlign;
}

export const DEFAULT_STYLES: ElementStyleState = {
  strokeColor: '#1e1e1e',
  fillColor: 'transparent',
  fillStyle: 'none',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 1, // Artist
  opacity: 100,
  fontSize: 20,
  fontFamily: 'hand',
  textAlign: 'left',
};

export function createElement(
  type: ElementType,
  x: number,
  y: number,
  styles: ElementStyleState,
  userId: string,
  extra?: Partial<CanvasElement>
): CanvasElement {
  return {
    id: generateId(12),
    type,
    x,
    y,
    width: 0,
    height: 0,
    angle: 0,
    strokeColor: styles.strokeColor,
    fillColor: styles.fillColor,
    fillStyle: styles.fillStyle,
    strokeWidth: styles.strokeWidth,
    strokeStyle: styles.strokeStyle,
    roughness: styles.roughness,
    opacity: styles.opacity,
    points: type === 'freedraw' ? [[0, 0]] : undefined,
    fontSize: styles.fontSize,
    fontFamily: styles.fontFamily,
    textAlign: styles.textAlign,
    version: 1,
    versionNonce: Date.now(),
    isDeleted: false,
    zIndex: Date.now(),
    updatedBy: userId,
    seed: Math.floor(Math.random() * 2000000),
    ...extra,
  };
}

export function duplicateElements(
  elements: CanvasElement[],
  selectedIds: string[],
  userId: string,
  offset: number = 20
): { newElements: CanvasElement[]; newSelectedIds: string[] } {
  const duplicates: CanvasElement[] = [];
  const newSelectedIds: string[] = [];

  for (const el of elements) {
    if (selectedIds.includes(el.id) && !el.isDeleted) {
      const newId = generateId(12);
      newSelectedIds.push(newId);
      duplicates.push({
        ...el,
        id: newId,
        x: el.x + offset,
        y: el.y + offset,
        zIndex: Date.now() + duplicates.length,
        version: 1,
        versionNonce: Date.now(),
        updatedBy: userId,
        seed: Math.floor(Math.random() * 2000000),
      });
    }
  }

  return {
    newElements: [...elements, ...duplicates],
    newSelectedIds,
  };
}

export function deleteElements(
  elements: CanvasElement[],
  idsToDelete: string[],
  userId: string
): CanvasElement[] {
  return elements.map((el) => {
    if (idsToDelete.includes(el.id) && !el.isDeleted) {
      return {
        ...el,
        isDeleted: true,
        version: el.version + 1,
        versionNonce: Date.now(),
        updatedBy: userId,
      };
    }
    return el;
  });
}

export function reorderElements(
  elements: CanvasElement[],
  selectedIds: string[],
  action: 'front' | 'forward' | 'backward' | 'back'
): CanvasElement[] {
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const selectedIndices = sorted
    .map((el, i) => (selectedIds.includes(el.id) ? i : -1))
    .filter((i) => i !== -1);

  if (selectedIndices.length === 0) return elements;

  const result = [...sorted];

  if (action === 'front') {
    const selected = result.filter((el) => selectedIds.includes(el.id));
    const rest = result.filter((el) => !selectedIds.includes(el.id));
    return [...rest, ...selected].map((el, idx) => ({ ...el, zIndex: idx * 10 }));
  }

  if (action === 'back') {
    const selected = result.filter((el) => selectedIds.includes(el.id));
    const rest = result.filter((el) => !selectedIds.includes(el.id));
    return [...selected, ...rest].map((el, idx) => ({ ...el, zIndex: idx * 10 }));
  }

  if (action === 'forward') {
    for (let i = result.length - 2; i >= 0; i--) {
      if (selectedIds.includes(result[i].id) && !selectedIds.includes(result[i + 1].id)) {
        const temp = result[i];
        result[i] = result[i + 1];
        result[i + 1] = temp;
      }
    }
  }

  if (action === 'backward') {
    for (let i = 1; i < result.length; i++) {
      if (selectedIds.includes(result[i].id) && !selectedIds.includes(result[i - 1].id)) {
        const temp = result[i];
        result[i] = result[i - 1];
        result[i - 1] = temp;
      }
    }
  }

  return result.map((el, idx) => ({ ...el, zIndex: idx * 10 }));
}

