const copy = {
 'p13.earlyTitle':['📯 提前开战奖小鱼干！','Early Wave Bonus!'],
 'p13.earlyBody':['阵型摆好或清光本波害虫后，点号角提前迎战！剩余等待时间会折算成额外小鱼干（+{food}🐟）。','Ready your squad or clear the wave, then blow the horn! Turn the remaining wait into extra fish food (+{food}🐟).'],
 'p13.earlyNow':['立刻提前开战 +{food}🐟','Start early +{food}🐟'],
 'p13.earlyDismiss':['知道了','Got it'],
 'p13.earlyLabel':['提前战 +{food}','Early +{food}'],
 'p13.passives':['被动','Passives'],
 'p13.noPassives':['无被动','No passives'],
 'p13.passiveEmpty':['装备被动道具','Equip a passive prop'],
 'p13.targetField':['拖入棋盘释放，移出棋盘取消','Drop on the board to cast; drop outside to cancel'],
 'p13.endlessWave':['♾️ 第 {wave} 波','♾️ Wave {wave}'],
 'p13.saveFirst':['奖励尚未保存，请先重试保存。','Rewards are not saved yet. Please retry saving first.'],
} satisfies Record<string,readonly [string,string]>;
export const p13Zh:Record<string,string>=Object.fromEntries(Object.entries(copy).map(([key,value])=>[key,value[0]]));
export const p13En:Record<string,string>=Object.fromEntries(Object.entries(copy).map(([key,value])=>[key,value[1]]));
