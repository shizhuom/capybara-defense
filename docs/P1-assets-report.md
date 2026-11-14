# P1 assets and Canvas report

Status: implemented and frozen for root browser acceptance.

## Files and behavior

- `src/render/AssetRegistry.ts`: shared `assets`, loaded-only `hasSprite`/`spriteUrl`, cancellable once-ready notification (including late subscribers), unique safe IDs, BASE_URL-relative paths, non-DOM/offline/decode fallback. Existing Canvas-compatible `get` retained.
- `src/ui/stickers.ts`: external PNG selection for units, mobs/Bosses, all 20 props and four scene helpers; 20 distinct cream-board geometric prop SVGs; distinct SVGs for all 12 Bosses and five mobs; built-in shovel/sprinkler SVGs. Existing unit art/icons remain the ordinary-unit fallback. Unsafe IDs/sizes normalize safely.
- `src/render/M3Art.ts`: signatures and fallback `data-sticker` markers retained. All 36 weapons prefer prefixed IDs then direct aliases; all 16 avatars prefer prefixed PNGs, retaining original distinct SVG geometry when missing.
- `src/render/StickerRenderer.ts`: shared registry; clipped map first, no G/R/S/C flat-block repaint, dynamic map-specific/generic open tiles and broken tiles, soft cream fallback mats, readable grid/interaction overlays. Supports all object/unit/enemy art and live orange stacks/animations. External sprinkler replaces its vehicle geometry while preserving water jets and captured path. M2/M3 event/status/energy/level behavior and hit coordinates remain.
- `StickerRenderer.ts` also consumes core `getMergeTargets` for all valid board and bench candidates, from selected or dragged sources. Green pulse/▲ for upgrades; double gold rings, rotating stars and translated capsule for hero recipes. Tool modes suppress suggestions. Bench rings render after nest backgrounds. Twelve heroes have double-ring gold disks with themed inner fill and near-full-charge pulse in both zones. Existing rival AI text/checkmark is suppressed only when `state.opponent` exists; ribbon and loot chip remain.
- `scripts/sync-assets.mjs`, `package.json`: zero-dependency callable/CLI synchronization, safe lowercase regular PNG files only, sorted manifest, absent/empty source succeeds, existing destination images retained. Source is read-only.
- `public/sprites/README.md`, `manifest.json`, and synchronized PNGs: full ID catalog, dimensions, alpha and composition guidance. Tests: `tests/p1-assets.test.ts`, `tests/p1-render.test.ts`.

## Source and synchronized catalog

Initial dispatch described `design/assets/sprites` as absent. It was externally populated before the synchronization command; this task did not create or modify it. Root confirmed external addition and continued read-only use. `npm run sync-assets` copied **133** valid source PNGs; destination manifest contains **133** alphabetically sorted IDs. Categories: 4 maps, 2 dynamic tiles (`tile_open`, `tile_broken`), 5 objects, 19 basic/component units, 12 heroes, 5 mobs, 12 Bosses, 20 props, 36 weapons, 16 avatars, 2 main illustrations. Unknown IDs: **0**. Optional map-specific tile aliases are documented and supported but not present in the source set.

## Test evidence

- RED: initial five asset tests failed for missing ready/lookup methods, missing helper module and missing sync script. Initial Canvas run: 21 failures/2 passes, covering shared registry, external maps/objects, target highlights and hero disks. Additional Boss/tool fallback and sprinkler replacement tests failed before their implementations.
- GREEN: targeted assets + P1/M2/M3/drop-target render suites: **75/75 passing**, most recently 2026-11-13 16:32 local tool clock.
- Full `npm test`: **545/545 passing across 23 files** at 16:31. No remaining unrelated concurrent failures in that complete run. An earlier in-progress typecheck saw root/core/audio interfaces still being implemented; the later complete typecheck passed.
- `npm run typecheck`: exit 0. `npm run build`: exit 0, Vite built 55 modules. `npm run sync-assets`: exit 0 twice on actual 133-file source. Fixture tests exercise two identical syncs, missing and empty source, safe-name filtering, retained destination files, stable sorted content and game-local cleanup.
- Mocked image boundary tests verify failed PNG remains fallback, pending IDs remain hidden, non-DOM loading resolves, duplicate/unsafe IDs do not request extra paths, loaded image markup works across categories, late readiness notification works. Recorded Canvas tests cover all four maps and all 12 hero bases in both zones; existing M2/M3 semantics remain tested.

## Interfaces and remaining acceptance

No shared contract changes or out-of-ownership source edits. No Git writes or server lifecycle operations. All writes stayed inside the game directory. New convenience class methods `has`, `url`, `onReady` support the required shared helper exports without changing existing API behavior. No `P1Effects.ts` was needed.

Root owns final browser screenshots/real-image visual acceptance, mobile layout, HTML opponent banner and localized `p1.merge`. Unit tests use controlled image boundaries plus recorded Canvas calls; they do not replace real-image screenshot review. The actual source PNG set is now present, while the full missing-image fallback remains implemented and tested.

## Review Round 1: synchronization target links

Implemented the boundary correction from `docs/P1-assets-review.md`. Before directory creation, the callable and default CLI target must resolve lexically within the game directory, and every existing target ancestor is checked with `lstat` to reject symbolic links and Windows junctions. After creation, `realpath` verifies the physical target is still within the physical game directory. Before any image/manifest content is written, the complete batch is checked for existing linked PNG targets and a linked `manifest.json` (including dangling links); existing destination PNG links are also rejected even when not copied from source. The source remains read-only.

Preserved the unmodified prior script at `.runtime/p1-sync-before-fix.mjs` for root's minimal diff. Production changes in this round are limited to `scripts/sync-assets.mjs`; tests changed only in `tests/p1-assets.test.ts`, plus this report. No design, renderer, service or Git changes.

RED evidence: `npm test -- tests/p1-assets.test.ts` at 16:39:12 reported **4 failed / 6 passed**. The new PNG-link, manifest-link, target-directory-junction and ancestor-junction fixtures all reproduced the old behavior: synchronization resolved rather than rejecting. All link targets and protected files were inside game `.runtime` fixtures. Cleanup unlinks each exact link before recursively removing its verified game-local fixture.

GREEN evidence: `npm test -- tests/p1-assets.test.ts` at 16:39:38 returned **exit 0, 1 file passed, 10/10 tests passed**. Each new fixture asserts that rejection leaves both protected PNG and manifest bytes unchanged. `npm run sync-assets` returned **exit 0** with `Sprites: copied 133; manifest contains 133 images.` No whole-suite rerun or server operation was performed in this review round, as requested.

This correction rejects existing links; concurrent hostile filesystem replacement between validation and writes is outside the local asset synchronization workflow's guarantees.
