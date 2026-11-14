export interface OpponentTuning {rankIndex:number;interval:number;openingDelay:number;reactionDelay:number;counterMerges:boolean}
export function getOpponentTuning(rankIndex:number):OpponentTuning {
  const rank=Number.isFinite(rankIndex)?Math.max(0,Math.min(53,Math.trunc(rankIndex))):0;
  const tier=rank<6?0:rank<15?1:rank<30?2:rank<45?3:4;
  return {rankIndex:rank,interval:[1.65,1.3,1,.82,.68][tier],openingDelay:[3.5,2,1,.5,.3][tier],reactionDelay:[2.5,2.3,2,1.6,1.2][tier],counterMerges:tier===4};
}
