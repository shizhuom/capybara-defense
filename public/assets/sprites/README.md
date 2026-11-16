# Optional full-scene sticker artwork

The game ships with complete procedural Canvas artwork. No image download is required.

To override a character, place a transparent PNG here and list its bare id in `manifest.json`:

```json
["capybara", "hamster", "kungfu_po", "box_kraken"]
```

The files in this example are `capybara.png`, `hamster.png`, `kungfu_po.png`, and `box_kraken.png`. IDs use lowercase letters, digits, and underscores. Only listed IDs are requested; an absent or failed image falls back to the procedural sticker. Reload after changing the manifest. The game never loads remote art or fonts.

Use a square 256 × 256 or larger canvas, transparent background, generous clear margins, a thick warm charcoal outline, and an outer white sticker border. Center the character and its prop. The renderer preserves image aspect ratio and adds breathing, energy, level, status, and combat effects.

- Basic pets: `hamster`, `hedgehog`, `squirrel`, `corgi`, `bee`.
- Components: `panda`, `cat`, `shiba`, `hat_bamboo`, `hat_shades`, `hat_wizard`, `goose`, `cleaver`, `rooster`, `basketball`, `raccoon`, `trash_lid`, `frog`, `crown`.
- Heroes: `kungfu_po`, `bamboo_mafia`, `zen_master`, `puss_in_hat`, `meowfia`, `purrcerer`, `samurai_doge`, `doge_wick`, `ronin_goose`, `ballin_rooster`, `rocket_coon`, `pepe_king`.
- Enemies: `rat`, `roach`, `crab`.
- Bosses: `husky_wrecker`, `mega_roomba`, `dr_clippers`, `box_kraken`, `sad_rain_frog`, `king_skunk`.
- Battle guardian: `capybara_soak` and `capybara_soak_dizzy`. Draw only the soaking head/shoulders and waterline, **no tub and no outer white sticker border**. Oranges remain live Canvas art. The legacy `capybara` illustration is retained for existing consumers; battle maps supply their own native baths.

Keep the silhouette readable at small display scales. P3 regular enemy PNGs use a 98px base draw box and bosses use 126px, before gait and size scaling. Art is cosmetic only: changing it does not alter range, movement, input targets, or game rules.

## Synchronization and loading

Run `npm run sync-assets` in the game directory. The zero-dependency script copies only regular lowercase PNG filenames matching `^[a-z][a-z0-9_]*\.png$` from the optional read-only source `../../design/assets/sprites/`. It preserves the source manifest verbatim when it exactly matches the destination PNG catalog, otherwise it writes a safe sorted array manifest. It never deletes existing destination art, creates the source, or fails because the source is absent/empty. Uppercase extensions, hyphens, directories and symlinks are skipped. Canvas and HTML share a loaded-only registry; malformed manifests, missing files and decode failures retain the built-in fallback. Vite's `BASE_URL` supports relative/subdirectory hosting. HTML refreshes once the initial asset batch settles.

The current P12 catalog contains **217 PNGs**; the sections below retain the additions from each release. Characters, objects, props, weapons and avatars should be transparent RGBA PNG at 256×256 or 512×512 with clear margins. Keep feet near the lower center so gold hero disks remain visible. The soaking guardian and storybook check/peek art deliberately have no outer sticker border. Level/status badges, energy, hits, shields, weapon effects and input positions remain dynamic.

## Four maps and tile aliases

Maps fill the entire **1280×720** landscape stage. The **9×5** board spans **936×520** logical pixels at `(172,72)`, with **104px** cells. The supplied map PNGs are **1280×720**; their scenic rim stays visible without an opaque board card. Guardian art uses the painted water centres in `src/config/guardianBaths.ts`; enemy arrival continues to use the unchanged route endpoint. Static G/R/S/C tiles never paint over external maps; route arrows and subtle grid lines remain. Open/broken tile changes and the `1/2` repair tag are live overlays.

`map_sunny_backyard`, `map_sakura_onsen`, `map_midnight_kitchen`, `map_cat_tower_maze`.

Dynamic tiles should be square 256×256 RGBA with transparent margins. Open tiles prefer the map-specific alias then the generic alias. Missing art becomes a translucent cream soft mat with an inset dashed border; broken tiles retain cracked rubble.

