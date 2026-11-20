import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {sceneSticker} from '../src/ui/stickers';
export const p5Ids=['ui_header_compendium','ui_header_armory','ui_header_market','ui_header_rank','ui_header_profile','ui_header_settings','ui_tutorial_pointer','ui_tutorial_capy','ui_coin_gold','ui_star_rank','ui_ticket_gacha','ui_skull_threat'] as const;
it('ships 255 canonical assets including twelve RGBA P5 stickers of the specified sizes',()=>{
 const ids=JSON.parse(readFileSync('public/assets/sprites/manifest.json','utf8'));expect(ids).toHaveLength(255);
 for(const id of p5Ids){expect(ids).toContain(id);const png=readFileSync(`public/assets/sprites/${id}.png`);const size=id.startsWith('ui_header')?256:192;expect(png.readUInt32BE(16)).toBe(size);expect(png.readUInt32BE(20)).toBe(size);expect(png[25]).toBe(6);}
});
it('renders every P5 sticker as distinct SVG geometry before optional PNGs decode',()=>{
 const art=p5Ids.map(id=>sceneSticker(id,'',48));for(let i=0;i<art.length;i++){expect(art[i]).toContain('<svg');expect(art[i]).toContain(`data-sticker="${p5Ids[i]}"`);expect(art[i]).not.toContain('<text');}
 expect(new Set(art.map(a=>a.replace(/data-sticker="[^"]*"|aria-label="[^"]*"/g,''))).size).toBe(12);
});
