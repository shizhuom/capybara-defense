# M2 Canvas 演出实现记录

范围：仅本项目 `src/render/StickerRenderer.ts`、`StickerArt.ts`、新增 `M2Effects.ts`、`tests/m2-render.test.ts` 与本报告；未改 core/types、引擎、UI、配置、翻译、原版或 design，未操作 Git，未启动或停止服务器。

## 已实现

- `dash` 使用事件存储的 `points`，每段均分事件时间；只画当前刀鹅、三层短残影和斩击，不再同时画七条从源单位出发的冲刺。7 与 10 段共用同一路径插值。
- `bounce` 每段独立起落，篮球或毛线球沿真实捕获路线依次弹跳；不查询存活敌人。刀鹅/鸡神/喵利波特的旧 ultimate burst 实体演出已移除，避免重复表现。
- `sprinkler` 沿事件中的逆向道路逐段行驶，车头随路线转向，画黄色车身、轮胎、水枪与水花。该绘制不新增 HitTarget。
- `giant_cat` 在存储的目标点落下一只橘色肥猫，包含落点阴影、下落、压扁回弹、地面冲击圈。
- `weapon.effect` 按字符串主题绘制竹笋、鱼/导弹、猫爪、火焰、旋涡、球、宝箱、电弧、金币、水泡、音波/阴阳等；未知效果退回可见星环。可接受具体武器 ID 中包含的主题词。
- SEALED：瓦楞线纸箱、晃动封箱胶带、醒目跳动感叹号；选中时使用 UI 提供的双语 `render.sealedHint`。
- WET：头顶小乌云和循环滴水；`Unit.washing`：旋转滚筒、机壳、剩余进度环，棋盘和窝均可见。
- `loadout.equippedPassiveProps` 包含 `gold_doge` 时，铲按钮及拖动铲均显示金色铲面和闪光；选中与装备状态分别控制。
- `state.traps` 绘制粘鼠板、剩余次数点及数字。`Interaction.propId` 绘制合法单位/道路目标和道具拖拽图形；洗衣中、满级奶瓶、非组件橡皮泥和已占用陷阱道路不标为合法。窝内目标边框绘制于窝底板之后，避免被遮挡。
- 棋盘、窝、铲子的坐标及 `HitTarget` 联合类型保持不变。

## 接口

- 消费主代理定义的 `VisualEvent.points?: Point[]`、`effect?: string`，坐标为格坐标。无 points 时回退至事件自身坐标/目标坐标；新事件不依赖 `state.units`、`state.enemies` 查询。
- 1.1 秒等持续时间由引擎事件指定；渲染将过期/零时长事件夹至终点，支持仅一个点的事件。
- `drawShovelArt(context, active = false, gold = false)` 新增第三个可选参数，旧两参数调用保持兼容。
- 未增加翻译键；`render.sealedHint` 已由 UI 代理加入并确认。

## 验证

使用测试驱动流程：初始 18 个功能测试因旧渲染缺少相应绘制分支而失败；另分别观察到已占用陷阱格提示、窝目标绘制顺序、五种武器主题测试失败，随后实现并通过。

`tests/m2-render.test.ts` 共 **25 项**，通过真实 `StickerRenderer.draw` 调用记录 Canvas 边界输出，验证：

- 没有源单位/敌人的逐段轨迹坐标，7/10 冲刺端点顺序，篮球首段和毛线第二段弧线，结束夹值。
- 洒水车逆向路段、无敌人时肥橘落点、11 类主题绘制分支。
- 纸箱瓦楞/胶带/感叹号、雨云滴水、旋转洗衣机、非选中金铲、陷阱次数。
- 道具目标轮廓、已占用道路禁止高亮、窝目标前景层级和旧铲子命中结果。

最近一次验证（2026-11-12，本任务交付时的共享工作区）：

| 命令 | 结果 |
| --- | --- |
| `npm test -- tests/m2-render.test.ts tests/render.test.ts` | 2 文件，28/28 通过 |
| `npm test` | 11 文件，170/170 通过 |
| `npm run typecheck` | 退出 0 |
| `npm run build` | 退出 0 |

Canvas 测试验证几何与绘制分支，不等同于浏览器像素验收。最终桌面/手机、中英以及实际战斗闭环浏览器验收由集成主任务完成。
