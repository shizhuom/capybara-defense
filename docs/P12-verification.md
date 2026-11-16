# P12 verification — crest settlement, storybook pause and continuous animation

Date: 2026-11-15 (America/Los_Angeles).

The accepted P11 version is preserved in local commit `ead6dcb` on `p11-storybook-hub`. P12 is implemented on `p12-crest-puppet-animation`. All code, tests, logs and captures are inside this game directory.

## Delivered

- Full-viewport transparent victory/defeat presentation: winged shield, orange-based 1–3-star rating (zero lit stars on defeat), ribbon title, rank progress, coins/ticket/fragments, return and continue buttons.
- Battle report stays in the DOM, initially hidden. It includes MVP, effective damage/kills, collected fragments, promotion/protection/streak notes and newly unlocked units/weapons/avatars. Opening it makes background controls inert; Escape closes it and restores focus to Stats. Toggling does not award rewards again.
- Cocoa storybook pause: towel Capybara, two cream cards, exact one bare `<section>` compatibility, resume/profile/settings/surrender. Large loot collections scroll inside the panel while actions remain reachable.
- `SpritePuppetAnimator.ts`: one canonical source image, six overlapping torso bands and three paired leg bands, delayed spine sway, alternating elliptical steps. Flyer/roller lower bodies stay whole. The 17 `_walk2` assets remain on disk but are never requested by enemy rendering.
- `EnemyMotion.ts`: seven distinct locomotion families, smooth turns, spawn pop, damped hit deformation, boss roar, frozen gait while stunned and complete pause freezing.
- `EnemyAccents.ts`: animated translucent wings, machinery rings/sparks and landing ripples.
- `UnitMotion.ts` and held-weapon poses: breathing/head lag, smooth facing, deployment/merge pop and anticipation/strike/recovery. Original weapon mappings, full sweeps, 28px spear extension and 10px recoil remain tested.
- `CombatEffects.ts`: dying enemy art rolls upward along a parabola before smoke and stars. Existing hit, projectile, food and captured weapon effects remain intact.
- Eight P12 sprites plus distinct offline SVG fallbacks, bilingual copy and final-layer `p12.css`.

## Automated verification

| Check | Result |
| --- | --- |
| `npm run sync-assets` | 217 PNGs and 217 unique manifest IDs; source/target byte match |
| `npm test` | **1,151 passed across 61 files** |
| `npm run typecheck` / `npm run build` | Passed; 94 production modules |
| New P12 tests | 78 cases across six files, with observed RED→GREEN cycles |
| Desktop/mobile UI run | 32 bilingual layout states, 36 screenshots, zero console/page errors |
| Large-content stress | 15 checks/screenshots across three viewports; longest English rank, 36 distinct fragment rows, all 36 weapon unlocks |
| Production bundle | Root and nested relative paths; 217 PNG requests, no debug bridge, tutorial and saved-profile reload verified |
| Isolation | 2,429 protected files unchanged; no protected additions; parent tracked diff empty |
| Audio | SoundManager.ts, MusicTracks.ts, AudioGestures.ts unchanged against pre-P12 byte hashes |
| Whitespace | `git diff --check` passed |

Legacy tests were updated only where P12 intentionally replaces two-frame rendering, fixed hit scaling, old settlement stickers or asset catalog size. Gameplay, economy, storage and audio test behavior was retained.

## Browser and animation evidence

Chromium viewports: 1366×768, 1920×1080, 844×390 and 390×844. Both Chinese and English were exercised. Checks include actual dialog geometry, horizontal content overflow, image decode, bold text, return/retry, report focus, profile-to-pause return and byte-identical paused canvas snapshots.

Screenshots are in `verification/`:

- `p12-desktop-zh-CN-victory.png`, `p12-desktop-en-defeat.png`, `p12-desktop-en-stats.png`
- `p12-mobile-landscape-en-pause.png`, `p12-mobile-landscape-zh-CN-victory.png`
- `p12-mobile-portrait-en-victory.png`, `p12-mobile-portrait-en-stats.png`
- `p12-continuous-combat-0.png` through `p12-continuous-combat-3.png`
- `p12-edge-*-pause-end.png`, `p12-edge-*-report-end.png`, `p12-edge-*-rank.png`
- `p12-production-*.png`

Reports: `p12-browser-report.json`, `p12-edge-report.json`, `p12-production-report.json`, `p12-isolation-report.json`. In total, **54 final captures** cover ordinary UI, combat, content stress and production pages.

The pure geometry test samples 60 consecutive poses and verifies distinct continuous output, source bounds, overlap and bounded per-frame displacement. A local headless Chromium Canvas benchmark with **28 enemies + 12 allied units** measured 210 warm samples: **median 1.90ms, P95 2.40ms, maximum 7.20ms** against a 16.67ms frame budget. This measures render submission on this desktop, not sustained physical-phone GPU/compositor frame rate. Real iOS/Android hardware performance remains unmeasured; mobile viewport layout and interactions were verified.

## Review decisions

A fresh independent read-only review found no Critical or Important product bugs. Its additional large-content QA request was completed: every final row/unlock can be reached and the controls remain on-screen. Final CSS was recaptured and inspected after typography/alignment fixes.

- Keep `flipX` as the target-facing compatibility field; render only the interpolated `visualFlip`. This avoids changing logical direction consumers.
- Smooth the hopper's crouch/flight/landing transitions over small phase intervals while retaining the specified plateau values, preventing an abrupt squash discontinuity.
- Preserve the initial supplied scene time for existing procedural effects, then accumulate only unpaused deltas. Paused wall time cannot advance the scene; standalone motion callers also discard a large resumed clock gap.

These rendering-only decisions do not change simulation position, damage, speed, charge, rewards or saved data.

## Run and repeat

Launch `Start-Capybara.cmd` or open the existing service at `http://127.0.0.1:4175/`.

```text
npm test
npm run build
npm run test:browser
node scripts/p12-isolation-check.mjs
```

Browser QA uses fresh isolated browser contexts and test fixtures; it does not replace the user's normal browser save. Generated browser profiles and temporary logs stay in `.runtime/` inside this project.
