# P1 Audio 独立审查

审查范围：`docs/P1-task-audio.md`、`docs/P1-contracts.md`、`docs/P1-audio-report.md`、提供的 `docs/P1-audio-review-diff.txt`，以及 diff 涉及的音频实现、测试和 manifest 文档。权威需求为 `D:/rea_game/design/codex_p1_polish_spec.md` 第 4 节。未修改实现、未全仓漫游、未重复运行已通过的整套测试。

## 结论

- **规范符合：通过（音频单任务范围）。** 三态多轨、84/108/124 BPM、单 context/调度器、模式淡入淡出、独立音量与 duck、canonical cues/M3 aliases、命中全局限流、事件职责和可选外部覆盖均有对应实现。
- **代码质量：通过。** 未发现需要退回修改的重要正确性或资源生命周期问题。异步边界具备 dispose 防护，音源数量与 arrangement bus 数量有上限，失败路径能回退合成或安全静默。

**重要问题：无。**

## 核对依据

- **真实编曲与调度：** `src/ui/MusicTracks.ts:3` 定义三档速度；`:10` 的 menu 为大七/九和弦琶音与低通长 pad；`:17` 起 battle/boss 分别包含 lead、bass、过滤白噪打击，boss 另有下滑低鼓。`src/ui/SoundManager.ts:135` 按 AudioContext 时钟、八分音符长度及有限 lookahead 调度，超过时钟的旧节拍跳过，避免恢复后补发音符风暴。`:74`、`:90` 分别复用 context 和唯一 interval。
- **切换与音量：** `src/ui/SoundManager.ts:114` 同时淡出旧 bus/voice，最多缓存三个 mode bus，给旧 source 安排停止；新模式淡入。`:104` 将外部与合成音乐统一送入 music master，overlay/hidden 降至 15%，SFX 走独立 effects master；音量归零直接写 0。
- **限流与事件职责：** `src/ui/SoundManager.ts:29`、`:198` 以同一个 canonical cue 时间表约束所有 hit 来源，95 ms 边界不会被 battle ID 重置；重新启用 SFX 清空历史，首个 hit 可发声。`:208` 以 battle ID/event ID 去重，消费 core 提供的 boss_spawn/treasure，排除 legendary 与 sprinkler purge 的升级音；UI command cues 未在消费器重复触发。
- **覆盖与回退：** `src/ui/SoundManager.ts:34` 拒绝绝对路径、目录穿越、编码分隔符、query/fragment 等输入；`:224` 只请求已声明且允许的 key/path，解码后进入同一个 context/master graph。解码/获取失败保留内置编曲，buffer source 启动失败也退回合成。`public/audio/manifest.json` 为 `{}`，默认不会请求不存在的曲目。显式声明不存在的文件仍可能产生网络 404；README 已准确说明，这与任务约定的默认空安装不产生缺失曲目请求一致。
- **异步生命周期：** `src/ui/SoundManager.ts:80` 在 resume 后检查 disposed；`:228`–`:237` 在 manifest、文件读取和 decode 后检查 disposed/context，防止晚到结果复活音频。悬挂期间的模式/外部曲目变更由下一次 unlock 比对并采用。`:242` 中止请求、清 timer/listener、停止并断开 voices/buses、关闭 context；`:161`、`:188` 将 live voice 上限限制为 96。
- **旧测试语义：** `tests/m3-sound.test.ts` 仍保留 21 个用例，包括无 host、constructor/resume 失败、pending resume 后 dispose、防重复 timer/bus、音量/duck、全部旧 cue 和战斗去重。报告逐项解释的四处适配对应 P1 多声部、AudioContext 时钟、maj7/9 和新增橘子音效，未发现将既有生命周期或 cue 断言简单删除的情况。`tests/p1-sound.test.ts:56` 的实际 onset/频率/噪声/包络检查补充了新编曲语义，`:142` 起覆盖 external priority、失败回退与晚到异步结果。

## 验证边界

