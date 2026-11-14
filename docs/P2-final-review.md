# P2 final whole-branch review

Reviewed 2026-11-13 (America/Los_Angeles).

Scope: P1 `319ea6c791c50004d55f2b6d3ca6f1cd33f369b7` through the supplied current P2 tree, including source through `c430c56` and staged art/QA/documentation; supplied staged tree `fe785a7bdc76ee65e27cc191070ddcff2b66c7d0`. Authority: the read-only `D:/rea_game/design/codex_p2_solo_overhaul_spec.md` and `docs/P2-final-review-brief.md`. This was one final review, with no delegated reviewers, source edits, index/HEAD changes, or server/browser lifecycle changes.

## Strengths and alignment

- Exact stage dimensions, all four route matrices and endpoints, escalating draw prices, initial resources, preparation, bee/shovel production and wave constants match the specification. Dynamic endpoint handling is consistent across arrivals, rescue effects, boss summons and guardian rendering. Active AI simulation and settlement are removed while inert compatibility fields remain.
- Tool commands validate before consuming resources. Failed redraw and full-pouch storage preserve the current pack/tool; bench tools support digging, partial repair, storage and swapping. Combat, training and merge filters are explicit. UI command handling clears consumed selection, and pointer/tap/keyboard paths converge on the same commands.
- Shared combat configuration, separate weapon/effect rendering, calibrated sprite axes, rarity sizing and procedural fallbacks form a coherent rendering change. New slash metadata and projectile themes survive removal/movement of their source; damage remains engine-owned. The last empowered Puss charge is captured before consumption rather than inferred from unrelated critical damage.
- Reward creation uses player loot only and the specified food conversion cap. The existing battle receipt and profile persistence path remains intact; successful profile identity changes dispose of the old battle before subsequent frames can award it. The controlled final-wave browser check actually traverses the engine/UI/save path and checks coins, loot, stars, ticket and reload persistence.
- The changed regression tests generally replace obsolete geometry/economy/opponent expectations while preserving real hero, weapon, boss and prop behavior. Exact map fixtures, command-state comparisons, attack rendering checks and real browser input supplement each other. The reported 675 tests are not treated as a substitute for those checks.

The documented choices are reasonable: zero loss coins is permitted; +4 shovel recycling is specified; explicit weight 10 with the existing 100 total pet weight is preferable to silently changing unspecified pet probabilities to force the prose approximation of 9.5%.

## Findings

### Critical

None.

### Important

None.

### Minor — occupied nest falsely signals an invalid shovel swap

**Location:** `src/render/StickerRenderer.ts:415` (with the valid swap contract at `src/core/MergeSystem.ts:11`).

Dragging a bench shovel over an occupied pet/shovel nest, or dragging a bench pet over a shovel nest, marks the nest with the invalid red fill/border solely because either item is a shovel. These are legal bench swaps. The release succeeds, but the preview tells the player that the supported action will fail and makes the new tool interaction less discoverable.

A focused read-only runtime probe transpiled the current modules in memory, rendered the occupied target nest, then called the real engine move. It returned:

```json
{"redInvalidNestFills":1,"moveResult":{"ok":true,"key":"hint.swapped","unitId":1},"slots":[["shovel",1],["hamster",0]]}
```

Use the actual combine/swap outcome to determine the invalid state, while retaining rejection for a board pet targeting a bench shovel. Add a focused renderer assertion for valid shovel/pet bench swaps and the invalid board-to-shovel case. This is a presentation issue; no item or resource is lost.

## Evidence and limits

Reviewed the supplied diff, current changed source, relevant regression tests, QA scripts, verification/progress documents and machine-readable reports. Visually inspected the desktop combat, mobile kitchen/maze, English tutorial and missing-art screenshots; they show a coherent single board, legible tools/actions and the intended held weapons/effects. The supplied reports additionally cover all four maps, 1440/1024/800/390 viewport widths, production mode and profile identity cases.

Broad test/build/browser suites were not rerun, per the review brief. Their passing results remain supplied execution evidence: 675/675 tests, typecheck/build success, ten browser groups, production and HTTP-subdirectory assets, four profile identity cases, and the 2298-file protection/art hash check. The asset registry's relative base and the production fixture's requested-path assertions support the subdirectory result. The isolation script/report support the protected-file claim; this review did not independently recapture the baseline.

Controlled battle fixtures and static screenshots establish implementation and selected visual states, not natural-play ten-wave difficulty, long-session performance, or frame-by-frame animation quality across every browser/device. No broader balance or cross-browser guarantee is inferred from them. These are evidence limits, not additional acceptance conditions invented for this change.

## Declined to judge

None. No considered behavior was silently excluded as outside the plan/spec.

## Verdict

**Spec alignment: PASS, with one minor presentation defect.**

**Code quality: APPROVED with the minor finding above; no Critical or Important blocker. Ready to merge: yes.** The solo engine, economy/tool lifecycle, rendering and persistent progression integrate consistently with the specification. Correcting the target preview would remove the remaining discrepancy between legal input and its visual feedback.
