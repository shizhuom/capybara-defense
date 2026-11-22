const phrases:Record<string,[string,string]>={
  'p11.profile.myRank':['我的当前段位','My current rank'],
  'p11.profile.rankProgress':['再获 {count} 颗星晋升下一段位 · 通关金币 +{coins}','Next rank in {count}★ · Win +{coins} coins'],
  'p11.profile.topRank':['已达最高段位 · 通关金币 +{coins}','Highest rank reached · Win +{coins} coins'],
  'p11.profile.rankProgressLabel':['下一段位进度','Progress to the next rank'],
  'p11.profile.youHere':['我在这里','You are here'],
  'p11.profile.record':['总场次 {matches} · 胜率 {rate}% · 最高连胜 {best}','{matches} matches · {rate}% wins · Best streak {best}'],
  'p11.profile.collection':['图鉴点亮','Collection'],
  'p11.profile.avatarCollection':['头像印章图鉴','Avatar stamps'],
  'p11.profile.avatarCurrent':['使用中','In use'],
  'p11.profile.avatarChange':['更换 ›','Change ›'],
  'p11.profile.musicVolume':['背景音乐音量','Music volume'],
  'p11.profile.soundVolume':['游戏音效音量','Sound volume'],
  'p11.profile.tutorialReplay':['重温新手教程','Replay tutorial'],
  'p11.profile.tutorialHint':['随时回顾合成与布阵技巧','Revisit merging and formation tips.'],
  'p11.profile.start':['开始 ›','Start ›'],
};

export const p11ProfileZh:Record<string,string>=Object.fromEntries(Object.entries(phrases).map(([key,pair])=>[key,pair[0]]));
export const p11ProfileEn:Record<string,string>=Object.fromEntries(Object.entries(phrases).map(([key,pair])=>[key,pair[1]]));
