export class EventBus {
  #listeners = new Map();

  on(event, listener) {
    const listeners = this.#listeners.get(event) || new Set();
    listeners.add(listener);
    this.#listeners.set(event, listeners);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    this.#listeners.get(event)?.delete(listener);
  }

  emit(event, payload) {
    for (const listener of this.#listeners.get(event) || []) listener(payload);
  }

  clear() {
    this.#listeners.clear();
  }
}
