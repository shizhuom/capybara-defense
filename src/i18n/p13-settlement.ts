const phrases:Record<string,[string,string]>={
 'p13.victory':['守卫成功','VICTORY'],
 'p13.endlessVictory':['无尽凯旋','ENDLESS'],
 'p13.damage':['总伤害','Damage'],
 'p13.kills':['击退','KOs'],
 'p13.reportWave':['{wave} 波','Wave {wave}'],
 'p13.endlessWave':['♾ 第 {wave} 波','♾ Wave {wave}'],
 'p13.endlessRecord':['♾ 本局抵达第 {wave} 波（历史最高 {best} 波）','♾ Reached wave {wave} (best {best})'],
 'p13.rankBanked':['升星已入账','Rank stars banked'],
 'p13.starProtected':['护星','Protected'],
 'p13.endlessOfferTitle':['守住 10 波啦！开启无尽模式？','10 waves defended! Go Endless?'],
 'p13.endlessBanked':['前10波升星与金币奖励已入账！','Your first 10 waves’ stars and coin rewards are banked!'],
 'p13.endlessOfferBody':['第 11 波起每波怪物生命成倍暴涨，首领倾巢而出，每波额外掉落金币与神兵碎片！','From wave 11, enemy health doubles every wave. More bosses bring extra coins and weapon fragments!'],
 'p13.endlessScaling':['怪物生命每波翻倍','Enemy health doubles each wave'],
 'p13.declineEndless':['直接结算领奖','Collect Victory Rewards'],
 'p13.enterEndless':['开启无尽模式！','Enter Endless Mode!'],
 'p13.settleEndless':['结算无尽奖励','Settle Endless'],
 'p13.retrySave':['重试保存奖励','Retry Saving Rewards'],
 'p13.savePending':['奖励尚未保存，请重试保存后继续。','Rewards are not saved yet. Retry saving to continue.'],
 'p13.endlessAwarded':['无尽奖励已保存，前10波升星与奖励稳稳保留。','Endless rewards saved. Your first 10 waves’ stars and rewards are safe.'],
 'p13.runFootprints':['本局足迹','Battle Footprints'],
 'p13.treasureShelf':['本局战利品','Battle Treasure'],
 'p13.guardTime':['守护用时 {time}','Guard time {time}'],
};

export const p13SettlementZh:Record<string,string>=Object.fromEntries(Object.entries(phrases).map(([key,value])=>[key,value[0]]));
export const p13SettlementEn:Record<string,string>=Object.fromEntries(Object.entries(phrases).map(([key,value])=>[key,value[1]]));
