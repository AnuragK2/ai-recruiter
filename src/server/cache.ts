type Entry<T> = { value: T; expiresAt: number };

export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();

  constructor(
    private readonly defaultTtlMs: number,
    private readonly maxEntries = 256,
  ) {}

  get(key: string): T | undefined {
    if (this.defaultTtlMs === 0) return undefined;
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    if (ttlMs === 0) return;
    if (this.store.size >= this.maxEntries) {
      const first = this.store.keys().next().value;
      if (first) this.store.delete(first);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get size(): number {
    return this.store.size;
  }
}

export function stableHash(value: unknown): string {
  return JSON.stringify(value);
}
