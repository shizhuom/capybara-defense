import {it,expect,afterEach,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {sceneSticker} from '../src/ui/stickers';
import * as registry from '../src/render/AssetRegistry';
const ids=['ui_result_victory','ui_result_defeat','ui_header_pause','ui_mvp_crown','ui_lock_closed','ui_lock_open','ui_wave_horn','ui_merge_sparkle'] as const;
afterEach(()=>vi.restoreAllMocks());
it('ships201 unique PNGs and the8 correctly sized transparent settlement/strategy stickers',()=>{
 const manifest=JSON.parse(readFileSync('public/assets/sprites/manifest.json','utf8'));expect(manifest).toHaveLength(201);expect(new Set(manifest).size).toBe(201);
 for(const id of manifest)expect(readFileSync(`public/assets/sprites/${id}.png`).subarray(1,4).toString()).toBe('PNG');
 for(const [i,id] of ids.entries()){expect(manifest).toContain(id);const png=readFileSync(`public/assets/sprites/${id}.png`);expect([png.readUInt32BE(16),png.readUInt32BE(20),png[25]]).toEqual([i<4?256:192,i<4?256:192,6]);}
});
it('gives all8 icons distinct offline SVG geometry and upgrades to decoded PNG URLs',()=>{
 const art=ids.map(id=>sceneSticker(id,'',48));for(const svg of art){expect(svg).toContain('<svg');expect(svg).not.toContain('<text');}
 expect(new Set(art.map(a=>a.replace(/data-sticker="[^"]*"|aria-label="[^"]*"/g,''))).size).toBe(8);
 vi.spyOn(registry,'spriteUrl').mockImplementation(id=>`/nested/assets/sprites/${id}.png`);
 for(const id of ids)expect(sceneSticker(id,'',48)).toContain(`src="/nested/assets/sprites/${id}.png"`);
});
