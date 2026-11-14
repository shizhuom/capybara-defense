# P2 final minor fix report

Reviewed and fixed the sole Minor finding from `docs/P2-final-review.md` against the supplied staged baseline tree `fe785a7bdc76ee65e27cc191070ddcff2b66c7d0`.

## Change

`src/render/StickerRenderer.ts` now determines occupied nest invalidity using the existing `MergeSystem.combine` result, rather than rejecting every interaction involving a shovel. Bench shovel-to-pet, pet-to-shovel and shovel-to-shovel swaps receive the valid hover appearance. A board pet targeting a bench shovel remains invalid through the real combine rule. The preview also checks either unit's washing state, matching the guard in `BattleEngine.move`; merge-lock rejection continues to come from `MergeSystem.combine`.

The read-only design specification's section 3.2 shovel lifecycle and prop restrictions were consulted. No core or economy behavior changed.

## Focused verification

Added 11 renderer cases in `tests/p2-render.test.ts`. They inspect the occupied target nest's actual canvas fill and border, then execute the real engine command to verify the expected result and unit placement or lack of mutation:

- Three legal bench swap directions, including shovel-to-shovel.
- An ordinary valid pet merge.
- Rejected board-pet-to-bench-shovel movement.
- Source and target washing restrictions, including both pet/shovel bench directions.
- Source and target merge locks on otherwise mergeable pets.

RED: `npm test -- tests/p2-render.test.ts` failed on the expected preview assertions: three legal shovel swaps were red, and two washing-pet previews were incorrectly valid. Result: **5 failed, 54 passed**.

GREEN after the renderer change: the same command passed **59/59 tests**. `npm run typecheck` also passed with exit code 0.

## Scope and limits

Only `src/render/StickerRenderer.ts`, `tests/p2-render.test.ts` and this report were written. No files outside the game, core/economy files, Git state, server or browser lifecycle were changed. Broad tests and builds were intentionally left to the parent task, as directed. No remaining concern identified within this focused change.
