/**
 * Lightweight Web/ES2022 runtime guards for WeChat & Bilibili mini-game JS engines.
 * WeChat Mini Game omits DOM globals like `URLSearchParams`, and older iOS JSC omits `Object.hasOwn` / `Array.prototype.at`.
 * Zero-cost no-ops on modern browser engines where these already exist.
 */
if (typeof Object.hasOwn !== 'function') {
  Object.defineProperty(Object, 'hasOwn', {
    value: (obj: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(Object(obj), key),
    configurable: true,
    writable: true,
  });
}

if (typeof Array.prototype.at !== 'function') {
  Object.defineProperty(Array.prototype, 'at', {
    value: function at<T>(this: T[], index: number): T | undefined {
      const len = this.length >>> 0;
      const n = Math.trunc(Number(index)) || 0;
      const k = n >= 0 ? n : len + n;
      return k < 0 || k >= len ? undefined : this[k];
    },
    configurable: true,
    writable: true,
  });
}

/** Minimal spec-compatible URLSearchParams for WeChat / Bilibili runtimes where DOM URLSearchParams is absent. */
export class MiniURLSearchParams {
  private readonly entriesList: Array<[string, string]> = [];

  constructor(init?: string | Record<string, string> | Array<[string, string]> | MiniURLSearchParams) {
    if (!init) return;
    if (typeof init === 'string') {
      const cleaned = init.startsWith('?') ? init.slice(1) : init;
      if (!cleaned) return;
      for (const pair of cleaned.split('&')) {
        if (!pair) continue;
        const eq = pair.indexOf('=');
        const rawKey = eq >= 0 ? pair.slice(0, eq) : pair;
        const rawVal = eq >= 0 ? pair.slice(eq + 1) : '';
        this.entriesList.push([decodeURIComponent(rawKey.replace(/\+/g, ' ')), decodeURIComponent(rawVal.replace(/\+/g, ' '))]);
      }
    } else if (init instanceof MiniURLSearchParams) {
      for (const [k, v] of init.entriesList) this.entriesList.push([k, v]);
    } else if (Array.isArray(init)) {
      for (const [k, v] of init) this.entriesList.push([String(k), String(v)]);
    } else if (typeof init === 'object') {
      for (const [k, v] of Object.entries(init)) this.entriesList.push([String(k), String(v)]);
    }
  }

  append(name: string, value: string): void {
    this.entriesList.push([String(name), String(value)]);
  }

  set(name: string, value: string): void {
    const key = String(name);
    const val = String(value);
    let replaced = false;
    for (let i = this.entriesList.length - 1; i >= 0; i--) {
      if (this.entriesList[i][0] === key) {
        if (!replaced) { this.entriesList[i][1] = val; replaced = true; }
        else this.entriesList.splice(i, 1);
      }
    }
    if (!replaced) this.entriesList.push([key, val]);
  }

  get(name: string): string | null {
    const found = this.entriesList.find(([k]) => k === String(name));
    return found ? found[1] : null;
  }

  has(name: string): boolean {
    return this.entriesList.some(([k]) => k === String(name));
  }

  delete(name: string): void {
    const key = String(name);
    for (let i = this.entriesList.length - 1; i >= 0; i--) {
      if (this.entriesList[i][0] === key) this.entriesList.splice(i, 1);
    }
  }

  toString(): string {
    return this.entriesList
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
  }

  forEach(cb: (value: string, key: string) => void): void {
    for (const [k, v] of this.entriesList) cb(v, k);
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entriesList[Symbol.iterator]();
  }
}

export function installMiniPolyfills(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.URLSearchParams !== 'function') {
    g.URLSearchParams = MiniURLSearchParams;
  }
}

installMiniPolyfills();
