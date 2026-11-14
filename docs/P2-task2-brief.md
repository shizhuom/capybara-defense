# P2 Task 2 Brief

Read D:/rea_game/design/codex_p2_solo_overhaul_spec.md in full before editing. This brief is implementation scope, not a replacement for the authoritative spec.

## Global Constraints

- ONLY create, modify, or delete files inside `D:/rea_game/games/capybara-defense/`.
- Never modify root baseline files or `D:/rea_game/design/`; read/copy source art only.
- Keep `127.0.0.1:4175`, `capybara_defense_v1:` and old profile/test-backup compatibility.
- Preserve 36 weapons, 20 props, 12 heroes/Bosses, 54 ranks, 16 avatars, music, encyclopedia, and P1 tutorial reward deduplication unless P2 explicitly changes a rule.
- Preserve the P1 Git checkpoint `319ea6c` / `v1.0-p1`; implementation branch is `p2-solo-overhaul` inside the independent game repository.
- No subagent dispatches children. Only root runs the browser/server lifecycle and commits; workers change only their assigned files and report focused test evidence.

## Review Focus

1. Failed redraw must preserve both the current pack and escalating summon count; reward receipt retries remain idempotent.
2. Bench tools must never enter combat, consume active prop cooldown on invalid use, merge into units, or swap onto a board cell.
3. All four endpoints must govern arrivals, summons, guardian art, rescue props and orange animations; no old half-board coordinate leaks.
4. Mid-attack source removal and missing optional art must preserve real damage and safe rendering; melee never emits generic projectile dots.
5. 390×844 input hit regions, tutorial overlays and the shovel pouch must agree with the new canvas geometry, including touch drag and language changes.

## Task 2: Board and held-weapon/VFX renderer

**Ownership:** `src/render/`, render tests (`render`, `m2-render`, `m3-render`, `p1-render`, `p1-assets`) and new `p2-render.test.ts`; `public/sprites/README.md`. Root syncs art and owns sync script changes if needed.

**Carried test follow-up from Task1 review:** Also fix only the gold_doge repair case at `tests/m2-props.test.ts:82`: the broken tile moved to `(0,2)` but action still calls `dig(1,8)`. Use the actual damaged cell, assert successful completed repair and no treasure/food reward. Run this focused suite with your render suite. No other core edits.

**Translation dependency resolved:** You may add only `render.dig: '铲'` and English `'DIG'` to the existing Chinese/English dictionaries so the renderer tag test is independently green. Task3 then owns all remaining translations and preserves these entries. This is a sequential shared-file handoff, not parallel editing.

**Review fix scope extension:** Task2 may modify only attack visual metadata in `src/core/types.ts` and `src/core/BattleEngine.ts` (plus focused P2 core/render tests) to capture source kind, hero/enhancement/empowerment and actual attack-associated critical state at emission. Preserve damage/economy/skill semantics. Renderer must consume immutable event metadata after source movement/removal and must not infer criticals from unrelated nearby damage. Add per-asset directional axes for equipped weapon sprites as part of HeldWeaponRenderer. See P2-task2-review.md for the complete findings.

**Confirmed Task1 contract:** New hit/death events have effect `vfx_hit_burst`/`vfx_dust_puff`; food has value1/8. Samurai slash.effect is `heavy_cleave` while its COMBAT_STYLES value is `cleave180`. `UNITS.shovel.category='tool'`, zero safe stats. Current full suite69failures: m2-render27/m3-render13/p1-render23/render3 are this task's old geometry; remaining p1-ui2/ui1 belong to Task3. Exact145PNGs and source manifest already copied/hash checked; map sizes768×896.

**Interfaces:** Consume Task1 exact STAGE, combat map and optional attack fields/events. Create `HeldWeaponRenderer.ts` and `CombatEffects.ts` as focused rendering modules. Continue shared AssetRegistry and procedural fallback. All board drawing/hit testing derives dimensions from STAGE/GRID.

- [ ] RED tests for 6×7 hit boundaries and bench/pouch coordinates, all 16 combat weapon mappings, default/equipped/rarity/awakening, styles and safe missing sprites, no AI guardian/wall/banner, dynamic guardian endpoint.
- [ ] Implement spec §2.1 and §4 exactly: ~88px pet box and .92×(1+.06×levelDelta), regular .76/Boss1.04; guardian104×112. Map paints entire6×7, O/B dynamic overlays and 1/2 repair tag.
- [ ] Render board-only mounted weapons for basic4 and all12 heroes (no bee/components/bench). Use real equipped sprite and rarity aura; animated body facing/lunge/squash, 2.1π spin orbit46/54 and145–185 ring,185° cleave,28px thrust,10px recoil + .12s muzzle, floating magic relics/ground rings.
- [ ] Draw themed20–32px spinning projectiles with tapered trails, magic variants, directional hit jiggle/white flash/burst, death dust and food+1/+8 popups. Preserve existing real ult animations and status readability.
- [ ] Bench shovel uses shovel image and translated DIG tag; valid G/B and pouch highlights, no misleading merge target. Position all lower tools/nests within1216 canvas. Update all sprite dictionary IDs to145 and tests accordingly.
- [ ] Run owned tests and report evidence; root reviews diff before next task.