`tile_open`, `tile_open_sunny_backyard`, `tile_open_sakura_onsen`, `tile_open_midnight_kitchen`, `tile_open_cat_tower_maze`, `tile_broken`.

## Five guardians and objects

- `capybara`: legacy tub portrait. P10 battle rendering instead uses the two tub-free soaking portraits below; defeat stays upright inside the native water.
- `orange`: one orange and leaf; life stacks and flying gain/loss remain dynamic.
- `shovel`: garden shovel, centered upright; covers the tool button and dragged cursor.
- `sprinkler`: compact water truck pointing right, following the captured path with procedural water jets.
- `glue_trap_placed`: glue board from above; charge counter remains a separate overlay.

## Nineteen basic pets/components and twelve heroes

Basics (5): `hamster`, `squirrel`, `hedgehog`, `corgi`, `bee`.

Components (14): `panda`, `cat`, `shiba`, `hat_bamboo`, `hat_shades`, `hat_wizard`, `goose`, `cleaver`, `rooster`, `basketball`, `raccoon`, `trash_lid`, `frog`, `crown`.

Heroes (12): `kungfu_po`, `bamboo_mafia`, `zen_master`, `puss_in_hat`, `meowfia`, `purrcerer`, `samurai_doge`, `doge_wick`, `ronin_goose`, `ballin_rooster`, `rocket_coon`, `pepe_king`.

All heroes retain gold double-ring disks and near-full energy pulses on board and bench. Merge candidates receive green upgrade or gold recipe target indicators.

## Board held weapons and combat VFX

All four combat basics and all twelve heroes mount a separate, visible weapon on the board. Bee, components and bench units have no mounted weapons. Heroes prefer the equipped `weapon_<id>` (then direct `<id>` alias); defaults use the signature art or `cleaver`/`basketball`. Basic weapon frames are 44px, default hero frames about 54px. Equipped hero frames scale by rarity from 1.05 to 1.52 with a colored aura and a breathing gold signature glow. Upright and diagonal sticker orientations are corrected before target aim is applied.

`weapon_basic_club`, `weapon_basic_slingshot`, `weapon_basic_spear`, `weapon_basic_hammer`.

`vfx_slash_spin`, `vfx_slash_crescent`, `vfx_slash_heavy`, `vfx_slash_cross`, `vfx_thrust_cone`, `vfx_hit_burst`, `vfx_dust_puff`, `vfx_muzzle_flash`.

Melee uses captured slash events; no melee projectile dots are drawn. Spin weapons orbit at 46/54px inside 145–185px slash rings. Thrust extends 28px; ranged weapons recoil 10px with a 0.12s flash. Ranged/magic projectiles are themed 20–32px shapes with tapered trails. Missing weapon/VFX art always retains procedural Canvas geometry. Death dust and fish-icon `+1`/`+8` food popups are independent of damage-number visibility. The bench shovel uses `shovel`, a translated short tag, grass/broken-cell highlights and a capacity-aware pouch outline.

## Five mobs and twelve Bosses

Mobs: `rat`, `roach`, `crab`, `killer_bee`, `charmed_rat`.

Bosses: `husky_wrecker`, `mega_roomba`, `dr_clippers`, `box_kraken`, `sad_rain_frog`, `king_skunk`, `diva_kitty`, `buff_roo`, `hornet_queen`, `screaming_marmot`, `trash_coon`, `dj_rat_king`.

Bosses retain HP, hit flashes, shields, burn, poison, haste and captured-path skills. HTML compendium/HUD icons have distinct geometric SVG fallbacks.

## Twenty black-market props

Use the `prop_` prefix. Each missing prop has its own cream-board SVG geometry, with no Emoji text inside SVG.

- `prop_washer`, `prop_clay`, `prop_milk_bottle`, `prop_whistle`
- `prop_expired_can`, `prop_catnip`, `prop_glue_trap`, `prop_recycle_bin`
- `prop_gold_doge`, `prop_auto_shovel`, `prop_giant_orange_cat`, `prop_vip_poster`
- `prop_extra_oranges`, `prop_shared_oranges`, `prop_hyper_party`, `prop_banana_peel`
- `prop_emp_jammer`, `prop_promo_badge`, `prop_tall_perch`, `prop_bee_overtime`

