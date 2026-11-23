/**
 * Lightweight ES2022 runtime guards for older WeChat / Bilibili mobile JS engines (e.g. iOS 14–15.3 JSC).
 * Zero-cost no-ops on modern engines where these methods already exist.
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
