const clone = (value) => structuredClone(value);

export class HistoryManager {
  constructor(apply, limit = 100) { this.apply = apply; this.limit = limit; this.undoStack = []; this.redoStack = []; }
  snapshot(value) { return clone(value); }
  record(before, after, label = "change") {
    if (JSON.stringify(before) === JSON.stringify(after)) return false;
    this.undoStack.push({ before: clone(before), after: clone(after), label });
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
    return true;
  }
  undo() { const entry = this.undoStack.pop(); if (!entry) return false; this.redoStack.push(entry); this.apply(clone(entry.before), entry.label); return true; }
  redo() { const entry = this.redoStack.pop(); if (!entry) return false; this.undoStack.push(entry); this.apply(clone(entry.after), entry.label); return true; }
  clear() { this.undoStack.length = 0; this.redoStack.length = 0; }
}
