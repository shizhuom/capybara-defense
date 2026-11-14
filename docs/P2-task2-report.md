# P2 Task 2 renderer report

## Result and ownership

Implemented the approved single-player renderer against Task 1's `STAGE`, `COMBAT_STYLES`, `DEFAULT_HELD_WEAPONS`, optional attack fields and captured visual events. All changes remain inside `games/capybara-defense`; design assets were read only. No commits, browser use, server lifecycle changes, core rule changes or child agents.

Owned changes: `src/render/StickerRenderer.ts`, new `HeldWeaponRenderer.ts` and `CombatEffects.ts`, renderer tests, `public/sprites/README.md`. The only additional changes are the explicitly carried `m2-props` repair test and the root-authorized `render.dig` dictionary entry (`铲` / `DIG`).

## Rendering changes

- The entire 6×7 board paints at `(32,188)` with 96px cells, map frame 576×672, on the 640×1216 canvas. Hit testing, range clipping, road/placement/dig highlights and fog use `STAGE` dimensions. Removed the rival ribbons, AI guardian, AI board entities and middle wall.
- All four map guardians and orange gain/loss animations resolve the final player path point dynamically. Guardian frame is 104×112; board pet frame is 88px with `.92 × (1 + .06 × levelDelta)` scaling; regular/Boss bases are `.76`/`1.04`. Hero disks, levels, energy and statuses expand for board cells, while bench feedback stays compact.
- All sixteen combat kinds mount the confirmed default weapon only on board. Heroes read live equipped weapons, prefixed then direct sprite aliases, all five rarity scales and colored auras, with breathing gold signature awakening. Inspected the real sixteen default stickers and corrected upright/diagonal art before applying aim. Missing art retains procedural weapon geometry.
- Pure body and weapon poses animate facing, directional lunge/squash, 2.1π spin at 46/54px, 25% windup plus 185° cleave, reversing twin slashes, 28px thrust, 10px recoil and 0.12s muzzle flash. Magic relics float above ground rings.
- Captured slash events draw 145/185px spin rings, crescent/heavy/cross slashes and 120px thrust cones. Signature/empowered/critical spins overlay heavy art. Projectiles keep their captured unit theme after source removal, have 20–32px bodies and tapered trails, and distinguish acorn, rocket, fishbone, tracer, mortar, yin-yang, lightning, basketball and poison waves. Legacy melee projectiles are suppressed.
- Hit effects use directional core displacement without multiplying its already-pixel units, squash and white flash; hit bursts, expanding death dust and fish-icon `+1`/`+8` popups work with PNG or procedural fallback. Food feedback remains visible when damage numbers are disabled. Existing M2 path ultimates and M3 boss skills/statuses remain active.
- Bench shovels use the shovel sprite and translated short tag without level labels, weapons or merge hints. Selected/dragged bench tools highlight G/B even with zero pouch stock, partial B repairs show `1/2`, one stored shovel can target B, and pouch outlines indicate capacity. Washer/clay/milk/whistle do not show shovel targets. Tools, truck and five nests fit within 1216px.
- Sprite documentation now describes the complete 145-PNG catalog, 768×896 maps and all twelve new weapon/VFX IDs. Existing copied manifest/art were not modified by Task 2.

## Interfaces

- `heldWeapon(unit, partialLoadout?)` resolves board-only sprite/style/scale/rarity/signature metadata.
- `bodyPose(unit)` and `weaponPose(unit, seconds)` are pure layout functions; weapon poses expose extension, recoil and muzzle state for focused verification.
- `drawHeldWeapon(context, unit, seconds, partialLoadout?)` renders pet-local mounts and fallbacks. `fitSprite` preserves aspect ratio.
- `drawCombatEvent(context, event, units, partialLoadout?, critical?)` consumes slash/projectile/hit/death/food events and returns whether handled. It does not mutate game state. Projectile themes prefer captured `event.effect`, and slash geometry survives missing source units.
- `render.dig` is the only new translation key consumed here. Task 3 still owns other UI/i18n content and browser coordinate conversion.

## Verification

RED: `npm test -- tests/p2-render.test.ts` initially failed to import the deliberately absent `HeldWeaponRenderer` module before implementation.

GREEN: `npm test -- tests/render.test.ts tests/m2-render.test.ts tests/m3-render.test.ts tests/p1-render.test.ts tests/p1-assets.test.ts tests/p2-render.test.ts tests/m2-props.test.ts` passed **7 files / 143 tests**. Existing renderer assertions were migrated to the new geometry and player route; no tests skipped or removed. New P2 coverage includes 42 hit centers/boundaries, five nests/pouch, all sixteen defaults, all 36 equipped weapon resolutions and rarity scales, exact motion, captured events, missing art, cone/ring frames, tool filtering and one-shovel repairs. The carried gold_doge case now repairs actual cell `(0,2)`, asserts success/O tile/zero shovels, and no added food or loot.

`npm run typecheck` passed (`tsc --noEmit`). `git diff --check` passed for the owned changes. Only focused suites were run; root owns final suite/build/browser QA.

