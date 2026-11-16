# Melee / ranged balance implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement the following checks in order.

**Goal:** Give short-range animals a worthwhile damage advantage while preserving ranged coverage and every existing combat/economy feature.

**Architecture:** Change shared base-stat data, correct Meowfia's self-refreshing ultimate cycle in BattleEngine, and keep both the compendium and live card on the existing shared stat functions. A headless deterministic benchmark measures plain attack DPS, sustained skill-cycle DPS, and map-path damage before/after. Do not infer real DPS from damage × attack speed alone.

**Tech Stack:** TypeScript, Vite SSR, Vitest, existing Canvas UI.

**Spec:** User's request on 2026-11-15: compare current melee/ranged DPS and rebalance their practical performance.

## Constraints and design

- All writes stay inside `D:/rea_game/games/capybara-defense/`.
- Preserve the existing P12 changes. No modifications to SoundManager, MusicTracks, AudioGestures, design sources, map geometry, enemy difficulty, economy, draws, save data, progression, or weapon effects.
- Melee trades short range for more damage; ranged retains its targeting coverage. Avoid a blanket ranged nerf.
- Current Lv.1 normal DPS: hamster 15, squirrel 11, hedgehog 11.9, corgi 12; melee heroes about 53–55 and ranged heroes about 51–54, despite about half the range.
- Confirmed malfunction: Meowfia's four-times attack speed recharges its ultimate during that same buff and refreshes it forever. Keep the four-times burst and its normal/awakened durations; pause its energy gain during that burst.
- Candidate tuning to validate: hamster damage 12→16/range 1.35→1.6; corgi damage 16→22/range 1.5→1.7; Kungfu Po damage 38→50/range 1.6→1.8; Puss damage 27→34/range 1.6→1.8; Samurai damage 67→86/range 1.6→1.8; Ronin damage 50→61/range 1.8→2.0. Attack rates and the ranged/magic base stats remain unchanged. Final values depend on path simulations.

## Review focus

- Normal and signature-awakened Meowfia must exit its burst, including at high level with attack-speed props/weapons.
- Damage buffs must not silently change basic rates, level multipliers, draw probabilities, or enemy HP.
- Sustained dummy results exclude movement/control utility and overkill; path results must state placement, enemy stream, and seed rather than claiming universal DPS.
- Shared catalog/live-card stats must agree after tuning, including equipment and wet status.
- Existing numerical assertions should be updated only where the intentionally changed base stats affect them; retain independent behavior checks.

## Tasks

- [x] Capture baseline with a reusable test-only combat benchmark and preserve before results.
- [x] Add a failing regression for self-refreshing Meowfia bursts and measurable melee role targets.
- [x] Tune shared data; stop energy gain during Meowfia's buff; update its bilingual skill explanation.
- [x] Compare all four maps, low/high levels and signature equipment; adjust only if measurements justify it.
- [x] Update affected exact-number expectations; run full tests, typecheck and build.
- [x] Browser-check live stats and the revised burst cycle, record before/after data and isolation checks.

## Execution record

- Baseline captured before production edits. New regressions: 10 failed ? 10 passed. Full suite 1161 passed; typecheck/build passed. Desktop/mobile live-stat and burst-cycle QA passed.
- Final review: fresh read-only reviewer found no blocking issues. Minor observation: Ronin reaches the existing tall_perch eligibility boundary; accepted and documented in the balance verification report. No rule changes or further redesign.
- Ruling: retain the candidate tuning after four-map measurements reduced the ranged/magic group advantage from about 58% to 15% in the controlled stream. Cost/limit: dense control-heavy lineups still differ; this is not a universal win-rate guarantee.
- No commit or parent-repository mutation was needed for this task. Preserved the uncommitted P12 work and copied pre-change balance files into game-local .runtime.
