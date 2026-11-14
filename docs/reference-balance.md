# Original balance reference — 2026-11-12

This is evidence from the recovered **Three Kingdoms: Rune Defense / 赵云与阿斗 1.0.10** build. It distinguishes observed original values from timing calculations and the new game's design choices. The original files were read without modification.

## Values relevant to the rebalance

| Question | Original behavior and evidence |
| --- | --- |
| Early enemy HP | Base HP per wave starts **10, 16, 26, 41, 61, 92**. `data.Ty` multiplies the first ten waves by a new-player factor while `player.round < 10`: **0.6, 0.6, 0.6, 0.6, 0.7, 0.7, 0.7, 0.8, 0.8, 0.8**, indexed by completed-match count. Other wave-strategy multipliers can also apply. With round 0 or 1 and neutral wave strategy, runtime returned **6 HP**, speed **50**. |
| Basic troop damage | Level-one 刀: **3 damage**, **0.8-second attack interval**, **1.25 attacks/sec**, hence **3.75 theoretical DPS**. Level-one 枪: **2 damage / 0.8 seconds**, hence **2.5 theoretical DPS**. Six-HP enemies therefore need two 刀 hits or three 枪 hits before range, animation, target availability, or multi-target effects are considered. The HP ratio is a useful reference for the new game's first enemies. |
| Waves and Boss eligibility | The ordinary opening delay is **10,000 ms**. Enemies spawn every **1,500 ms**; after a wave's final spawn the next wave waits **5,000 ms**. Wave counts begin **10, 11, 12, 13, 15, 16**. Boss checks occur only at waves **3, 6, 9, 12, 15, 18**, with respective probabilities **10%, 20%, 30%, 50%, 90%, 100%**. The first tutorial match suppresses Boss checks entirely. |
| Demolition / 拆迁 | Boss type **3**, instantiated as `_0x240ed7`, has **10,000 ms** skill cooldown, speed **10**, and range **800** on an 80-unit tile grid. At the initial six-HP enemy tier its HP is **42** (7× normal enemy HP). Each cast selects **one** empty, unoccupied tile. It returns if none are eligible. No separate numeric cap on blocked tiles appears in the complete terrain handler inspected. It does not select occupied troop tiles. |
| Summon batch | Bench size `map.na` is **5**. Initial battle currency is **20** and the first draw costs **10**. Original costs then rise **12, 14, …**. Runtime confirmed drawing again with all five previous entries still pending succeeds and replaces the whole bench. The user-requested **fixed 10 food for five pets** is an intentional adaptation; it should not be described as the original's recurring fixed price. |
| Shovels | The original base summon pool contains **11 shovels among 108 entries**. When `player.roundDay <= 3`, `draws.UO` adds two shovels: the observed initial pool was **13/110 ≈ 11.8%**. A five-item draw has roughly **0.59 expected shovels** at that initial pool composition. The pool can change as hero fragments are removed or perks apply, so this is not a universal fixed probability. The separate 洛阳铲 passive produces **one shovel every 60,000 ms**. The tutorial's first prescribed batch includes a shovel. |

The original ordinary wave-three eligibility time is **approximately 51.5 seconds**, calculated as `10 + 10×1.5 + 5 + 11×1.5 + 5`. This is a derived nominal schedule, not a directly measured or guaranteed Boss arrival. The opening countdown can finish early when both `nu.Ch` and `nu.Uh` are true; frame timing and pausing can also change wall-clock arrival. Later Boss eligibility remains probabilistic.

The original 垃圾桶 description says “1馒头回收无用文字”; the ordinary redraw cleanup removes old bench entries even without that perk. Its presence is therefore not a prerequisite for the requested discard-and-redraw flow.

## Evidence and reproducibility

Original bundle: `analysis/recovered-game/js/bundle.js`, SHA-256:

`6bb1aecefee97f6fec70757bab8e6b1ef3a47cff9a4161e03acdea249cf5c531`