## Review and remaining QA

Root should visually inspect actual rendered animation frames and four-map alignment after Task 3 at desktop and 390×844, including left-facing weapon aim, recoil flash, dense status overlays, touch shovel dragging and language changes. Canvas tests verify intrinsic geometry rather than CSS pointer conversion. No browser screenshots or build claims are made here. Default art and individual VFX were inspected locally, with contact sheet `.runtime/p2-weapon-contact.png`.

No known functional blocker remains in Task 2. The engine intentionally retains legacy AI fields for compatibility; the renderer ignores AI entities and uses only the player path.

## Review fix round 1 — captured slash state and authored art axes

Read the complete `P2-task2-review.md` and amended brief, then verified both Important findings and the cross-slash windup finding against emission/rendering code. This section supersedes the earlier `drawCombatEvent` signature and the description of inferred critical enhancement. Fix scope includes only visual metadata in core; damage, economy, skill rules, counter timing and hooks are unchanged.

### Exact event contract changes

Added exported `AttackPresentation` with six readonly primitive fields:

| Field | Value captured before the basic attack resolves |
| --- | --- |
| `sourceKind: string` | The attacker's kind at emission |
| `hero: boolean` | Whether that source kind is in `HEROES` |
| `awakened: boolean` | The equipped signature's awakening state |
| `empowered: boolean` | Whether `unit.empowered > 0`, before decrement |
| `critical: boolean` | The actual critical basic-slash branch: empowered Puss in Hat |
| `enhanced: boolean` | Captured awakening/empowerment/critical enhancement |

Added **only** `readonly presentation?: Readonly<AttackPresentation>` to `VisualEvent`. New slash events populate it with an `Object.freeze` snapshot. This preserves the last empowered charge even after Puss consumes it. Event age remains independently mutable; no combat-state field or save/profile schema was changed.

`drawCombatEvent(context, event, units)` now consumes only captured presentation for slash source classification, hero ring size and enhancement. It no longer accepts loadout/critical arguments or consults the current source/loadout/counter. Missing legacy metadata has a deterministic plain/basic fallback. Removed the nearby-red-damage inference from `StickerRenderer` completely. Projectile source-theme fallback remains separate and unchanged.

### Art transforms and windup

Replaced family/default-only orientation guesses with explicit `WEAPON_ART_AXES` records for all 36 equipped weapons, four basic weapons, `cleaver` and `basketball`. Records use independently inspected normalized PNG landmarks: handle-to-striking-end for melee, breech-to-mouth for guns, and symmetry axes for round relics. Each record also has a muzzle anchor; launchers/slingshots can distinguish aim landmarks from the actual emission mouth. `weaponArtGeometry(id)` derives both the corrective rotation and transformed muzzle coordinate from that authored record, and the flash is placed in the same corrected image frame. Direct sprite aliases reuse the same metadata. Missing art keeps the procedural frame and flash.

Cross slash now spends the first 25% winding from 0° to −65°, then executes the forward and reverse 185° strokes over the remaining 75%. Quarter-boundary tests explicitly verify 0%, 12.5% and 25% poses and the reverse phase.

### RED → GREEN evidence

1. Before implementation, ran `npm test -- tests/p2-render.test.ts tests/p2-core.test.ts`. Result: **9 failed / 75 passed**. Failures demonstrated missing frozen emission metadata; hero ring/overlay changes after bench movement/removal; unrelated critical-number contamination; missing nondefault per-asset axes; and skipped first-quarter windup.
2. After implementation, the same focused pair passed **84 tests** (47 renderer / 37 core).
3. Final affected-suite command: `npm test -- tests/p2-render.test.ts tests/p2-core.test.ts tests/render.test.ts tests/m2-render.test.ts tests/m3-render.test.ts tests/p1-render.test.ts`. Output: **6 files passed / 153 tests passed** (2026-11-13, final run 22:55:18 tool clock). No entire-project suite was run.
4. `npm run typecheck` passed (`tsc --noEmit`). Owned `git diff --check` passed; output contained only normal repository LF/CRLF conversion notices.

Regression tests compare the exact same captured hero slash's chosen images and 185px frame before/after movement to bench, unequipping, source removal and adding unrelated critical damage. They separately cover an ordinary spin remaining unenhanced and the last empowered Puss charge's pre-decrement critical snapshot. Nondefault swatter and pressure-washer tests track real matrix stacks for left/right aim, compare independently hand-measured PNG axes against the composed image transform, and verify flash world coordinates equal the transformed barrel mouth. All 36 equipped IDs require explicit axis metadata.

Inspected the supplied full 36-weapon catalog using `.runtime/p2-axes-m.png`, `.runtime/p2-axes-r.png`, `.runtime/p2-axes-w.png`, plus original pressure-washer/bubble-gun images. No source art changed. No Git mutations, browser/server lifecycle, UI or translation changes were made in this fix round. Root's integrated screenshot/input QA remains outstanding as previously scoped.
