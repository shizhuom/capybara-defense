# M3 表现与音频实施报告

2026-11-13；工程 `D:/rea_game/games/capybara-defense/`。编码前完整读取 M3 任务、固定契约、只读 M3 规范、总体设定、M2 验收以及现有 StickerRenderer / StickerArt / M2Effects；采用 TDD 与完成前验证技能。未启停服务、未派生代理、未写 Git，产品修改仅涉及本任务拥有的文件。

## 实际产物

- `src/render/StickerRenderer.ts`：使用 `getMap(state.mapId).theme` 绘制棋盘与纸张；道路箭头读取对应地图路径。保持 STAGE 命中坐标、M2 金铲、洒水车、弹射、陷阱、洗衣机和封印/淋湿绘制。`showDamageNumbers:false` 只过滤 damage 事件文本，保留攻击轨迹与技能。KNOCKDOWN 保持旋转金星，CONFUSED 使用紫色旋涡；骨盾耗子显示骨头盾牌，DJ 加速中的敌军显示速度线。
- `src/render/StickerArt.ts`：六位新 Boss 各有独立轮廓与标志：波斯猫毛团/粉蝴蝶结/扇子、长耳袋鼠/拳套、蜂后/皇冠/尾针号角、土拨鼠/张大嘴、死灵浣熊/垃圾桶/骨杖、DJ 鼠王/耳机/音箱。杀人蜂采用尖尾针和凶眉，迷弟耗子采用爱心眼与漂浮爱心。
- `src/render/M3Effects.ts`：四图棋盘外侧分别绘制花叶、樱花枝、厨具罐匙、猫柱/逗猫球。消费核心真实 `boss_skill` 的 effect 与捕获 points，显示爱心魅惑、拳击震地、蜂群号角与突进线、尖叫音波/混乱旋涡、骨头招魂、DJ 回复/音符光环。目标即使消失也保留原施法坐标，不另行寻找目标。
- `src/render/M3Art.ts`：提供 `avatarSticker(id,size=64)` 和 `weaponSticker(id,size=48)`；16 个头像、36 把武器全部为独特固定 SVG 几何，不以颜色或文字编号充当差异。以粗棕色圆角描边、浅纸色底贴纸延续 M2 风格；无 DOM、脚本、外链、字体或 emoji 依赖。未知 ID 使用本地默认图，异常 size 回到默认并限制尺寸范围。
- `src/ui/SoundManager.ts`：用户手势 `unlock()` 后初始化 WebAudio，C/D/E/G/A 五声音阶正弦/三角波木琴旋律，仅一个 450ms 调度器。11 类 SFX 分别合成铃声、铲地、升星琶音、传奇和弦、刀鹅滑音、橘子水泡、洒水车、跑马灯、中奖、胜利、失败。音乐/音效独立总线；设置即时生效，暂停/后台用 160ms 时间常数降低音乐至 15%。重复逐帧 setDucked 不重复启动包络。`dispose()` 释放定时器、可见性监听、声源/包络节点与 AudioContext；无宿主、构造失败、resume 拒绝均静默降级。

## UI 接口须知

- SVG 可以直接作为 `innerHTML`，请使用固定配置 ID。API 已自行处理非法 ID，不应另造 emoji 回退。
- UI 成功命令负责 summon / dig / legendary；普通升级由 purge 事件消费，`effect:'legendary'` 的 purge 明确跳过，避免传奇合体同帧双播。`consumeBattle` 负责 dash→goose、orange 负值→orange、sprinkler→sprinkler、普通 purge→upgrade；正值橘子和传奇 purge 不播放这些声音。事件按 battleId + event.id 去重，保留最近 8 局。
- 跑马灯每次真实步进播放 lottery_tick，真实领奖播放 lottery_win；结算由 UI 的一次性完成分支播放 victory/defeat。每帧可以安全调用 consumeBattle 和 setDucked。
- 不缓存或补播解锁前的音效；unlock 必须由 pointer/keyboard 等用户手势调用。重复 unlock 幂等，内部共享正在恢复的 Promise。当前无接口冲突。

## TDD 与验证

新增 `tests/m3-render.test.ts` 16 项、`tests/m3-sound.test.ts` 19 项。

1. 初始执行确认 M3Art / SoundManager 缺失；加入空接口后观察 30 个失败/1 个通过，包含空 SVG、伤害数字开关、Boss 外观与音频节点等缺失行为。地图测试当时因主线程尚未写入 MAPS 报错，待契约地图落盘后实际执行。
2. 实现后 31 项定点通过；进一步加入生命周期与透明震波边界。观察到“逐帧 duck 重写渐变包络”和“Canvas 使用 SVG 的 none 填充”两项失败，再修复为状态去重及显式透明色，最终 35 项通过。
3. 音频使用记录型 WebAudio 宿主验证真实输出频率、音色、包络增益与终止时间：无音频环境、constructor/resume 失败、重复 unlock 单实例/单旋律、pending resume 期间 dispose、实时 0 音量、柔和降音、11 音效、按身份去重和命令事件分工。混合事件夹具精确产生 14 个 SFX 声源节点，重复消费不新增节点。未单独加入双并发 unlock 测试。
4. SVG 测试对实际返回内容移除 ID/颜色后仍要求 16/36 个几何唯一，拒绝脚本、外链、文字占位与 emoji；渲染测试记录实际 Canvas 几何及颜色，验证四图道路、隐藏数字保留投射、六 Boss 捕获目标演出和骨盾。

2026-11-13 13:30 本地执行结果：

| 命令 | 结果 |
| --- | --- |
| `npm test -- tests/m3-render.test.ts tests/m3-sound.test.ts` | 2 文件，35/35 通过 |
| `npm test` | 18 文件，425/425 通过，0 失败 |
| `npm run typecheck` | `tsc --noEmit` 通过，退出码 0 |

以上全量结果为报告时共享源码状态；本任务 src 已冻结，后续整合由主线程复验。未在本任务启动服务或执行生产构建；未实际听音或声称已做硬件音质验收。浏览器四图、贴纸排版与可见交互由主线程/UI 任务继续实测。
