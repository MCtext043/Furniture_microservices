export class RenderScheduler {
  constructor(render, requestFrame = (callback) => window.requestAnimationFrame(callback), cancelFrame = (frame) => window.cancelAnimationFrame(frame)) {
    this.render = render;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
    this.frame = 0;
    this.reasons = new Set();
  }

  request(reason = "scene") {
    this.reasons.add(reason);
    if (this.frame) return;
    this.frame = this.requestFrame(() => {
      this.frame = 0;
      const reasons = [...this.reasons];
      this.reasons.clear();
      this.render(reasons);
    });
  }

  dispose() {
    if (this.frame) this.cancelFrame(this.frame);
    this.frame = 0;
    this.reasons.clear();
  }
}
