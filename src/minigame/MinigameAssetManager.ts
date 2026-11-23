import { assets } from '../render/AssetRegistry';
import type { PlatformAdapter, SubpackageName } from '../platform/types';
import { classifySprite, spriteRelativePath } from './assetPack';
import spriteIds from '../../public/assets/sprites/manifest.json';

const ALL_IDS = spriteIds as readonly string[];

/**
 * Manages tiered sprite loading for WeChat / Bilibili mini-games and Web preview.
 * Main package loads on boot; `maps` and `meta` subpackages load lazily on demand.
 */
export class MinigameAssetManager {
  private readonly loadedPackages = new Set<string>();
  private readonly packagePromises = new Map<SubpackageName, Promise<boolean>>();

  constructor(private readonly platform: PlatformAdapter) {
    assets.configureLoader({
      createImage: () => this.platform.createImage(),
      resolveUrl: (id) => this.resolveSpriteUrl(id),
    });
    for (const id of ALL_IDS) {
      const rule = classifySprite(id);
      if (rule.omit) continue;
      assets.registerUrl(id, this.resolveSpriteUrl(id));
    }
  }

  private resolveSpriteUrl(id: string): string {
    if (this.platform.kind === 'web') {
      return this.platform.resolveAssetPath(`assets/sprites/${id}.png`);
    }
    return this.platform.resolveAssetPath(spriteRelativePath(id));
  }

  /** Preloads core main-package sprites (splash, Sunny Backyard, heroes, basic minions, HUD icons). */
  async bootMainAssets(): Promise<number> {
    if (this.loadedPackages.has('main')) return 0;
    const ids = ALL_IDS.filter(id => {
      const rule = classifySprite(id);
      return !rule.omit && rule.pkg === 'main';
    });
    const count = await assets.loadBatch(ids);
    this.loadedPackages.add('main');
    return count;
  }

  /** Loads a WeChat/Bilibili subpackage (`maps` or `meta`) and decodes its sprites (or a targeted subset). */
  async ensureSubpackage(name: SubpackageName, subset?: readonly string[]): Promise<boolean> {
    let subPromise = this.packagePromises.get(name);
    if (!subPromise) {
      subPromise = this.platform.loadSubpackage(name);
      this.packagePromises.set(name, subPromise);
    }
    const ok = await subPromise;
    if (!ok) {
      this.packagePromises.delete(name);
      return false;
    }
    const ids = subset
      ? subset.filter(id => !classifySprite(id).omit)
      : ALL_IDS.filter(id => {
          const rule = classifySprite(id);
          return !rule.omit && rule.pkg === name;
        });
    await assets.loadBatch(ids);
    if (!subset) this.loadedPackages.add(name);
    return true;
  }

  /** Ensures a battle map's background and tub rim are loaded before starting combat on that map. */
  async ensureMap(mapId: string): Promise<void> {
    const mapSprite = `map_${mapId}`;
    const rimSprite = `tub_rim_${mapId}`;
    const loadWork = classifySprite(mapSprite).pkg === 'maps'
      ? this.ensureSubpackage('maps', [mapSprite, rimSprite]).then(() => undefined)
      : assets.loadBatch([mapSprite, rimSprite]).then(() => undefined);
    // Never block battle launch indefinitely if a device delays an image decode event.
    await Promise.race([
      loadWork,
      new Promise<void>(resolve => setTimeout(resolve, 1800)),
    ]);
  }

  /** Frees heavy off-screen panoramic backgrounds when entering battle to protect iOS mini-game RAM. */
  releaseHeavyIdleSprites(activeMapId: string): number {
    return assets.unloadSprites(id =>
      id === 'bg_onsen_village' || (id.startsWith('map_') && id !== `map_${activeMapId}`),
    );
  }
}
