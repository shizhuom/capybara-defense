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
- Guardian: `capybara`. Include the capybara **and its wooden bath tub**, but no oranges. The live orange stack is always drawn separately so life remains readable. Keep the top of the head near 23% of image height; the tub should reach 85%.

Keep the silhouette readable at 56 logical pixels. Large boss PNGs are drawn around 66–90 logical pixels. Art is cosmetic only: changing it does not alter range, movement, input targets, or game rules.

## Synchronization and loading

Run `npm run sync-assets` in the game directory. The zero-dependency script copies only regular lowercase PNG filenames matching `^[a-z][a-z0-9_]*\.png$` from the optional read-only source `../../design/assets/sprites/`. It scans the destination and writes a sorted array manifest. It never deletes existing destination art, creates the source, or fails because the source is absent/empty. Uppercase extensions, hyphens, directories and symlinks are skipped. Canvas and HTML share a loaded-only registry; malformed manifests, missing files and decode failures retain the built-in fallback. Vite's `BASE_URL` supports relative/subdirectory hosting. HTML refreshes once the initial asset batch settles.

The lists below are the complete P2 catalog: **145 PNGs**, including four basic held weapons and eight combat VFX added to P1. Characters, objects, props, weapons and avatars should be transparent RGBA PNG at 256×256 or 512×512 with clear margins. Keep feet near the lower center so gold hero disks remain visible. Level/status badges, energy, hits, shields, weapon effects and input positions remain dynamic.

## Four maps and tile aliases

Maps fill the exact **6×7** board, **576×672** logical pixels at `(32,188)` on the **640×1216** stage. The supplied maps are **768×896**. Roads and endpoints align to 96px cells; the sole guardian uses the current map's final player path point. Maps may be opaque and are clipped to the board. Static G/R/S/C tiles never paint over external maps; route arrows and subtle grid lines remain. Open/broken tile changes and the `1/2` repair tag are live overlays.

`map_sunny_backyard`, `map_sakura_onsen`, `map_midnight_kitchen`, `map_cat_tower_maze`.

Dynamic tiles should be square 256×256 RGBA with transparent margins. Open tiles prefer the map-specific alias then the generic alias. Missing art becomes a translucent cream soft mat with an inset dashed border; broken tiles retain cracked rubble.

`tile_open`, `tile_open_sunny_backyard`, `tile_open_sakura_onsen`, `tile_open_midnight_kitchen`, `tile_open_cat_tower_maze`, `tile_broken`.

## Five guardians and objects

- `capybara`: guardian and wooden tub only; exclude oranges. Head top near 23% of image height, tub bottom near 85%. The tub still tips on defeat.
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
