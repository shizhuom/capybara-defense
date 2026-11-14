# Task 3：主题、贴纸与音频

先完整读只读M3规范、总体设计、M2验收、`docs/M3-contracts.md`以及现有render代码。仅修改本工程。

你唯一拥有：`src/render/StickerRenderer.ts`、`StickerArt.ts`、可新增`M3Art.ts`、`M3Effects.ts`；`src/ui/SoundManager.ts`；新`tests/m3-render.test.ts`、`m3-sound.test.ts`。不要改maps/types/core/UI页面/CSS/i18n或旧测试，不启停服务、不派生代理、不写Git。

实现4种主题的地图色与场景边缘贴纸；道路箭头读MAPS[state.mapId].paths；新的6Boss、killer_bee/charmed_rat/带骨盾rat有可辨识外观与真实技能事件演出，KNOCKDOWN星星与CONFUSED螺旋；保留M2精修、命中坐标、金铲/洒水车/弹射。Interaction.showDamageNumbers=false时只隐藏伤害数字，不隐藏攻击效果。

固定SVG接口为16头像与36武器提供专属贴纸小图，代码矢量、粗描边、无外链。音频按契约在用户手势解锁后五声音阶木琴BGM与11类SFX，音量即时、暂停后台柔和降音、事件去重、生命周期释放；无AudioContext与resume失败静默不报错。

先写真实渲染/安全音频边界测试并观察失败，后实现。Audio可用最小记录型宿主替代真实硬件，验证输出节点频率/包络/音量而非mock存在；Node无音频必须安全。读取契约避免UI重复播声。

报告写`docs/M3-presentation-report.md`，记录实际产物、验证与UI须知；跑定点和全套/typecheck，其他人未完成错误如实报告。最终只回复状态、测试摘要、报告路径。
