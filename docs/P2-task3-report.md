# P2 Task 3 implementation report

Status: source implementation complete. Root owns production build, browser/server lifecycle, integration review and commits. No browser/server/Git mutations performed by this worker.

Read `docs/P2-task3-brief.md` first, then the full authoritative `D:/rea_game/design/codex_p2_solo_overhaul_spec.md` before implementation. All writes stayed inside the game directory. No core/render, design, or root baseline edits.

## Implementation

- `src/ui/GameApp.ts`: canvas dimensions come from `STAGE` (640×1216); remove opponent markup, refresh state, identity rendering and import. Pause shows only the player's fragments in one collection. Solo result explanations replace PvP wording, while ranks/leaderboard, existing identity transactions and reward persistence remain.
- Summon labels, accessibility labels, shortage labels and failed-command toast variables derive from `getSummonCost(player.summons)`. A failed redraw leaves the pack and summon count untouched through the existing core transaction. Shortage and total price are distinct values, including partial funds. Example after two draws: 4 food yields `count:10,cost:14`.
- Bench shovel placement uses `engine.move`; pouch click, keyboard activation and pointer release use `engine.storeShovel`. A consumed selected ID is cleared before notify/refresh. Full-pouch and invalid placements retain the tool and surface the core's specific toast. Ordinary pet drops over the pouch remain harmless cancellation; an ordinary pouch click toggles the stored-shovel mode.
- `hint.repairProgress` now triggers shovel audio and step-2 digging progress, like completed digging/repairs. The tool inspector avoids `getUnitStats`, omits level/combat fields and provides a pouch storage action.
- `src/ui/stickers.ts`: `unitSticker('shovel')` now routes to the existing shovel scene sprite/vector fallback. Previously it silently fell back to a hamster, including when optional art was unavailable.
- `src/ui/TutorialView.ts`: scan all solo rows/columns and calculate percentages with `STAGE.width/height`; use current bench and shovel positions; exclude tools from merge targets. Tutorial refresh stamping now includes grid and relevant unit changes so anchors can update after placement, repair, merges or language switching. Existing persistence-before-adoption and completion reward deduplication are preserved.
- Keyboard cell buttons cover all 42 cells, row 0..6 and column 0..5, with six CSS columns. Tool nest accessibility labels omit combat levels.
- `src/ui/p1.css`, `m2.css`, `m3.css`, `styles.css`: clean aspect 640/1216 and center width `min(calc((100dvh - 58px)*.526316),calc(100vw - 18px),520px)`. Rebase top HUD/boss, sprinkler, bottom actions, props, passive icons, tool hints and sealed hints to the new canvas. Remove obsolete opponent styling and half-board/mobile sealed-hint positions. Solo pause loot uses one column.
- `src/i18n/en.ts`, `zh-CN.ts`, `p1.ts`: resolve `unit.shovel`, tool inspector/storage, repair-progress, stored/full/tool-only and exact `hint.redrawn` translations. Preserve Task2's `render.dig` entries (`铲` / `DIG`). Guides explain 10→12→14 escalation, nest shovel use/storage, 55-second base regeneration/cap 4 and two-step repairs. Remove stale opponent/half-board/winner-takes-both wording; retain compatibility keys with solo text.
- `src/config/props.ts`: exact Feast Pass names and +4 orange/+15% pest HP description; Hyper Party +38% pet attack speed/+12% pest speed; auto shovel 55s→30s and cap 4→6; recycle-bin description distinguishes a nest shovel's +4 food.
- `tests/p1-ui.test.ts`: update only two P2-invalid fixtures: 18-second preparation midpoint (9/18), and deployment to current open mat (1,1). Other P1 tests retained.
- `tests/p2-ui.test.ts`: real engine/GameApp command and rendering integration behind a minimal DOM/audio boundary. Includes dynamic prices/failed redraw atomicity, selected/dragged/clicked/keyboard tool routing, harmless pet drop, invalid/full retention, immediate consumed-selection clearing, partial repair cue/tutorial progress, no tool combat stat access, all keyboard cells, tutorial anchors, save failure/retry/replay/skip reward behavior, solo markup/loot, translation cleanup and optional-art shovel identity.

## RED evidence

Command:

```text
npm test -- tests/p2-ui.test.ts
```

Initial run (23:04:26):

```text
Test Files  1 failed (1)
Tests       10 failed (10)
```

Missing-feature failures observed: old height 1386; redraw stayed at cost 10 instead of 12; pouch click/drag left inventory at 1 instead of 2; consumed shovel selection retained ID 1; tool inspector called combat stat access; tutorial used old row/height geometry; tool keys exposed `unit.shovel`. The tutorial persistence case also initially failed because the test supplied global localStorage while production reads `window.localStorage`; corrected that browser boundary without changing production persistence. It then passed as a regression check.

Additional actual RED after discovering the shovel UI icon issue (23:11:19):

```text
Test Files  1 failed (1)
Tests       1 failed | 13 passed (14)
keeps the shovel identity in UI icons when optional sprites are unavailable
Expected data-sticker="shovel"; received data-sticker="hamster".
```

Fixed by routing shovel through `sceneSticker`, then verified GREEN below.

## Final GREEN evidence

```text
npm test -- tests/p2-ui.test.ts tests/p1-ui.test.ts tests/ui.test.ts tests/m2-i18n.test.ts tests/m3-i18n.test.ts tests/p1-sound.test.ts tests/m3-sound.test.ts

Test Files  7 passed (7)
Tests       100 passed (100)
Start at    23:11:27
```

