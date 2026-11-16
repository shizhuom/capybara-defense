const phrases:Record<string,[string,string]>={
 'p12.victory':['大获全胜','VICTORY'],
 'p12.defeat':['澡盆失守','DEFEAT'],
 'p12.return':['返回庭院','Back to Courtyard'],
 'p12.stats':['数据','Stats'],
 'p12.report':['本局战报','Battle Report'],
 'p12.closeStats':['收起战报','Close Battle Report'],
 'p12.continue':['继续挑战','Continue Challenge'],
 'p12.retry':['再战一局','Try Again'],
 'p12.guardianStars':['守护评价：{count} / 3 星','Guardian rating: {count} of 3 stars'],
 'p12.rankProgress':['段位进度：{current} / {total} 星','Rank progress: {current} of {total} stars'],
 'p12.maxRank':['已达最高段位','Highest rank reached'],
 'p12.newUnlocks':['全新解锁','New Unlocks'],
 'p12.unlockDetails':['查看本局的全新解锁','View this battle’s new unlocks'],
 'p12.pauseTitle':['泡汤小憩','Game Paused'],
 'p12.pauseWave':['第 {wave}/10 波','Wave {wave}/10'],
 'p12.pauseTime':['用时 {time}','Time {time}'],
 'p12.pauseOranges':['剩余橘子 ×{count}','Oranges ×{count}'],
 'p12.pauseLoot':['本局已拾取碎片','Fragments Collected'],
 'p12.pauseEmpty':['击败首领即可掉落奇葩神兵碎片','Defeat bosses to find curious weapon fragments'],
 'p12.resume':['继续保卫澡盆','Keep Defending the Tub'],
 'p12.profile':['名片','Profile'],
 'p12.settings':['设置','Settings'],
 'p12.surrender':['放弃本局','Leave Battle'],
};

export const p12Zh:Record<string,string>=Object.fromEntries(Object.entries(phrases).map(([key,value])=>[key,value[0]]));
export const p12En:Record<string,string>=Object.fromEntries(Object.entries(phrases).map(([key,value])=>[key,value[1]]));
