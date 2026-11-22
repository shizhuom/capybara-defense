/** P19 Progressive feature unlocking, interactive per-system onboarding, 2x/3x speed & Zeigarnik hooks. */
const copy = {
  // Match 1 upgraded 6-step basic tutorial
  'p19.tutorialDig.title': ['2 · 用铁锹开垦草坪', '2 · Dig Grass with the Shovel'],
  'p19.tutorialDig.body': ['点左侧闪亮的铁锹，再点一片绿草坪，就能开出新的白色肉垫（更多阵位）！铁锹会随时间自动补充。', 'Tap the glowing shovel on the left, then tap a green grass tile to clear a fresh paw pad! Shovels recharge over time.'],
  'p19.tutorial6.body': ['点右上角【图鉴】可随时查配方与属性；危急时左侧还有免费的【洒水器】可以全路冲退害虫！完成教学送 20 金币。', 'Tap Guide at top-right anytime for recipes and stats, and use the free Sprinkler on the left to push pests back! Finish for 20 coins.'],
  // Feature display names
  'p19.feature.armory': ['神兵锻造坊', 'Weapon Armory'],
  'p19.feature.speed2x': ['2× 战斗加速', '2× Battle Speed'],
  'p19.feature.market': ['浣熊黑市 & 道具', 'Raccoon Market & Props'],
  'p19.feature.endless': ['无尽模式 & 觉醒突破', 'Endless Mode & Awakening'],
  'p19.feature.village': ['水豚温泉山庄', 'Capybara Onsen Village'],
  'p19.feature.kitchen': ['温泉料理屋', 'Onsen Kitchen'],
  'p19.feature.medallions': ['无尽勋章殿堂', 'Endless Medallions'],
  'p19.feature.speed3x': ['3× 极速模式', '3× Turbo Speed'],
  // Option-A locked next-preview badges & toast
  'p19.lockMatch': ['完赛1局', '1 Match'],
  'p19.lockStars': ['{stars}★解锁', '{stars}★'],
  'p19.lockedToast': ['还差 {need} 颗星解锁「{name}」（需 {stars}★）！', '{need} more stars to unlock {name} ({stars}★)!'],
  'p19.lockedMatchToast': ['完成第 1 局守护后即可解锁「{name}」！', 'Finish your first match to unlock {name}!'],
  // Onboarding common chrome
  'p19.guideTag': ['新功能解锁', 'NEW FEATURE'],
  'p19.guideSkip': ['跳过指引', 'Skip'],
  'p19.guideGotIt': ['太棒了，知道了！', 'Awesome, got it!'],
  'p19.guideGo': ['立刻去体验 →', 'Try it now →'],
  // 1. Armory onboarding (after Match 1)
  'p19.onboard.armory.title': ['解锁「神兵锻造坊」！', 'Weapon Armory Unlocked!'],
  'p19.onboard.armory.body': ['完成首战啦！送上 2 枚【塑料苍蝇拍】碎片，快去锻造解锁并给功夫阿宝佩戴上吧！', 'First battle done! Here are 2 Fly Swatter fragments — forge it and equip it on Kung-Fu Po!'],
  'p19.onboard.armory.step1': ['点亮中的【塑料苍蝇拍】，打开详情准备给英雄穿戴！', 'Tap the glowing Fly Swatter to open its forge sheet!'],
  'p19.onboard.armory.step2': ['点一下【功夫阿宝】头像，立刻佩戴塑料苍蝇拍（基础伤害 +12%）！', 'Tap Kung-Fu Po below to equip the Fly Swatter (+12% base damage)!'],
  'p19.onboard.armory.done': ['穿戴成功！以后每局击败 Boss 都会掉落神兵碎片，后续开启商店扭蛋与山庄樱花茶亭也能收获更多碎片！', 'Equipped! Boss kills drop weapon fragments every match, and Market Gacha & Village Pavilion bring even more!'],
  // 2. 2x Speed onboarding (at 2★)
  'p19.onboard.speed2x.title': ['解锁 2× 战斗加速！', '2× Battle Speed Unlocked!'],
  'p19.onboard.speed2x.body': ['点右上角【1×】按钮即可切换 2× 加速守护，节奏更丝滑，随时可再点切回 1×！', 'Tap the 1× speed button at top-right to toggle brisk 2× speed anytime!'],
  // 3. Market & Props onboarding (at 5★)
  'p19.onboard.market.title': ['解锁「浣熊黑市」！', 'Raccoon Market Unlocked!'],
  'p19.onboard.market.body': ['达到 5 星啦！送你主动道具【强力粘鼠板】×1 和免费扭蛋券 ×1，快去抽一发并把道具装进背包吧！', '5 stars reached! You got 1 Super Glue Trap + 1 Free Gacha Ticket — spin once and equip your trap!'],
  'p19.onboard.market.step1': ['先点【幸运扭蛋】页签，用免费券试抽一发吧！', 'Switch to the Lucky Gacha tab to try your free ticket!'],
  'p19.onboard.market.step2': ['点中央绿色【扭一次】，看看能抽出什么宝贝！', 'Tap the green Spin button in the center!'],
  'p19.onboard.market.step3': ['干得漂亮！现在切到【道具背包】页签装备主动道具！', 'Nice pull! Now open the Prop Backpack tab to equip your active prop!'],
  'p19.onboard.market.step4': ['点【强力粘鼠板】旁的「上阵」，将它装入出战主动槽！', 'Tap Equip next to Super Glue Trap to slot it for battle!'],
  'p19.onboard.market.done': ['装备好了！被动道具装上后会自动生效，每累计 3 胜还会送 1 张免费扭蛋券。下局战斗我会手把手教你在场上释放粘鼠板！', 'Slotted! Passive props trigger automatically, and every 3 wins grants a free gacha ticket. Next match I will show you how to drop the trap on the road!'],
  // 3b. In-battle Active Prop Tutorial
  'p19.onboard.prop_battle.title': ['实战道具教学！', 'Active Prop Lesson!'],
  'p19.onboard.prop_battle.body': ['点左侧闪亮的【强力粘鼠板】（或直接拖拽），再点道路即可定身害虫！冷却转完就能再用；右侧被动道具自动生效，左侧洒水器每局还可免费救场 1 次。', 'Tap (or drag) your glowing Super Glue Trap on the left onto the road to root pests! It recharges on cooldown, passives on the right run automatically, and the Sprinkler saves you once per match.'],
  // 4. Endless & Wave-11 Awakening onboarding (at 10★)
  'p19.onboard.endless.badge': ['✨ 全新解锁 · 无尽试炼', '✨ NEWLY UNLOCKED · ENDLESS'],
  'p19.onboard.endless_battle.title': ['无尽模式 & 觉醒突破！', 'Endless Mode & Awakening!'],
  'p19.onboard.endless_battle.body': ['第 11 波起害虫更强、奖励更丰厚！把 Lv.5 传说英雄再喂 1 次合成组件（或同款 Lv.5）即可掷骰【觉醒突破】战力暴涨！前 10 波攒的 🔥战意 会提高成功率，失败零损失且每次保底 +5%！', 'Wave 11+ brings tougher foes and richer loot! Feed a Lv.5 hero one more part (or Lv.5 twin) to roll Awakening Breakthrough! Pre-wave-10 Momentum boosts odds, and misses lose nothing while adding +5% pity!'],
  // 5. Village onboarding (at 16★)
  'p19.onboard.village.title': ['解锁「水豚温泉山庄」！', 'Onsen Village Unlocked!'],
  'p19.onboard.village.body': ['达到 16 星！送上 10 温泉木料 + 3 柚子精粹，去亲手建造你的第一座【竹林露天汤池】吧！', '16 stars! Here are 10 Onsen Wood + 3 Yuzu Essence — go build your very first Bamboo Onsen Pool!'],
  'p19.onboard.village.step1': ['先切到【设施建造】页签，把竹林露天汤池盖起来！', 'Open the Build tab to construct the Bamboo Onsen Pool!'],
  'p19.onboard.village.step2': ['点击【建造 Lv.1】，亲手落成你的第一座山庄建筑！', 'Tap Build Lv.1 to construct your first courtyard facility!'],
  'p19.onboard.village.step3': ['切回【温泉庭院】，摸摸院子里的萌宠或点「一键收菜」试试！', 'Switch back to Courtyard — pat a pet for pocket coins or claim the Harvest Basket!'],
  'p19.onboard.village.done': ['山庄正式开张！以后通关与无尽都会掉木料和精粹，山庄离线也能持续攒金币、碎片与柚子，并永久加成战斗！', 'Open for business! Wins & Endless drop wood and essence; your village earns offline rewards and permanent battle buffs!'],
  // 6. Kitchen onboarding (at 23★)
  'p19.onboard.kitchen.title': ['解锁「温泉料理屋」！', 'Onsen Kitchen Unlocked!'],
  'p19.onboard.kitchen.body': ['达到 23 星！送上 4 颗黄金柚子，快去熬煮你的第一锅【柚子安神汤】带去泡澡迎战吧！', '23 stars! Here are 4 Golden Yuzu — brew your first pot of Yuzu Calm Soak for battle!'],
  'p19.onboard.kitchen.step1': ['点击【柚子安神汤】旁的「熬制解锁」，熬好会自动设为今日汤底！', 'Tap Brew next to Yuzu Calm Soak — it equips automatically as Today\'s Soak!'],
  'p19.onboard.kitchen.done': ['热汤出锅！以后击败精英、首领与通关都会掉落食材（不同地图有专属特产），每解锁一道汤还会永久叠加全队收集光环！', 'Piping hot! Elites, bosses, and map clears drop signature ingredients, and every recipe permanently boosts your whole team!'],
  // 7. Endless Medallions onboarding (at 32★)
  'p19.onboard.medallions.title': ['解锁「无尽勋章殿堂」！', 'Endless Medallions Unlocked!'],
  'p19.onboard.medallions.body': ['达到 32 星！送上 10 枚无尽星徽 + 20 金币，立刻强化你的第一枚无尽勋章，冲破无尽波次瓶颈！', '32 stars! Here are 10 Endless Crests + 20 coins — upgrade your first medallion to smash past your wave record!'],
  'p19.onboard.medallions.step1': ['点击【破界炽焰勋章】旁的「升级」，将觉醒无尽伤害提升至 Lv.1！', 'Tap Upgrade next to Ember Breakthrough to reach Lv.1!'],
  'p19.onboard.medallions.done': ['勋章激活！以后每次通关第 10 波得 3 枚星徽，无尽每清 1 波持续加码掉落，快去冲击无尽全球榜吧！', 'Activated! Wave 10 clears grant 3 crests and every endless wave drops more — climb the Global Endless Board!'],
  // 8. 3x Turbo Speed onboarding (at 60★ or Endless W25)
  'p19.onboard.speed3x.title': ['荣耀解锁 3× 极速模式！', '3× Turbo Speed Unlocked!'],
  'p19.onboard.speed3x.body': ['深度守护者专属！现在右上角倍速按钮支持 1× → 2× → 3× 极速切换，刷图冲榜更畅快！', 'Veteran keeper perk! The top-right speed button now cycles 1× → 2× → 3× for turbo endless runs!'],
  // Lucky Crit Drop battle callouts
  'p19.luckyLegendary': ['✨ 鸿运暴击！传说碎片 +1', '✨ LUCKY CRIT! Legendary Fragment +1'],
  'p19.luckyTruffle': ['✨ 鸿运暴击！黑松露 +1', '✨ LUCKY CRIT! Forest Truffle +1'],
  // Combat balance callouts (Dr. Buzzcut temporary clip + Overtime Boss Unstoppable)
  'p19.clippedDowngrade': ['✂️ 剃毛降级 -1', '✂️ Clipped -1 Lv'],
  'p19.clipRestored': ['✨ 恢复原级 +1', '✨ Restored +1 Lv'],
  'p19.awakenedImmuneClip': ['★ 突破免疫降级！', '★ Awakened: Clip Immune!'],
  'p19.bossUnstoppable': ['🔥 超时霸体 · 免疫击退！', '🔥 Overtime: Unstoppable!'],
  'p19.unstoppableTag': ['霸体', 'STEADY'],
  // Locked map hover tooltip & Rank ladder overview
  'p19.mapUnlockTip': ['达到 {stars}★（{rank}）解锁 · 还差 {need}★', 'Reach {stars}★ ({rank}) to unlock · {need}★ left'],
  'p19.mapUnlockToast': ['「{map}」需达到 {stars}★（{rank}）解锁，还差 {need}★！', '{map} unlocks at {stars}★ ({rank}) — {need}★ left!'],
  'p19.rankLadderShow': ['段位总览 ▾', 'All Ranks ▾'],
  'p19.rankLadderHide': ['收起总览 ▴', 'Hide Ranks ▴'],
  'p19.rankLadderTitle': ['全部段位与星级对照（共 54 阶）', 'All Ranks & Star Milestones (54 Tiers)'],
  'p19.rankLadderSub': ['升级零惩罚：怪物血量、移速与技能冷却恒定 1×（无尽模式全段位完全公平）；段位越高通关金币与碎片倍率越丰厚，前 10 波还会多刷少量小怪带来更多鱼粮与战意！', 'Zero rank penalty: enemy HP, speed & boss cooldown stay 1× (100% fair Endless). Higher ranks raise win coins & fragment odds, plus add extra 1×-HP minions in Waves 1–10 for more fish food & momentum!'],
  'p19.rankLadderBack': ['← 返回排行', '← Back'],
  'p19.rankCurrent': ['当前段位', 'Current'],
  'p19.rankWinCoins': ['通关 +{coins} 金币', 'Win +{coins} coins'],
  'p19.rankExtraMinions': ['前10波小怪 +{count}', 'W1–10 +{count} minions'],
  'p19.rankFragBoost': ['碎片权重 ×{mult}', 'Drops ×{mult}'],
  'p19.rankUnlockMap': ['解锁 {map}', 'Unlocks {map}'],
  'p19.rankInitMap': ['初始地图 · {map}', 'Starter · {map}'],
  // Zeigarnik "Almost There!" Settlement Hooks
  'p19.hook.featureMatch': ['🎯 完成首战即可解锁「{name}」！', '🎯 Finish 1 match to unlock {name}!'],
  'p19.hook.featureStars': ['🎯 还差 {need} ★ 解锁「{name}」（{current}/{target}★）', '🎯 {need}★ away from unlocking {name} ({current}/{target}★)'],
  'p19.hook.gacha': ['🎟️ 再赢 1 局就领免费扭蛋券（2/3 胜）！', '🎟️ 1 more win for a Free Gacha Ticket (2/3)!'],
  'p19.hook.weapon': ['⚔️ 「{name}」还差 {need} 枚碎片即可合成（{current}/{target}）！', '⚔️ {name} needs just {need} more fragment(s) ({current}/{target})!'],
  'p19.hook.village': ['🏡 「{name}」建料已攒 {pct}%，再来几局就能开建！', '🏡 {name} materials at {pct}% — almost ready to build!'],
  'p19.hook.kitchen': ['🍲 「{name}」食材已凑齐 {pct}%，马上就能开锅！', '🍲 {name} ingredients at {pct}% — almost ready to brew!'],
  // Developer Panel Onboarding Stage Debugger
  'p19.devStage': ['新手解锁节点调试', 'Onboarding Node Jump'],
  'p19.devStageApply': ['跳转节点', 'Jump Node'],
  'p19.devStageDone': ['已跳转至新手节点 {stage}（请看主界面/下局引导）', 'Jumped to onboarding stage {stage}'],
  'p19.devStage.0': ['0 · 开局纯塔防 (0★)', '0 · Fresh Start (0★)'],
  'p19.devStage.1': ['1 · 解锁神兵坊 (完赛1局)', '1 · Armory Unlock (1 match)'],
  'p19.devStage.2': ['2 · 解锁 2× 加速 (2★)', '2 · 2× Speed Unlock (2★)'],
  'p19.devStage.3': ['3 · 解锁浣熊黑市 (5★)', '3 · Market & Props (5★)'],
  'p19.devStage.4': ['4 · 解锁无尽模式 (10★)', '4 · Endless Mode (10★)'],
  'p19.devStage.5': ['5 · 解锁温泉山庄 (16★)', '5 · Onsen Village (16★)'],
  'p19.devStage.6': ['6 · 解锁温泉料理屋 (23★)', '6 · Onsen Kitchen (23★)'],
  'p19.devStage.7': ['7 · 解锁无尽勋章 (32★)', '7 · Endless Medallions (32★)'],
  'p19.devStage.8': ['8 · 解锁 3× 极速 (60★/W25)', '8 · 3× Turbo Speed (60★/W25)'],
} as const;

export const p19Zh: Record<string, string> = Object.fromEntries(Object.entries(copy).map(([k, v]) => [k, v[0]]));
export const p19En: Record<string, string> = Object.fromEntries(Object.entries(copy).map(([k, v]) => [k, v[1]]));