本轮为静态独立审查，没有重复执行测试。实现报告记录 targeted 55/55、typecheck 和全套 548/548 通过；这些是实现方证据，不作为本轮重新执行的结果。录制 WebAudio mock 能检查节点、参数与调度意图，不能代替真实浏览器的听感、自动播放策略和系统音频中断验收。Root UI 的自动 mode 选择属于 root 集成范围，不在本次音频单任务结论中。

## 补充审查：严格零 404 manifest 插件

本次只审查 `docs/P1-audio-manifest-review-diff.txt` 与实现报告末尾补充。未修改实现、未派子代理、未重复整套测试。以下结论针对新增插件，并更新此前关于“显式缺失文件可能产生 404”的说明：正常 dev/build 路径现在会在交给浏览器之前去除缺失声明。

- **规范符合：通过（Round 1 修复复审）。** 正常路径的零 404 过滤和 public 源只读保持；新增 `rejectOutputLinks` 以 `lstat` 检查目标及每级已有祖先，在创建目录和写入前拒绝游戏内外 symlink/junction，原输出重定向边界问题已关闭。
- **代码质量：通过（Round 1 修复复审）。** 仅读取 `docs/P1-audio-manifest-fix1-diff.txt` 与实现报告末尾，确认修复覆盖 audio 目录 junction、manifest 文件 symlink 和输出祖先 junction，未发现修复引入的重要问题。实现方记录真实文件系统回归 RED 为 3 failed/13 passed、修复后 16/16 与 typecheck 通过；本轮未重跑套件或修改实现。当前无未解决的重要音频问题，可进入最终交叉审查。

### 已关闭 P2：游戏内输出链接可使 build 改写非输出源 manifest（以下保留原审查证据）

**位置：** `scripts/audio-manifest.ts:47`（`assertOutput`，尤其第 48–51 行）及 `scripts/audio-manifest.ts:69`（输出解析与第 74 行 `writeFile`）。

**原因与影响：** 校验只要求目标及已有祖先解析后仍位于 game 内，并排除 public 路径。若 `outDir/audio` 是指向游戏内另一个非 public 源目录的 junction/symlink，检查会通过，而 `writeFile(outDir/audio/manifest.json, ...)` 会跟随链接，覆盖源目录的 manifest。类似地，输出 manifest 自身若链接到游戏内其他非 public 文件，也未被此校验排除。这违反“build 只写输出 manifest”的副作用边界；game 内并不等于构建输出内。

**本轮窄验证：** 使用真实 `audioManifestPlugin()`，在游戏 `.runtime/audio-review-*` 下创建隔离 fixture：`source/manifest.json` 初始为 `{"bgm_boss":"missing.mp3"}`，令 `out/audio` 为指向 `source` 的 Windows junction，再以该 `out` 调用 `configResolved` 和 `closeBundle`。hook 成功返回，读取源文件得到 `{}\n`，确认发生覆盖。只执行了这一次定向 probe；fixture 已在 finally 中删除，退出码 0。

**建议修复：** 对输出位置禁止会将写入重定向到其他源位置的链接/junction，或建立更严格的已验证输出根与目标真实路径关系，并拒绝重定向的 manifest 文件；必须覆盖游戏内重定向，而非仅游戏外/public。新增对应回归断言：hook 拒绝且被指向的源 manifest 内容保持不变。

### 其余核对与证据边界

`availableManifest` 的 key/扩展名规则与 browser validator 一致，`realpath` 加 `stat().isFile()` 排除缺失、目录及逃出 audio 目录的声明；错误被转换为 `{}`，没有主动音频 HTTP 请求。dev middleware 在请求时重新读取，只拦截精确 manifest URL（含部署 base），其他 URL 交给后续处理。build 的 `closeBundle` 只在 build command 执行，以已复制输出判断文件存在性；正常完整产物部署下不会让浏览器请求已缺失声明。README 对发布后删文件须更新 manifest 的边界说明准确。

实现方补充记录 13 个 manifest 用例加既有 55 个音频用例共 68/68、typecheck 通过；本轮未重复执行这些套件。现有测试未覆盖上述游戏内 junction/symlink 重定向。Vite 插件注册及 `.ts` import 已包含在给定 diff 中；本轮未启动服务或重复 build。
