# P2 Task 1 core review

Spec verdict: **PASS for the Task 1 core scope**. Quality verdict: **APPROVE WITH MINOR FOLLOW-UP**. No Critical or Important findings were identified. This is not approval of the complete P2 feature or its pending renderer/UI integration.

## Review basis and limits

Read the authoritative `D:/rea_game/design/codex_p2_solo_overhaul_spec.md`, `docs/P2-task1-brief.md`, `docs/P2-task1-report.md`, and the complete `docs/P2-task1-review-diff.txt` (175,094 bytes, 1,995 lines; staged changes against `319ea6c`). The submitted production changes are confined to the assigned game core/config files. The diff does not change port 4175, the storage prefix, profile formats, or the baseline checkpoint.

Additional inspection was limited to concrete cross-interface risks: tool merge suggestions (`MergeTargets.ts`); weapon proc/DOT ownership and event snapshots (`WeaponSystem.ts`); solo result consumption and duplicate receipts (`src/ui/storage.ts:46`). No code, index or branch changes were made. No tests were rerun: the implementation report supplies 424 passing owned tests, including 35 P2 tests, and a passing typecheck. This review independently checked code and assertions rather than treating those reported results as a full-project pass.

## Findings

### Minor — gold-doge repair regression now tests an invalid action

**Location:** `tests/m2-props.test.ts:82`.

The test changes the damaged tile to `e.state.grid[2][0] = 'B'` but still calls `e.dig(1,8)`. Row 8 is outside the new seven-row board, so the unchanged-loot assertion succeeds because digging is rejected. It no longer verifies the intended guarantee that successfully repairing a broken tile cannot roll gold-doge treasure.

**Requested change:** call `e.dig(0,2)`, assert success and restoration to `O`, and assert that loot and food remain unchanged. Retain the deterministic treasure-triggering RNG so an accidental treasure roll on repair makes the test fail. Production currently handles this correctly: `BattleEngine.ts:146` calls `treasure` only for `G`.

## Core compliance evidence

- **Geometry/routes:** `src/config/maps.ts:7` defines a single player route with an AI compatibility alias; all four matrices/routes match spec section 2.2, and `maps.ts:33` exports the exact grid/stage dimensions. `GridSystem.ts:6` gives the entire board to the player. `tests/m3-maps.test.ts` checks exact coordinates, continuity, distinctness and live movement on all four maps.
- **Solo execution and failure atomicity:** `BattleEngine.ts:26` no longer constructs opponent setup/AI; the step loop, resources and wave spawns operate only on the player. Explicit AI commands reject before mutation, and the legacy AI spawn helper returns an uninserted id-0 object without consuming sequence IDs (`BattleEngine.ts:157`). AI damage/DOT are guarded (`:51`, `:292`). Summon validates the escalating price before discarding cards, paying food or advancing the counter (`:70`); the P2 tests compare the entire state after an unaffordable redraw.
- **Tools:** capped pack draws are implemented at `BattleEngine.ts:81` with filtering in `PropSystem.ts:39`. Tool dig/store consumption, staged pouch/bench repair and completed-progress deletion are handled at `BattleEngine.ts:89`, `:119`, `:127`; fresh husky damage clears progress at `:397`. Board-to-tool swaps are rejected before mutation. Cross-side checks precede tool swapping (`MergeSystem.ts:10`), and tool outcomes cannot become merge suggestions. Unit-target props filter tools before cooldown payment (`PropSystem.ts:58`); recycling grants exactly four food (`:82`). Consumed tool commands return no dangling unit ID.
- **Economy/risk:** `src/config/units.ts:16` and `src/config/waves.ts:3` match the specified summon, starting, bee, shovel, preparation and ten-wave values. Enemy HP values match the requested ordinary/Boss changes. Wave 1 has no subsidy, later waves grant three and no free shovels (`BattleEngine.ts:263`). Shared oranges and party apply the specified solo benefit and enemy risk (`PropSystem.ts:31`, `:37`; `BattleEngine.ts:159`). Kills deterministically grant one/eight food with positional feedback (`BattleEngine.ts:301`). The approximate draw-rate discrepancy is documented; exact weight 10 and the preserved pre-existing weights satisfy the explicit rule.
- **Path-dependent endpoints:** arrival/orange events use the current route (`BattleEngine.ts:173`, `:253`); rescue trigger, landing and clearance use the specified endpoint offsets (`PropSystem.ts:118`); summoned enemies clamp to the current endpoint (`BossMechanics.ts:13`); sprinkler snapshots the reversed complete route (`PropSystem.ts:91`). No old endpoint remains in these core paths.
- **Combat contract:** `src/config/combat.ts:1` matches the required mappings/scales, including samurai `cleave180`. Attacks snapshot angle/facing and event endpoints, melee emits slash instead of the generic projectile, and ranged events identify source kind (`BattleEngine.ts:288`, `:327`). Animation decay, hit offset reset, hit/death/food events and real immediate damage are present (`:211`, `:237`, `:291`). Existing weapon proc and ultimate damage remain in place; source references retained by DOT ownership allow later kills and weapon hooks after removal. This establishes the core event contract, not rendered fallback/art correctness.
- **Settlement/profile compatibility:** natural final clearance checks wave 10 spawn completion and an empty enemy list (`BattleEngine.ts:260`); survival determines victory. Settlement uses solo loot and the capped half-food conversion (`:417`), with zero loss coins permitted by the brief. The unchanged storage consumer remains winner-gated and deduplicates battle IDs before rewarding (`src/ui/storage.ts:46`). No reward migration change was introduced.

## Integration status

The 69 reported full-suite failures remain renderer/UI work. This review does not count guardian art placement, visible held weapons, optional-art fallbacks, touch/hit geometry, shovel-pouch UI, translated keys, tutorial overlays, responsive screenshots, browser smoke tests or build completion as implemented core evidence. Those need their own later-layer gate. The surviving inert opponent compatibility modules do not constitute active AI execution.
