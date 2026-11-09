import { CanvasElement } from 'shared';

export interface HistoryEntry {
  before: { [id: string]: CanvasElement | null };
  after: { [id: string]: CanvasElement | null };
}

export class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private maxDepth: number = 50;

  public record(before: CanvasElement[], after: CanvasElement[]) {
    const beforeMap: { [id: string]: CanvasElement | null } = {};
    const afterMap: { [id: string]: CanvasElement | null } = {};

    const allIds = new Set([
      ...before.map((e) => e.id),
      ...after.map((e) => e.id),
    ]);

    let hasDiff = false;
    for (const id of allIds) {
      const b = before.find((e) => e.id === id) || null;
      const a = after.find((e) => e.id === id) || null;

      // Check if actually changed
      if (JSON.stringify(b) !== JSON.stringify(a)) {
        hasDiff = true;
        beforeMap[id] = b ? { ...b } : null;
        afterMap[id] = a ? { ...a } : null;
      }
    }

    if (hasDiff) {
      this.undoStack.push({ before: beforeMap, after: afterMap });
      if (this.undoStack.length > this.maxDepth) {
        this.undoStack.shift();
      }
      this.redoStack = []; // Clear redo stack on new action
    }
  }

  public undo(currentElements: CanvasElement[], userId: string): CanvasElement[] | null {
    if (this.undoStack.length === 0) return null;

    const entry = this.undoStack.pop()!;
    this.redoStack.push(entry);

    const updatedElements = [...currentElements];

    for (const [id, beforeState] of Object.entries(entry.before)) {
      const index = updatedElements.findIndex((e) => e.id === id);
      if (beforeState === null) {
        // Element was newly created in this action -> undo means delete it
        if (index !== -1) {
          updatedElements[index] = {
            ...updatedElements[index],
            isDeleted: true,
            version: updatedElements[index].version + 1,
            versionNonce: Date.now(),
            updatedBy: userId,
          };
        }
      } else {
        // Revert to beforeState
        if (index !== -1) {
          updatedElements[index] = {
            ...beforeState,
            version: updatedElements[index].version + 1,
            versionNonce: Date.now(),
            updatedBy: userId,
          };
        } else {
          updatedElements.push({
            ...beforeState,
            version: 1,
            versionNonce: Date.now(),
            updatedBy: userId,
          });
        }
      }
    }

    return updatedElements;
  }

  public redo(currentElements: CanvasElement[], userId: string): CanvasElement[] | null {
    if (this.redoStack.length === 0) return null;

    const entry = this.redoStack.pop()!;
    this.undoStack.push(entry);

    const updatedElements = [...currentElements];

    for (const [id, afterState] of Object.entries(entry.after)) {
      const index = updatedElements.findIndex((e) => e.id === id);
      if (afterState === null) {
        // Deleted in that action
        if (index !== -1) {
          updatedElements[index] = {
            ...updatedElements[index],
            isDeleted: true,
            version: updatedElements[index].version + 1,
            versionNonce: Date.now(),
            updatedBy: userId,
          };
        }
      } else {
        if (index !== -1) {
          updatedElements[index] = {
            ...afterState,
            version: updatedElements[index].version + 1,
            versionNonce: Date.now(),
            updatedBy: userId,
          };
        } else {
          updatedElements.push({
            ...afterState,
            version: 1,
            versionNonce: Date.now(),
            updatedBy: userId,
          });
        }
      }
    }

    return updatedElements;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

