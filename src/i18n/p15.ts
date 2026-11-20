/** P15 settlement copy: fewer words, bigger pictures. Every entry is a cozy `[zh-CN, en]` pair. */
const copy = {
 'p15.report':['战报','Report'],
 'p15.continue':['继续出征','Continue'],
 'p15.again':['再来一局','Try Again'],
 'p15.endlessCapsule':['第{wave}波 · 最高{best}','Wave {wave} · Best {best}'],
 'p15.rankProgress':['{current}/{total}','{current}/{total}'],
 'p15.maxRank':['满级','MAX'],
 'p15.saved':['已保存','Saved'],
} satisfies Record<string,readonly [string,string]>;
export const p15Zh:Record<string,string>=Object.fromEntries(Object.entries(copy).map(([key,value])=>[key,value[0]]));
export const p15En:Record<string,string>=Object.fromEntries(Object.entries(copy).map(([key,value])=>[key,value[1]]));