```text
npm run typecheck
tsc --noEmit
Exit 0, no diagnostics.
```

```text
npm test

Test Files  27 passed (27)
Tests       668 passed (668)
Start at    23:11:29
```

All final commands exited 0. Vitest prints only its normal transform-cache performance suggestion after the full suite.

## Remaining verification and concerns

No known source/interface blockers. Root should run the prepared browser QA and production build, including actual 390×844 menu fit, tutorial language changes, shovel pouch drag/click, sprinkler center (84,898), tool/repair overlays and bottom action y1080..1188. This worker did not claim browser visual acceptance. No sound-module changes were necessary; partial repair uses the existing shovel cue. No profile migration or reward algorithm changes were made.

## Integrated screenshot fix, round 1 (baseline ce97bf9)

Inspected `verification/p2-mobile-sunny_backyard.png` and `verification/p2-desktop-combat.png` before editing. Confirmed the nest heading at x48 and right-aligned count at x592 intersected the sprinkler/pouch toolbar shapes on the y930 label row. Confirmed the desktop bottom-center toast crossed the summon action. The mobile toast was visible below the stage.

Changes within root's narrowly extended ownership:

- `src/render/StickerRenderer.ts`: change only the nest header/count horizontal layout. Heading starts at x144 (benchX + benchSize), occupancy ends at x500 (shovelX − 56). Reserve 52px at the right for count and separation; cap heading at 304px wide. Both labels remain on y930, in the clear x140..500 strip between the tools. Exact STAGE, canvas, tool shapes and input hit geometry remain unchanged.
- `tests/p2-render.test.ts`: one focused render regression exercises real canvas text output for both languages and both empty/full occupancy. Checks that heading/count avoid both tool extents and each other.
- `src/ui/p1.css`: at viewport widths ≥1100px, anchor the clean-mode notification at viewport center +284px, in the right gutter beyond the stage's maximum 260px half-width plus 24px spacing. Right margin 16px and max-width 320px allow long text to wrap. Below 1100px, including 390px mobile, keep the previous visible bottom-centered toast and pointer behavior.

RED, before renderer change:

```text
npm test -- tests/p2-render.test.ts
Test Files  1 failed (1)
Tests       1 failed | 47 passed (48)
Start at    23:16:35
Failure: nest heading x48 was below the required clear-strip minimum x140.
```

GREEN, after both fixes:

```text
npm test -- tests/p2-render.test.ts tests/p2-ui.test.ts
Test Files  2 passed (2)
Tests       62 passed (62)
Start at    23:16:54

npm run typecheck
tsc --noEmit
Exit 0, no diagnostics.
```

No full-suite rerun, browser/server lifecycle, Git mutations or art changes in this round. Root must re-capture the two layouts and check actual computed toast geometry; this worker did not claim a fresh screenshot acceptance.

## Integrated screenshot fix, round 2 (review baseline e587ada84232c73a62a263fe87ffee9f4ca7ea8b)

Inspected `verification/p2-browser-failure.png` before editing. Confirmed the 1024×900 bottom-center notice intersected the summon button. The round-1 fixed width breakpoint was insufficient because actual exterior space depends on both viewport dimensions and the resulting stage size.

Replaced the breakpoint with measured placement in `src/ui/GameApp.ts`, keeping all stage geometry unchanged. Each visible notice refresh reads the actual stage rectangle and available viewport width. A right gutter with at least 120px of usable text width is preferred, followed by a left gutter. The notice stays 16px from the stage and viewport edges and uses at most 320px width, with wrapping. The actual notice height is measured after width and translated text are updated. With no readable side gutter, bottom-center placement is retained if the notice fits below the stage with at least 4px clearance. If a short/narrow viewport has neither exterior space, the notice moves to the upper board below HUD controls, away from the bottom actions. Subsequent normal refreshes handle resizing and language changes; switching to developer mode clears the inline placement and restores its existing CSS behavior.

`src/ui/p1.css` removes the ≥1100px breakpoint entirely and retains readable wrapping. `tests/p2-ui.test.ts` adds six real GameApp refresh cases against measured browser-boundary fixtures: 1440/1024/900/800 wide layouts (including 90px/140px wrapped heights), 390×844 bottom clearance, and a visible notice resized to 390×600 with no exterior gutter. These assert viewport containment, separation from stage actions, text-width bounds, and live language/height handling.

RED before implementation:

```text
npm test -- tests/p2-ui.test.ts
Test Files  1 failed (1)
Tests       6 failed | 14 passed (20)
Start at    23:23:17
Failures: no measured gutter placement or short-viewport repositioning.
```

Final GREEN:

```text
npm test -- tests/p2-ui.test.ts tests/p1-ui.test.ts
Test Files  2 passed (2)
Tests       37 passed (37)
Start at    23:23:58

npm run typecheck
tsc --noEmit
Exit 0, no diagnostics.
```

No full-suite rerun, core/art changes, browser/server lifecycle or Git mutations. The accepted round-1 nest label change is untouched. Root retains browser recapture and actual toast/action intersection verification. The explicit upper-board fallback can briefly cover combat art only when neither a readable side gutter nor sufficient bottom clearance exists; it keeps HUD and bottom action controls clear without resizing the stage.