Source locations below are **zero-based UTF-16 character offsets at the class declaration**, not byte offsets. Exact methods are named for repeatable lookup. `verification/reference-balance-read.cjs` decodes literal Unicode/reversal expressions and simple numeric XOR/helper expressions for focused read-only inspection; it does not execute the original bundle.

| Source class / method | Original class offset | Supports |
| --- | ---: | --- |
| `_0x27e5c5` constructor | 344836 | Enemy HP tables, wave counts, Boss wave/probability tables, Boss stats |
| `_0x46e96a.Ty`, `.Ry` | 636555 | New-player HP factor and Boss HP multiplier |
| `_0x526be7` constructor, `.Wj`, `.$j`, `.qj` | 2165639 | Opening delay consumption, 1.5-second spawns, five-second breaks, Boss check dispatch |
| `_0x37b3fd.nT`, `.rT`, `.KI` | 1621488 | Boss eligibility, probability, ordering, creation |
| `_0x263fe4.init`, `.update` | 1519236 | Boss cooldown conversion to milliseconds and cast timer |
| `_0x240ed7.mw` | 1556986 | Demolition skill event |
| `_0x7fda88.yq` (BattleScene) | 2476229 | One unoccupied-tile selection and terrain mutation |
| `_0x206334.UY`, `.eG` | 2052596 | Currency deduction, escalating price, full bench cleanup |
| `_0x17d2eb.startGame`, `.FO`, `.UO` | 1997239 | Random draw pool and early daily shovel bonus |
| `_0x166b32` constructor, `.YE` | 1420342 | 60,000 ms passive shovel production |

Controlled REA browser observations:

- [Configuration capture](../verification/reference-balance-config-evidence.json): `ev_37c20e120ec7b28c05ade3898b2bc74d7e556e495a9222921be113a442b7a59e`. Original runtime configuration tables and item descriptions.
- [Fresh tutorial capture](../verification/reference-balance-fresh-battle-evidence.json): `ev_c9c327862a3ec87ffbec89dcedb622bbe686ef8191b13d5f7104ecc4b8a4ecba`. Round-zero HP 6 and the tutorial's explicit no-Boss behavior.
- [Mechanics capture](../verification/reference-balance-mechanics-evidence.json): `ev_67dc1f4755386d2d5c62a73ca387df28a8a7837aa8d8e2e600bfc4ea5f39197c`. Runtime timer constants, pool counts, two full-bench draws, and instantiated demolition Boss values; retains complete demolition/cleanup function source strings.
- [Attack-value capture](../verification/reference-balance-attack-evidence.json): `ev_ce7d2ebf30074761e856715001498b1bedb44d903ff13e826ed9c987452be6d5`. Level-one troop damage and attack-interval getters.

The probe served the existing offline test bundle in a temporary browser context on port 4174. Its existing compatibility patch only disables mobile privacy-agreement enrollment; existing test instrumentation exports classes. This investigation added further class exports **only to the HTTP response in memory**, then read their original configurations and methods. It reset the temporary player's equipment/perks for low-rank probes; it did not alter original enemy, wave, attack, draw, or skill definitions. The demolition Boss was deliberately instantiated for inspection; that action does not establish a natural Boss spawn time.

All REA captures above report complete requested capture scope and terminated owned browsers. The investigation's own server was stopped; a final health check returned `ECONNREFUSED` on port 4174. Fresh SHA-256 checks confirmed the original bundle, compatibility bundle, and test bundle still match their recorded hashes in `runner/patches.json` and `runner/test-mode/build.json`. Helpers and captures reside only under this new game's `verification/reference-balance-*` paths.

The broad static REA analysis of the obfuscated bundle reached its 300-second provider deadline (partial Evidence `ev_024cc682bb5c4adaa9b5b33d1308a91739c1eed6dba0e65ec0f2ea0ed4dc614b`). It was not repeated. These findings rely on the focused original-source inspection and controlled runtime captures, not on a claim of complete semantic recovery. Sustained combat DPS, the complete enemy leak/attack model, and a natural long-duration Boss run were outside this bounded probe.