## Thirty-six weapons

Use `weapon_<id>` (preferred). Direct `<id>` aliases also work; prefixed IDs win. Missing art retains the original distinct M3 SVG.

- `weapon_m01_swatter`, `weapon_m02_slipper`, `weapon_m03_scratcher`, `weapon_m04_baguette`
- `weapon_m05_duster`, `weapon_m06_stool`, `weapon_m07_rolling_pin`, `weapon_m08_durian`
- `weapon_m09_cat_blade`, `weapon_m10_bamboo_staff`, `weapon_m11_salted_fish`, `weapon_m12_iron_wok`
- `weapon_r01_rubber_band`, `weapon_r02_duck_squirt`, `weapon_r03_bubble_gun`, `weapon_r04_tennis_launcher`
- `weapon_r05_hair_dryer`, `weapon_r06_pressure_washer`, `weapon_r07_popcorn_cannon`, `weapon_r08_coin_slingshot`
- `weapon_r09_bamboo_bazooka`, `weapon_r10_acorn_minigun`, `weapon_r11_sniper_laser`, `weapon_r12_junk_mortar`
- `weapon_w01_teaser`, `weapon_w02_balloon`, `weapon_w03_bug_zapper`, `weapon_w04_yarn_orb`
- `weapon_w05_disco_ball`, `weapon_w06_yarn_storm`, `weapon_w07_cat_scratch_meteor`, `weapon_w08_fortune_fish`
- `weapon_w09_yin_yang_burner`, `weapon_w10_cosmic_vacuum`, `weapon_w11_golden_hoop_ball`, `weapon_w12_rain_crown_scepter`

## Sixteen avatars

- `avatar_capybara`, `avatar_hamster`, `avatar_squirrel`, `avatar_bee`
- `avatar_cat_swordsman`, `avatar_doge_agent`, `avatar_goose_bully`, `avatar_kungfu_panda`
- `avatar_rooster_star`, `avatar_frog_king`, `avatar_market_coon`, `avatar_salted_fish`
- `avatar_bamboo_master`, `avatar_sakura_capy`, `avatar_corgi_crown`, `avatar_zen_capy`

## Two main illustrations

- `menu_banner`: transparent 4:3 scene, recommended 1200×900. Center capybara and orange tower with clear margins; HTML preserves aspect ratio.
- `logo_capy`: transparent square brand mascot, recommended 256×256 or 512×512, legible at 40–64 logical pixels.

The existing menu illustration and brand SVG remain the fallback. No remote art or web fonts are fetched.

## P3 walking frames and HUD stickers

Ground enemies alternate their base and walk2 art using path progress; flyers flap at 12 fps. Stun freezes the pose, vertical segments retain horizontal facing, and missing frames use base art.

- `box_kraken_walk2`
- `buff_roo_walk2`
- `charmed_rat_walk2`
- `crab_walk2`
- `diva_kitty_walk2`
- `dj_rat_king_walk2`
- `dr_clippers_walk2`
- `hornet_queen_walk2`
- `husky_wrecker_walk2`
- `killer_bee_walk2`
- `king_skunk_walk2`
- `mega_roomba_walk2`
- `rat_walk2`
- `roach_walk2`
- `sad_rain_frog_walk2`
- `screaming_marmot_walk2`
- `trash_coon_walk2`
- `ui_bell_summon`
- `ui_compendium_book`
- `ui_fish_food`
- `ui_shop_bag`

Regular enemies use a 98px base box; bosses use 126px. The four HUD icons are illustrated fish food, summon bell, compendium book and shop bag. Art does not change gameplay hitboxes.
# P4 启动画面资源

新增 `start_splash_bg`（1280×720，全幅萌宠温泉聚会）；`title_logo_zh`、`title_logo_en`（960×320，透明无框艺术字）；`ui_btn_start_zh`、`ui_btn_start_en`（520×220，异形木牌）；`ui_trophy_rank`、`ui_map_sign`（256×256，奖杯和路标）。

启动页专用背景不随地图切换；地图选择仅影响飘落粒子的气氛。PNG 未解码时使用无棋盘的程序化温泉场景与无框 SVG 艺术字。P4 阶段共 173 张 PNG；P5 已升级为 185 张，战斗地图及行走帧接口保持不变。



