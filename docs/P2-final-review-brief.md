# P2 whole-branch review brief

Review the completed P2 branch against P1 commit `319ea6c791c50004d55f2b6d3ca6f1cd33f369b7`. The authority is `D:/rea_game/design/codex_p2_solo_overhaul_spec.md`, plus the user's detailed P2 instructions. Read-only access to that document and source art is permitted; all writes remain inside this game directory.

This is the broad final review, after task-scoped reviews of core, renderer and UI. Read `docs/P2-progress.md` for explicit rulings and any unresolved findings; judge them on their merits. The final diff package is supplied separately, excluding binary PNG bodies and historical review-package duplicates. The visual and runtime evidence is in `docs/P2-verification.md` and the linked reports/screenshots. Tests in those reports need not be repeated absent a concrete untested concern.

Binding constraints:

- Only `D:/rea_game/games/capybara-defense/` may change. Root baseline and `D:/rea_game/design/` stay read-only. Keep port `127.0.0.1:4175`, relative production asset paths and `capybara_defense_v1:` storage compatibility, including normal/test-profile identity isolation.
- Exact 6×7 player-only board, stage constants and four supplied routes/endpoints. No active opponent waves, deployments, guardian, ribbon or AI loot settlement. Victory clears ten waves with oranges left; dynamic endpoints govern arrivals, rescues, boss summons and guardian art.
- Exact escalating five-card cost, 22 initial food, 18-second preparation, explicit wave/kill/bee/shovel economy. Tool weight10 and pack cap2; safe failed redraw; grass digging, staged two-shovel repairs, pouch storage and bench swaps; tools excluded from combat/merge/training effects and recyclable.
- Single-player feast/party modifiers; all preexisting hero, weapon, prop, boss, progression, tutorial receipt and save compatibility behavior retained unless P2 explicitly changes it.
- Actual equipped/default board-held weapons, specified scales/style motion, calibrated directional art, melee slash/thrust instead of projectile dots, themed ranged/magic projectiles, captured attack presentation, hit/death/food feedback and optional-image fallbacks.
- Exact source145 PNGs and manifest, four768×896 maps. Chinese/English UI with dynamic cost and shortage, translated tool actions and no stale opponent/half-board copy. Desktop1440×900 and mobile390×844 clean views and input fit the stage.

Pay particular attention to cross-layer transitions that task reviews could not fully establish: an attack source being moved/merged; consuming a selected bench shovel through click/touch/keyboard; failed storage/redraw preserving state; relative asset URLs in the built bundle; and final-wave rewards reaching persistent profile exactly once. Review test quality and captured browser evidence rather than counting assertions alone.

Return spec and quality verdicts, concrete findings with file/line and severity, and limitations of the available evidence. Do not edit product source, run servers, change Git state, or dispatch subagents. Write the review to the report path supplied by root.
