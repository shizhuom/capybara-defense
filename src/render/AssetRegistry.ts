export type SpriteImage = HTMLImageElement & { width: number; height: number };
export interface ExternalImageLoader {
  createImage: () => SpriteImage;
  resolveUrl?: (id: string, defaultPath: string) => string | undefined;
}

const imageReady = (image: SpriteImage | undefined): boolean =>
  !!image && image.complete !== false && ((image.naturalWidth || image.width || 0) > 0);

/** Optional local PNG/WebP/JPG overrides. Nothing is requested unless its id is in the manifest or loaded on demand. */
export class AssetRegistry {
  private readonly images = new Map<string, SpriteImage>();
  private readonly pending = new Map<string, Promise<boolean>>();
  private readonly urls = new Map<string, string>();
  private readonly callbacks = new Set<()=>void>();
  private loader?: ExternalImageLoader;
  private settled = false;
  readonly ready: Promise<void>;

  constructor(private readonly base = `${import.meta.env.BASE_URL || './'}assets/sprites/`, options?: { autoLoad?: boolean }) {
    if (options?.autoLoad === false) {
      this.settled = true;
      this.ready = Promise.resolve();
      return;
    }
    this.ready = this.loadManifest().then(()=>{
      this.settled=true;
      this.flushCallbacks();
    });
  }

  /** Plugs in a mini-game image factory (`wx.createImage` / `bl.createImage`) without breaking Web defaults. */
  configureLoader(loader: ExternalImageLoader): void {
    this.loader = loader;
  }

  /** Pre-registers a sprite id → relative/resolved path mapping for lazy on-demand loading. */
  registerUrl(id: string, url: string): void {
    if (/^[a-z][a-z0-9_]*$/.test(id) && url) this.urls.set(id, url);
  }

  /** Loads one sprite on demand (deduplicated). Safe to call from WeChat/Bilibili subpackages. */
  loadSprite(id: string, explicitUrl?: string): Promise<boolean> {
    if (!/^[a-z][a-z0-9_]*$/.test(id)) return Promise.resolve(false);
    if (this.has(id)) return Promise.resolve(true);
    const existing = this.pending.get(id);
    if (existing) return existing;
    const src = explicitUrl ?? this.urls.get(id) ?? this.loader?.resolveUrl?.(id, `${this.base}${id}.png`) ?? `${this.base}${id}.png`;
    if (!src) return Promise.resolve(false);
    const factory = this.loader?.createImage ?? (typeof Image !== 'undefined' ? () => new Image() as SpriteImage : undefined);
    if (!factory) return Promise.resolve(false);
    const promise = new Promise<boolean>(resolve => {
      const image = factory();
      image.onload = () => {
        this.images.set(id, image);
        this.urls.set(id, src);
        this.pending.delete(id);
        this.flushCallbacks();
        resolve(true);
      };
      image.onerror = () => {
        this.pending.delete(id);
        resolve(false);
      };
      image.src = src;
    });
    this.pending.set(id, promise);
    return promise;
  }

  /** Loads a batch of sprites in parallel; never rejects on individual missing files. */
  async loadBatch(entries: ReadonlyArray<string | readonly [string, string]>): Promise<number> {
    const results = await Promise.all(entries.map(entry =>
      typeof entry === 'string' ? this.loadSprite(entry) : this.loadSprite(entry[0], entry[1]),
    ));
    return results.filter(Boolean).length;
  }

  /** Frees decoded sprite references matching `predicate` (helps keep iOS WeChat mini-game RAM low). */
  unloadSprites(predicate: (id: string) => boolean): number {
    let removed = 0;
    for (const id of [...this.images.keys()]) {
      if (!predicate(id)) continue;
      const img = this.images.get(id);
      if (img) { try { img.src = ''; } catch { /* ignore */ } }
      this.images.delete(id);
      removed++;
    }
    return removed;
  }

  get(id: string): HTMLImageElement | undefined {
    if(!/^[a-z][a-z0-9_]*$/.test(id))return undefined;
    const image = this.images.get(id);
    return imageReady(image) ? image : undefined;
  }

  has(id:string):boolean { return !!this.get(id); }
  url(id:string):string|undefined { return this.has(id)?(this.urls.get(id)??`${this.base}${id}.png`):undefined; }
  onReady(callback:()=>void):()=>void {
    let active=true;
    if(this.settled)queueMicrotask(()=>{if(active)callback();});else this.callbacks.add(callback);
    return ()=>{active=false;this.callbacks.delete(callback);};
  }

  private flushCallbacks(): void {
    for (const callback of this.callbacks) { try { callback(); } catch {/* A consumer cannot prevent other refreshes. */} }
    if (this.settled) this.callbacks.clear();
  }

  private async loadManifest(): Promise<void> {
    if (typeof Image === 'undefined' || typeof fetch !== 'function') return;
    try {
      const response = await fetch(`${this.base}manifest.json`);
      if (!response.ok) return;
      const manifest: unknown = await response.json();
      if (!Array.isArray(manifest)) return;
      await Promise.all([...new Set(manifest.filter((id): id is string =>
        typeof id === 'string' && /^[a-z][a-z0-9_]*$/.test(id)
      ))].map(id => new Promise<void>(resolve => {
        const image = new Image() as SpriteImage;
        image.onload = () => { this.images.set(id, image); resolve(); };
        image.onerror = () => resolve();
        image.src = `${this.base}${id}.png`;
      })));
    } catch {
      // Offline, malformed, or absent optional assets never prevent the game drawing.
    }
  }
}

/** Canvas and HTML share one fetch and the same successfully decoded images. */
export const assets=new AssetRegistry();
export const hasSprite=(id:string):boolean=>assets.has(id);
export const spriteUrl=(id:string):string|undefined=>assets.url(id);
export const onAssetsReady=(callback:()=>void):(()=>void)=>assets.onReady(callback);