## P5 canonical asset path and sticker additions

The canonical directory is `public/assets/sprites/` (193 PNGs in P6, originally185 in P5). `AssetRegistry` resolves `BASE_URL + assets/sprites/`, so production and nested hosting work without absolute URLs. `npm run sync-assets` reads `../../design/assets/sprites/` only and writes inside this game. P4's original path remains recoverable from tag `v1.0-p4`.

- 256×256 transparent mascot headers: `ui_header_compendium`, `ui_header_armory`, `ui_header_market`, `ui_header_rank`, `ui_header_profile`, `ui_header_settings`.
- 192×192 transparent UI stickers: `ui_tutorial_pointer`, `ui_tutorial_capy`, `ui_coin_gold`, `ui_star_rank`, `ui_ticket_gacha`, `ui_skull_threat`.

Every new HTML sticker has a distinct vector-only offline fallback. Menu wallets, ledger headings, tutorial pointers, and result rewards repaint once the asset batch settles. No PNG contains interactive labels; language, numbers, controls, and collection states remain live HTML.

## P6 settlement and strategy stickers

P6 ships 193 PNGs with the source manifest. Four 256×256 stickers: `ui_result_victory`, `ui_result_defeat`, `ui_header_pause`, `ui_mvp_crown`. Four 192×192 stickers: `ui_lock_closed`, `ui_lock_open`, `ui_wave_horn`, `ui_merge_sparkle`.

These eight IDs have independent SVG fallbacks in `sceneSticker`; Canvas lock and merge badges also remain legible before image decoding. Settlement artwork refreshes with the rest of the asynchronous asset batch.

## P9 v2 shop and battle presentation

P9 shipped **201** original PNGs. New scene IDs: `npc_shop_raccoon`, `npc_blacksmith_capy`, `ui_gacha_machine`, `ui_trunk_crate`, `ui_battle_clash_crest`, `ui_crossed_blades`, `ui_alert_siren`, and `ui_unlock_chest`. All eight have distinct inline SVG fallbacks and participate in asynchronous menu/dialog refresh. Merchant, weapon-rack, transition and unlock labels remain live bilingual HTML rather than baked text. The source design directory is strictly read-only.

## P10 native baths and storybook compendium

The **205-item** manifest includes `capybara_soak` (256×256), `capybara_soak_dizzy` (256×256), `ui_compendium_peek_capy` (256×256), and `ui_storybook_check` (128×128), all transparent RGBA with no white border/backing. HTML has four matching frame-free SVG fallbacks; battle Canvas has an independent tub-free head-and-shoulders fallback.

The four maps retain every board coordinate and their 1280×720 canvas. Three dry endpoint containers now contain painted water; Sakura's existing pool is unchanged. Visual centres and square portrait sizes are: backyard `(1053.5,531)`, `74px`; Sakura `(263,490)`, `90px`; kitchen `(1055,323)`, `80px`; cat tower `(1054,325)`, `74px`. Orange stacks, losses, gains, water ripples and steam share these anchors.

## P11 shared storybook folders

The 209-item manifest adds four 256×256 transparent, borderless peeking mascots:

| ID | Folder |
| --- | --- |
| `ui_armory_peek_capy` | Armory, brass goggles |
| `ui_market_peek_raccoon` | Market, tiny pot and glasses |
| `ui_rank_peek_capy` | Rankings, golden star laurel |
| `ui_profile_peek_capy` | Passport and Settings, cherry blossom |

All four keep their paws on the bottom edge, without a backing card or white outline. `P11_SCENE_IDS` registers their distinct offline SVG fallbacks and asynchronous UI refresh. Run `npm run sync-assets` to copy the authoritative read-only design assets into this directory; never edit the source art.

## P12 shield settlement and continuous puppets

Eight transparent, borderless UI assets: `ui_victory_shield_wings`, `ui_defeat_shield_wings` (512x512); `ui_victory_star_lit`, `ui_victory_star_dim` (192x192); `ui_pause_peek_capy` (256x256); `ui_btn_return_arrow`, `ui_stats_scroll`, `ui_horn_continue` (160x160). All have offline SVG equivalents. Enemy animation samples the canonical base sprite through a continuous spine/limb rig; `_walk2` PNGs remain in the catalog for compatibility but are no longer rendered.