import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {sceneSticker} from '../src/ui/stickers';
import * as registry from '../src/render/AssetRegistry';
const ids=['ui_victory_shield_wings','ui_defeat_shield_wings','ui_victory_star_lit','ui_victory_star_dim','ui_pause_peek_capy','ui_btn_return_arrow','ui_stats_scroll','ui_horn_continue'] as const;
afterEach(()=>vi.restoreAllMocks());
it('synchronizes all 290 sprites and exact P12 transparent dimensions',()=>{
 const manifest=JSON.parse(readFileSync('public/assets/sprites/manifest.json','utf8'));
 expect(manifest).toHaveLength(290);expect(new Set(manifest).size).toBe(290);
 for(const [i,id] of ids.entries()){
  expect(manifest).toContain(id);const png=readFileSync(`public/assets/sprites/${id}.png`),size=i<2?512:i<4?192:i===4?256:160;
  expect([png.readUInt32BE(16),png.readUInt32BE(20),png[25]]).toEqual([size,size,6]);
 }
});
it('renders eight distinct borderless SVGs offline and upgrades to loaded PNGs',()=>{
 const svgs=ids.map(id=>sceneSticker(id as Parameters<typeof sceneSticker>[0],'',64));
 for(const svg of svgs){expect(svg).toContain('<svg');expect(svg).not.toContain('<text');expect(svg).not.toContain('stroke="#fffdf6"');}
 expect(new Set(svgs.map(s=>s.replace(/data-sticker="[^"]*"|aria-label="[^"]*"/g,''))).size).toBe(8);
 vi.spyOn(registry,'spriteUrl').mockImplementation(id=>`/nested/assets/sprites/${id}.png`);
 for(const id of ids)expect(sceneSticker(id as Parameters<typeof sceneSticker>[0],'',64)).toContain(`src="/nested/assets/sprites/${id}.png"`);
});
