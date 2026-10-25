// A quote belongs to a specific BOM and sheet size. UI generations prevent a
// slower response for an old scene from replacing the current estimate.
export class CostQuoteController {
  constructor(fetchQuote) {
    this.fetchQuote = fetchQuote;
    this.cache = new Map();
    this.pending = new Map();
    this.generation = 0;
  }

  begin(key) { this.key = key; return ++this.generation; }
  isCurrent(generation) { return generation === this.generation; }
  get(key) { return this.cache.get(key) || null; }

  async request(key, payload) {
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.pending.has(key)) return this.pending.get(key);
    const request = Promise.resolve().then(() => this.fetchQuote(key, payload)).then((data) => {
      if (data) {
        this.cache.set(key, data);
        if (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value);
      }
      return data;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }
}
