# M3 跨模块固定接口

所有路径相对本游戏。仅主代理修改 `core/types.ts`，其他文件由任务唯一所有者维护；不启停服务、不派生代理、不写Git。所有人完整阅读只读M3规范与本任务相关M2代码后才写产品代码。

## 类型（主代理写）

- `MapId = 'sunny_backyard'|'sakura_onsen'|'midnight_kitchen'|'cat_tower_maze'`；`GameSettings {musicVolume:number;soundVolume:number;showDamageNumbers:boolean}`。
- `Profile` 新增必需 `stars,highestStars,winStreak,bestWinStreak:number`、`selectedMap:'auto'|MapId`、`avatarId:string;unlockedAvatars:string[];mergedHeroes:string[];settings:GameSettings`。保留`schemaVersion:2`，新字段缺省各自迁移。
- `BattleState` 新增必需 `mapId:MapId;rankIndex:number;mergedHeroes:Record<Side,string[]>`。
- `BattleResult` 新增可选 `rankIndex?:number;mergedHeroes?:string[]`（旧M1/M2结果夹具无需变更）。
- `Enemy` 新增可选 `hasteTime?:number;boneShield?:boolean`。骨盾鼠总HP按rat×波次×1.3，骨盾是该增厚生命的标记，无额外隐藏HP。
- `Interaction` 新增可选 `showDamageNumbers?:boolean`，缺省显示。
- `VisualEvent` type新增`'boss_skill'`，`effect`为boss ID、points为目标坐标；由render消费。

## 地图与战斗（主代理写）

`config/maps.ts` 导出 `MAP_IDS:MapId[]`、`MAPS:Record<MapId,MapDefinition>`、`getMap(id?:string):MapDefinition`；`MapDefinition {id:MapId;name:{'zh-CN':string;en:string};grid:Tile[][];paths:Record<Side,Point[]>;theme:{grass:[string,string];open:string;road:string;water:string;accent:string;paper:string}}`。

保留现有`MAP`,`PATHS`为sunny默认别名与STAGE原值。`GridSystem.create(mapId?:MapId)`、`pathPosition(side,progress,mapId?:MapId)`默认后院。

`EngineOptions`新增`mapId?:MapId;rankIndex?:number`；初始化为合法地图与0..53段位，核心和AI始终读取state。`BattleEngine.rollWeaponFragment():string` 统一按本局rank增加紫橙权重，Boss和金铲调用。

成功合成产出英雄时加入`state.mergedHeroes[side]`（唯一）；finish返回玩家合成列表。UI可用`recordMergedHeroes`即时记录，结算再次合并是幂等的。

## 段位与头像（progression写）

`config/ranks.ts`: `RANKS:RankDefinition[]`共54，`RankDefinition {index:number;name:{'zh-CN':string;en:string};minStars:number;hpMultiplier:number;winCoins:number;fragmentMultiplier:number;mapId:MapId}`，`getRank(stars:number):RankDefinition`。表内区间均匀插值（固定小数保留），50..53分别2.5/2.6/2.7/2.8倍，minStars100/125/150/180，名称均水豚真神，靠index与星数区分层次。

`config/avatars.ts`: `AVATARS:Record<string,{id:string;name:{'zh-CN':string;en:string};description:{'zh-CN':string;en:string}}>`。顺序ID固定：`capybara,hamster,squirrel,bee,cat_swordsman,doge_agent,goose_bully,kungfu_panda,rooster_star,frog_king,market_coon,salted_fish,bamboo_master,sakura_capy,corgi_crown,zen_capy`；前4默认。

`core/PlayerProgression.ts`:
- `DEFAULT_SETTINGS:GameSettings`；`unlockAchievements(profile:Profile):Profile`（纯函数，保留已获成就）；`recordMergedHeroes(profile,heroIds:string[]):Profile`。
- `getUnlockedMaps(profile:Profile):MapId[]`：最高星数对应rank0/10/20/30解锁；`resolveMap(profile):MapId`。
- `selectMap(profile,id:'auto'|MapId):Profile`、`selectAvatar(profile,id:string):Profile`、`updateSettings(profile,patch:Partial<GameSettings>):Profile`，非法值返回不变/规范化，不能装备未解锁头像/地图。
- `setRank(profile,index:number):Profile`：测试台按minStars设置，highestStars单调，更新成就、修正非法地图。
- `applyBattleProgress(profile:Profile,won:boolean,mergedHeroes?:string[]):Profile`：只管星/连胜/成就/最高星，不再加金币/胜场；storage在原奖励/收据一次性事务中调用，传入已更新wins的档案。
- `getLeaderboard(profile:Profile):LeaderboardEntry[]`含15NPC+本人；`LeaderboardEntry {id:string;name:{'zh-CN':string;en:string};stars:number;avatarId:string;wins:number;matches:number;isPlayer:boolean}`，按星数降序，同分胜场再id稳定排序；玩家name中英为“我 / You”。

MetaProgression在成功购买/兑奖/碎片解锁后评估成就；normalize补M3默认且幂等；unlockAllProfile解锁全部物品和16头像、stars至少180、highestStars≥stars，mergedHeroes全12，设置/原备份保留。UI依旧调用enableTestProfile/restoreNormalProfile。

## 表现与声音（presentation写）

`render/M3Art.ts`: `avatarSticker(id:string,size=64):string`、`weaponSticker(id:string,size=48):string`，返回无脚本/无外链的独特手绘SVG HTML（所有16/36有不同轮廓或标志，不用纯emoji占位）。无DOM依赖，可直接用于UI。

`ui/SoundManager.ts`:
- `SoundCue = 'summon'|'dig'|'upgrade'|'legendary'|'goose'|'orange'|'sprinkler'|'lottery_tick'|'lottery_win'|'victory'|'defeat'`。
- `new SoundManager(settings?:Partial<GameSettings>)`；`unlock():Promise<void>`（用户手势调用，拒绝安全捕获）；`setSettings(settings:GameSettings):void`；`setDucked(ducked:boolean):void`；`play(cue:SoundCue):void`；`consumeBattle(state:BattleState):void`（按battleId/event.id去重，orange负值、dash、sprinkler、purge等实际事件）；`dispose():void`生命周期释放。
- 逻辑/存储层不导入SoundManager。BGM只一个调度循环，音量0可静音；失败/无context无未捕获异常。
- UI负责summon/dig/legendary命令SFX；consumeBattle负责goose/orange/sprinkler，避免双播。upgrade由purge事件，legendary合体由命令，合体同帧不重复普通upgrade（可通过事件effect区分，主代理为合体purge设置`effect:'legendary'`）。结算由UI只调用一次。
- MetaScreens构造可加可选第5回调`onSound?:(cue:SoundCue)=>void`，UI传入；真实跑马灯步进/获奖调用，不因重绘再次播放。

## UI所有权（ui写）

GameApp、MetaScreens、ui/ProfileScreens.ts、ui/m3.css、i18n/m3.ts和i18n.ts、测试m3-i18n、scripts/m3-browser-qa.mjs。保留旧data-action与DOM选择器以兼容旧回归；新增id/data-action稳定自明。音效与M3Art由presentation提供，禁止重复实现。

`i18n/m3.ts`生成配置的`map.ID,rank.INDEX,avatar.ID,avatar.ID.desc`与所有新UI键，以及新增`enemy.ID`、`boss.ID`、`boss.ID.bubble`；更新app.edition为v1.0。普通旧Boss键不改。
