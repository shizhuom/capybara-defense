/** Optional local PNG overrides. Nothing is requested unless its id is in the manifest. */
export class AssetRegistry {
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly callbacks = new Set<()=>void>();
  private settled = false;
  readonly ready: Promise<void>;

  constructor(private readonly base = `${import.meta.env.BASE_URL || './'}assets/sprites/`) {
    this.ready = this.loadManifest().then(()=>{
      this.settled=true;
      for(const callback of this.callbacks){try{callback();}catch{/* A consumer cannot prevent other refreshes. */}}
      this.callbacks.clear();
    });
  }

  get(id: string): HTMLImageElement | undefined {
    if(!/^[a-z][a-z0-9_]*$/.test(id))return undefined;
    const image = this.images.get(id);
    return image?.complete && image.naturalWidth > 0 ? image : undefined;
  }

  has(id:string):boolean { return !!this.get(id); }
  url(id:string):string|undefined { return this.has(id)?`${this.base}${id}.png`:undefined; }
  onReady(callback:()=>void):()=>void {
    let active=true;
    if(this.settled)queueMicrotask(()=>{if(active)callback();});else this.callbacks.add(callback);
    return ()=>{active=false;this.callbacks.delete(callback);};
  }

  private async loadManifest(): Promise<void> {
    if (typeof Image === 'undefined') return;
    try {
      const response = await fetch(`${this.base}manifest.json`);
      if (!response.ok) return;
      const manifest: unknown = await response.json();
      if (!Array.isArray(manifest)) return;
      await Promise.all([...new Set(manifest.filter((id): id is string =>
        typeof id === 'string' && /^[a-z][a-z0-9_]*$/.test(id)
      ))].map(id => new Promise<void>(resolve => {
        const image = new Image();
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
