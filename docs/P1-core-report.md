# P1 core implementation report

## Status

Complete within the assigned game-directory files. No design, repository baseline, service lifecycle, Git state, storage module, UI, render, or audio implementation files were edited by this task.

## Files and behavior

- `src/config/opponents.ts`: exact five rank bands, decision intervals, opening delays, reaction delays, and highest-tier counter-merge flag. Nonfinite ranks default to zero; finite ranks clamp to 0–53.
- `src/core/OpponentAI.ts`: isolated setup and identity generation, legal unique family-compatible weapons, nonreciprocal passive pools, rank-based active slots, crisis/cooldown-aware activations, strongest eligible controlled hero targeting, delayed SEALED responses, recipe-first merges, highest-tier Boss counters, map-specific placement scoring, paid summoning/redraw, and validated digging.
- `src/core/BattleEngine.ts`: independent seeded setup stream; generated loadouts excluded when AI is disabled; explicit AI loadout and tuning overrides preserved; per-engine AI state; populated opponent identity; Boss spawn bubble effect.
- `src/core/PropSystem.ts`: successful sprinkler removes only same-side SEALED statuses and emits `purge` with `effect:'sprinkler'`. Original 120 true damage, 4.5 knockback, two-second slow and one-use rule remain. Treasure bubble and weapon event carry `effect:'treasure'`.
- `src/core/MergeTargets.ts`: pure query using real MergeSystem outcomes, including all twelve recipes and feeding in either direction, excluding washing, swaps, locks, self, opponents and maxed results.
- `src/core/Tutorial.ts`: ordered successful-action state machine; immutable finish/replay candidates; twenty coins once; skip awards no coins and retains eligibility; replay retains the claim flag. A first completion after skip/replay may claim the reward, and later completions cannot claim again. Persistence remains the caller's responsibility.
- `src/core/types.ts`, `PlayerProgression.ts`, `MetaProgression.ts`: optional source-compatible types with runtime defaults for developer mode and tutorial state; old matches migrate tutorial completion/claim; explicit replay false retained; full-test profile completion/claim flags set.
- `tests/p1-core.test.ts`: 49 tests, including rank boundaries, 540 seeded rank/loadout combinations plus extreme samples, decisions and opening clocks, actual active use, cooldowns, seals, map placements, resource legality/redraw, recipes/feeding, nonmutation, tutorial and backup restoration.
- `tests/ui.test.ts`, `tests/m3-progression.test.ts`: only expected new tutorial/settings fields extended; no existing cases deleted or old assertions weakened.

## Test evidence

- Initial RED: `npm test -- tests/p1-core.test.ts` — 42 failed / 2 passed out of 44; missing P1 interfaces and behaviors produced expected failures.
- Additional RED checks found moderate-rank premature bottle usage, completed-but-explicitly-unclaimed tutorial eligibility, and feeding that bypassed seal reaction delay. Each failed before its corrective implementation and subsequently passed.
- Latest targeted command: `npm test -- tests/p1-core.test.ts tests/m3-progression.test.ts tests/ui.test.ts tests/m2-props.test.ts` — 183 / 183 passed.
- `npm run typecheck` — exit 0.
- Full `npm test` at 16:32:04 — 23 files, 545 / 545 passed, retaining all original 427 tests.
- After root's skip/replay reward clarification, the new expected behavior first failed and then passed. Latest full `npm test` at 16:32:40 — 546 / 548 passed; core 49 / 49 passed. The two failures are concurrent audio work: `adopts a decoded override that arrives while the context is suspended` and `keeps builtin scheduling when a decoded buffer source fails to start`. Reported to root; no audio files modified. Parallel `npm run typecheck` exited 0.
- Earlier concurrent snapshot: 509 / 528 passed, with failures owned by assets/render (one each), audio (sixteen), and root UI preparation selector (one). Reported to root without editing those modules; all were green in the subsequent full run.

## Interface decisions and limits

- No fixed interface signature deviations.
- Root approved preservation of the original immediate sprinkler emergency when a live enemy reaches progress 13, including during opening delay. Ordinary placement, summoning and active props observe opening delay. SEALED strategy reactions observe the configured 1.2–2.5 seconds, including feeding; the opening delay may additionally constrain low tiers.
- Root clarified that skip preserves the existing reward claim flag. The tested sequence is skip → replay → first successful completion (+20) → replay → completion (+0). Explicit `tutorialRewardClaimed:false` remains authoritative for finish eligibility, per the fixed helper contract. Legacy played-profile migration and full-test profile still mark claimed true.
- Treasure has both a bubble and a weapon event; audio must deduplicate the same treasure occurrence. Sprinkler has its main event and per-unit tagged purge events; audio must avoid upgrade cues for these purges. Root was notified.
- Counter selection and placements are deterministic tactical heuristics over the current Boss family, path coverage, bend adjacency, central safety and distance. No long-range simulation or balance retuning was introduced.
- Browser visual/audio acceptance and final build remain root integration responsibilities.
