'use strict';
(() => {
  const timer = setInterval(async () => {
    if (!window.StudyTest?.ready) return;
    clearInterval(timer);
    const e=window.__offlineTest,r=window.__referenceBalance,d=e.data.instance();
    Object.assign(d.player._data,{_win:1,_lose:0,_curStar:0,_lastStar:0,_props:[],_weaponFragments:[],_equip:Array(12).fill(-1),_registerTime:Date.now()-3600000,_isSkipped:true});
    e.rankControl.instance().Fu(0,0);
    e.props.instance().CB([{type:null,level:1},{type:null,level:1}],Array.from({length:6},()=>({type:null,level:1})));
    await e.game.instance().startGame();
    const scene=e.scenes.instance().Vr('BattleScene'),waves=r.waves.instance(),draws=r.draws.instance(),actions=r.actions.instance();
    const bench=()=>actions.iY.bP(3,true).mP.map(x=>x?{kind:x.constructor?.name,id:x.id,level:x.level,type:x.type,attackPower:x.Sp,attackIntervalSeconds:x.N_,attacksPerSecond:x.q_,word:x.txt??x.text??x.wp}:null);
    const counts=a=>Object.fromEntries([...new Set(a)].map(k=>[k,a.filter(x=>x===k).length]));
    console.log('REFERENCE_BALANCE_CORE '+JSON.stringify({round:d.player.round,firstEnemyStats:d.Ty(0),initialDelay:d.nu.delayTime,betweenWaves:waves.Cj,spawnInterval:waves.Uj,startingFood:d.nu.gold,drawCost:d.nu.oh,drawCount:d.map.na,basePool:counts(d.te.te),currentPool:counts(draws.RO),waveSource:waves.constructor.toString().slice(0,2200),bossCheckSource:r.enemies.instance().nT.toString()}));
    const before={food:d.nu.gold,cost:d.nu.oh,bench:bench()};
    scene['W$']();
    setTimeout(()=>{
      const first={food:d.nu.gold,cost:d.nu.oh,bench:bench()};
      d.nu.gold=50;
      scene['W$']();
      setTimeout(()=>{
        const second={food:d.nu.gold,cost:d.nu.oh,bench:bench()};
        const boss=r.enemies.instance().KI(3,true);
        console.log('REFERENCE_BALANCE_DRAW_AND_BOSS '+JSON.stringify({before,first,second,boss:{kind:boss.constructor.name,type:boss.type,hp:boss.$h,cooldownMs:boss.pe,range:boss.ue,speed:boss.Mm,skillSource:boss.mw.toString()},terrainSource:scene.yq.toString(),discardSource:actions.eG.toString()}));
      },1300);
    },1300);
  },100);
})();
