import type { BattleLoadout, BattleState, Enemy, Interaction, MapId, Side, StageRect, Unit, VisualEvent } from '../core/types';
import {combatRange,combatCharge} from '../core/CombatRules';
import { getMap, STAGE } from '../config/maps';
import {GUARDIAN_BATH_SPOTS} from '../config/guardianBaths';
import {getActiveBroth} from '../config/kitchen';
import {drawGuardianBath,HAPPY_DURATION,rgba,shieldDome} from './GuardianBathRenderer';
import {EnemyMotion} from './EnemyMotion';
import {UnitMotion} from './UnitMotion';
import {drawPuppetSprite} from './SpritePuppetAnimator';
import {drawEnemyAccents,drawLandingRipple} from './EnemyAccents';
import {SHOVEL_PRODUCTION} from '../config/units';
import { HEROES } from '../config/heroes';
import { MergeSystem } from '../core/MergeSystem';
import {getMergeTargets,getBenchMergeHints,getPassiveMergeCallouts,type MergeTarget} from '../core/MergeTargets';
import {isInsideBattleBoard,isValidPropRoad,isValidPropUnit,propTargetKind,propUnitCenter,resolvePropDrop} from '../core/PropTargets';
import { t } from '../i18n/i18n';
import { assets } from './AssetRegistry';
import { drawSoakingCapybaraArt, drawEnemyArt, drawOrange, drawShovelArt, drawUnitArt, ellipse, INK, line, PAPER, polygon, round, star } from './StickerArt';
import { drawGlueTrap, drawM2Event, drawPropCursor, drawSealed, drawWasher, drawWet } from './M2Effects';
import {boneShield,confusionSpiral,drawM3Event} from './M3Effects';
import {drawHeldWeapon} from './HeldWeaponRenderer';
import {drawCombatEvent} from './CombatEffects';
import {drawSplashScene} from './SplashScene';
import {placeMergeCallout} from './MergeCalloutLayout';
import {formatCompactNumber} from '../core/formatNumber';
import {capyShieldCooldown,getMedallionLevel} from '../config/medallions';

export type HitTarget = { kind: 'cell'; col: number; row: number } | { kind: 'bench'; slot: number } | { kind:'bench-lock';slot:number } | { kind: 'shovel' };
type Position = { x: number; y: number };
type OrangeMotion = Position & { add: boolean; age: number; index: number; direction: number; targetY: number };

const FONT = '"Trebuchet MS", "Microsoft YaHei", "PingFang SC", sans-serif';
const TEAL = '#5f9b8c';
const CORAL = '#d28e78';
const cellCenter = (col:number,row:number):Position => ({x:STAGE.boardX+(col+.5)*STAGE.cell,y:STAGE.boardY+(row+.5)*STAGE.cell});
const clamp = (v:number,min:number,max:number) => Math.max(min,Math.min(max,v));

/** Immediate-mode Canvas renderer; game rules and pointer dispatch remain in core/UI. */
export class StickerRenderer {
  private readonly c: CanvasRenderingContext2D;
  readonly assets = assets;
  private pixelRatio = 0;
  private lastSeconds = 0;
  private sceneSeconds = 0;
  private guardianHappyUntil=Number.NEGATIVE_INFINITY;
  private guardianMoodEventId=0;
  private battleId = '';
  private readonly unitPositions = new Map<number, Position>();
  private previousOranges: Record<Side,number> | null = null;
  private orangeMotions: OrangeMotion[] = [];
  private readonly enemyMotion=new EnemyMotion();
  private readonly unitMotion=new UnitMotion();
  private animationPaused=false;
  private battleMap:MapId='sunny_backyard';
  private dust:{id:number;x:number;y:number;dir:number;age:number}[]=[];
  /** P17: live breakthrough chances supplied by the host for the 「可突破 x%」 labels. */
  private chances:Record<number,number>={};
  private readonly reducedMotion=typeof window!=='undefined'&&typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly managedViewport:boolean;
  private viewportTransform={scale:1,offsetX:0,offsetY:0};

  constructor(private readonly canvas: HTMLCanvasElement, options: { managedViewport?: boolean } = {}) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is required to draw the garden.');
    this.c = context;
    this.managedViewport = !!options.managedViewport;
    this.resize();
  }

  /** Used by mini-game hosts that own a full-screen canvas and map the 1280×720 stage into safe areas. */
  setViewportTransform(scale:number,offsetX:number,offsetY:number):void {
    this.viewportTransform={scale,offsetX,offsetY};
  }

  hitTest(x:number,y:number,context?:{state:BattleState;allowBenchLock:boolean;dragging?:boolean;touch?:boolean}):HitTarget|null {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const {boardX,boardY,cell,benchX,benchY,benchStep,benchSize,shovelX,shovelY}=STAGE;
    const boardBottom=boardY+cell*STAGE.rows;
    if (x>=boardX && x<boardX+cell*STAGE.cols && y>=boardY && y<boardBottom)
      return {kind:'cell',col:Math.floor((x-boardX)/cell),row:Math.floor((y-boardY)/cell)};
    // Touch screens extend the bench grab zone upward into the dead gap below the board (592..610)
    // so thumbs naturally start higher and stay well clear of the iOS bottom Home Indicator bar.
    const benchTop=context?.touch?boardBottom:benchY;
    if (y>=benchTop && y<benchY+benchSize) {
      for(let slot=0;slot<5;slot++) {
        const left=benchX+slot*benchStep;
        if(x>=left && x<left+benchSize){
          if(context?.allowBenchLock&&!context.dragging&&x<left+26&&y>=benchY&&y<benchY+26&&context.state.units.some(u=>u.side==='player'&&u.location.zone==='bench'&&u.location.slot===slot))return{kind:'bench-lock',slot};
          return {kind:'bench',slot};
        }
      }
    }
    if(Math.hypot(x-shovelX,y-shovelY)<=41) return {kind:'shovel'};
    return null;
  }

  draw(state:BattleState,seconds:number,interaction:Interaction={}):void {
    this.resize();
    const fresh=this.battleId!==state.id;
    const dt=fresh||state.phase==='paused'?0:clamp(seconds-this.lastSeconds,0,.1); this.lastSeconds=seconds;
    if(this.battleId!==state.id) {
      this.battleId=state.id; this.unitPositions.clear(); this.previousOranges=null; this.orangeMotions=[];this.enemyMotion.clear();this.unitMotion.clear();this.dust=[];
      this.guardianHappyUntil=Number.NEGATIVE_INFINITY;this.guardianMoodEventId=state.events.reduce((max,event)=>Math.max(max,event.id),0);
      this.sceneSeconds=seconds;
    }
    // Integrate only visible playing frames: resuming must never jump to wall time.
    this.sceneSeconds+=dt;
    seconds=this.sceneSeconds;
    this.animationPaused=state.phase==='paused';this.battleMap=state.mapId;
    this.observeOranges(state,dt);
    const c=this.c;
    if(this.managedViewport){
      const {scale,offsetX,offsetY}=this.viewportTransform;
      c.setTransform(scale,0,0,scale,offsetX,offsetY);
    }else{
      c.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);
      c.clearRect(0,0,STAGE.width,STAGE.height);
    }
    c.lineCap='round';c.lineJoin='round';c.textBaseline='middle';
    this.drawPaper(state.mapId);
    this.drawBoard(state,seconds);
    this.drawTraps(state);
    this.drawInteractionUnderlay(state,interaction,seconds);
    this.observeGuardianMood(state,seconds);
    this.chances=interaction.breakthroughChances??{};
    this.drawGuardian(state.mapId,state.sides.player.oranges,seconds,state.sides.player.loadout.activeBrothId,getActiveBroth(state.sides.player.loadout)?.level??1,this.capyShield(state));
    const source=this.mergeSource(state,interaction),targets=new Map(source?getMergeTargets(state,source.id).map(t=>[t.unitId,t]):[]);

    const liveIds=new Set(state.units.map(unit=>unit.id));
    this.unitMotion.retain(new Set(state.units.filter(unit=>unit.location.zone==='board').map(unit=>unit.id)));
    for(const id of this.unitPositions.keys()) if(!liveIds.has(id)) this.unitPositions.delete(id);
    for(const unit of [...state.units].filter(unit=>unit.side==='player'&&unit.location.zone==='board'&&unit.kind!=='shovel').sort((a,b)=>this.position(a).y-this.position(b).y)) {
      const target=this.position(unit), previous=this.unitPositions.get(unit.id)||target;
      const ease=1-Math.exp(-dt*16);
      const point={x:previous.x+(target.x-previous.x)*ease,y:previous.y+(target.y-previous.y)*ease};
      this.unitPositions.set(unit.id,point);
      const opacity=interaction.draggingId===unit.id ? .23 : targets.size&&!targets.has(unit.id)&&source?.id!==unit.id ? .72 : 1;
      this.drawUnit(unit,point,seconds,opacity,false,state.sides[unit.side].loadout,this.mergeScale(unit,targets.has(unit.id),interaction,seconds));
    }
    const enemies=state.enemies.filter(enemy=>enemy.side==='player');
    const enemyIds=new Set(enemies.map(enemy=>enemy.id));this.enemyMotion.retain(enemyIds);
    this.dust=this.dust.filter(puff=>enemyIds.has(puff.id)&&(puff.age+=dt)<.42);
    for(const enemy of [...enemies].sort((a,b)=>a.row-b.row))this.drawEnemy(enemy,seconds,state.phase==='paused',getMap(state.mapId).paths.player);
    this.drawDust();
    this.drawEvents(state,seconds,false,interaction.showDamageNumbers!==false);
    this.drawOrangeMotions();
    this.drawFog(state,seconds);
    this.drawNests(state,interaction,seconds,true);
    this.drawTools(state,interaction,seconds);
    this.drawEvents(state,seconds,true,interaction.showDamageNumbers!==false);
    const passiveRects=this.drawPassiveMergeOverlay(state,interaction,seconds);
    this.drawActiveMergeHighlights(state,interaction,seconds,passiveRects);
    this.drawPropUnitTargets(state,interaction,seconds);
    this.drawDrag(state,interaction,seconds);
  }

  private resize():void {
    if(this.managedViewport)return;
    const ratio=clamp(typeof window==='undefined'?1:window.devicePixelRatio||1,1,2.5);
    if(this.pixelRatio===ratio && this.canvas.width===Math.round(STAGE.width*ratio) && this.canvas.height===Math.round(STAGE.height*ratio)) return;
    this.pixelRatio=ratio;
    this.canvas.width=Math.round(STAGE.width*ratio);this.canvas.height=Math.round(STAGE.height*ratio);
  }

  private label(text:string,x:number,y:number,size=16,color=INK,align:CanvasTextAlign='left',weight=700,maxWidth?:number):void {
    const c=this.c;c.font=`${weight} ${size}px ${FONT}`;c.textAlign=align;c.fillStyle=color;
    if(maxWidth) c.fillText(text,x,y,maxWidth); else c.fillText(text,x,y);
  }

  /** Dedicated animal gathering; preview never enters the battle-map drawing path. */
  drawPreview(mapId:MapId,seconds:number,oranges=3):void {
    this.resize();this.battleId='';this.lastSeconds=seconds;this.sceneSeconds=seconds;this.unitPositions.clear();
    this.enemyMotion.clear();this.unitMotion.clear();this.dust=[];this.previousOranges=null;this.orangeMotions=[];
    const c=this.c;
    if(this.managedViewport){
      const {scale,offsetX,offsetY}=this.viewportTransform;
      c.setTransform(scale,0,0,scale,offsetX,offsetY);
    }else{
      c.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);
      c.clearRect(0,0,STAGE.width,STAGE.height);
    }
    c.lineCap='round';c.lineJoin='round';c.textBaseline='middle';
    drawSplashScene(c,this.assets,mapId,seconds,oranges);
  }

  private drawPaper(mapId:MapId):void {
    const c=this.c,map=this.assets.get(`map_${mapId}`);
    if(map){c.drawImage(map,0,0,STAGE.width,STAGE.height);return;}
    const theme=getMap(mapId).theme;
    c.fillStyle=theme.paper;c.fillRect(0,0,STAGE.width,STAGE.height);
    const g=c.createLinearGradient(0,0,0,STAGE.height);g.addColorStop(0,theme.paper);g.addColorStop(1,theme.open);
    c.fillStyle=g;c.fillRect(0,0,STAGE.width,STAGE.height);
    // Landscape fallback ornament stays in the scene margins, away from usable tiles.
    for(const [x,y] of [[STAGE.boardX*.38,STAGE.height*.52],[STAGE.width-STAGE.boardX*.38,STAGE.height*.45]])this.flower(x,y,16,theme.accent);
  }

  private flower(x:number,y:number,size:number,color:string):void {
    const c=this.c;
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ellipse(c,x+Math.cos(a)*size*.6,y+Math.sin(a)*size*.6,size*.5,size*.5,color,color,0);}
    ellipse(c,x,y,size*.32,size*.32,'#f4d482','#f4d482',0);
  }

  private drawBoard(state:Pick<BattleState,'mapId'|'grid'|'craterHits'>,seconds:number):void {
    const c=this.c,{boardX:x,boardY:y,cell}=STAGE,map=getMap(state.mapId),theme=map.theme;
    c.save();c.beginPath();c.rect(x,y,cell*STAGE.cols,cell*STAGE.rows);c.clip();
    const mapImage=this.assets.get(`map_${state.mapId}`);

    for(let row=0;row<STAGE.rows;row++) for(let col=0;col<STAGE.cols;col++) {
      const tile=state.grid[row][col],tx=x+col*cell,ty=y+row*cell;
      const grass=tile==='G'||tile==='B';
      if(!mapImage){
        c.fillStyle=grass?theme.grass[(row+col)%2]:tile==='O'?theme.open:tile==='C'?theme.water:theme.road;
        c.fillRect(tx,ty,cell,cell);
      }
      const tileImage=tile==='O'?(this.assets.get(`tile_open_${state.mapId}`)||this.assets.get('tile_open')):tile==='B'?this.assets.get('tile_broken'):undefined;
      if(tileImage){c.drawImage(tileImage,tx+2,ty+2,cell-4,cell-4);}
      else if(tile==='G'&&!mapImage) {
        // Tiny tufts reveal diggable grass without competing with the pets.
        for(let i=0;i<3;i++) {
          const ox=13+(col*13+row*7+i*23)%49,oy=16+(row*17+col*11+i*19)%41;
          line(c,[[tx+ox-4,ty+oy+2],[tx+ox-2,ty+oy-4],[tx+ox+1,ty+oy+1],[tx+ox+5,ty+oy-2]],'#94b17c',1.4);
        }
        if((row*STAGE.cols+col)%9===2) this.flower(tx+52,ty+52,4,'#f6eed0');
      } else if(tile==='O') {
        round(c,tx+3,ty+3,cell-6,cell-6,8,'rgba(255,248,232,0.78)','#eee1c6',1);
        c.fillStyle='rgba(218,148,119,.095)';
        for(let i=9;i<cell;i+=18){c.fillRect(tx+i,ty,5,cell);c.fillRect(tx,ty+i,cell,5);}
        c.save();c.strokeStyle='#d8cbb1';c.lineWidth=1;c.setLineDash([3,4]);c.strokeRect(tx+5,ty+5,cell-10,cell-10);c.restore();
        round(c,tx+2,ty+2,cell-4,cell-4,5,'rgba(255,255,255,0)','#eee1c6',1);
      } else if(tile==='R'&&!mapImage) {
        ellipse(c,tx+16+(col*7)%30,ty+18+(row*9)%28,2,1.4,'#c5ac87','#c5ac87',0);
        ellipse(c,tx+51,ty+55,2.5,1.2,'#d0b58f','#d0b58f',0);
      } else if(tile==='B') {
        c.save();c.translate(tx+cell/2,ty+cell/2+3);c.rotate(-.12);
        round(c,-25,-16,49,31,7,'#ae9c7f',INK,2.3);round(c,-28,-3,9,22,4,'#978a70',INK,2);round(c,19,-3,10,22,4,'#978a70',INK,2);
        line(c,[[-17,-10],[-6,-2],[-13,9],[3,16]],'#665c48',2.3);line(c,[[11,-11],[6,-3],[16,5]],'#665c48',2.3);
        polygon(c,[[-3,-10],[3,-8],[0,-2],[7,1]],'#e2d2b1',INK,1);c.restore();
        ellipse(c,tx+13,ty+54,3,2,'#e1d4ba',INK,0);ellipse(c,tx+57,ty+18,3,2,'#e1d4ba',INK,0);
      } else if(tile==='S'&&!mapImage) {
        c.save();c.translate(tx+cell/2,ty+cell/2+1);
        ellipse(c,0,11,30,17,'#bd9d77',INK,1.8);ellipse(c,0,5,25,21,'#6e6955',INK,2.8);ellipse(c,0,11,21,11,'#555443',INK,0);
        line(c,[[-23,9],[-22,-5],[-10,-17],[9,-18],[24,-5],[24,10]],'#9a9271',7);
        ellipse(c,-5,5,2,2,'#f3d495',INK,0);ellipse(c,5,5,2,2,'#f3d495',INK,0);
        c.restore();
      }
      if(tile==='B'&&state.craterHits[col+','+row]){round(c,tx+28,ty+cell-26,40,21,7,'#fff2c9',INK,1.5);this.label('1/2',tx+48,ty+cell-15,13,INK,'center',800);}
      {c.strokeStyle='rgba(60,48,34,0.12)';c.lineWidth=1;c.strokeRect(tx+.5,ty+.5,cell-1,cell-1);}
    }
    for(const side of ['player'] as const) {
      const path=map.paths[side];
      for(let i=1;i<path.length-1;i++) {
        if(i%2===0) continue;
        const a=cellCenter(path[i].col,path[i].row), b=cellCenter(path[i+1].col,path[i+1].row);
        c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(b.y-a.y,b.x-a.x));
        c.globalAlpha=.32+.04*Math.sin(seconds*2-i);line(c,[[-4,-5],[2,0],[-4,5]],'#9d825d',2.5);c.restore();
      }
    }
    c.restore();

  }

  /** P17 Capybara Bubble Shield state for the bath (endless with the medallion only). */
  private capyShield(state:BattleState):{ready:boolean;progress:number;popAge?:number}|undefined {
    const level=state.endless?getMedallionLevel(state.sides.player.loadout,'med_capy_shield'):0;if(!level)return undefined;
    const player=state.sides.player,cooldown=capyShieldCooldown(level),pop=state.events.filter(event=>event.type==='shield_block').at(-1);
    return{ready:player.capyShieldReady,progress:player.capyShieldReady?1:clamp(1-player.capyShieldTimer/cooldown,0,1),...(pop?{popAge:pop.age}:{})};
  }
  /** P15 five-layer bath: the map already holds layer 1; see GuardianBathRenderer for layers 2-5. */
  private drawGuardian(mapId:MapId,oranges:number,seconds:number,activeBrothId?:string|null,brothLevel=1,shield?:{ready:boolean;progress:number;popAge?:number}):void {
    drawGuardianBath({
      c:this.c,
      image:id=>this.assets.get(id),
      drawImage:(image,width,height,x,y)=>this.drawImage(image,width,height,x,y),
      orange:(x,y,size,rotation)=>this.drawOrangeArt(x,y,size,rotation),
      vectorCapybara:dizzy=>drawSoakingCapybaraArt(this.c,dizzy),
    },{mapId,oranges,seconds,activeBrothId,brothLevel,happyUntil:this.guardianHappyUntil,...(shield?{shield}:{})});
  }

  /** A cleared wave or a fresh legendary merge earns the guardian a happy beat (scene time, so pauses freeze it). */
  private observeGuardianMood(state:BattleState,seconds:number):void {
    for(const event of state.events){
      if(event.id<=this.guardianMoodEventId)continue;
      this.guardianMoodEventId=event.id;
      const cleared=event.type==='bubble'&&event.textKey==='hint.wave'&&(event.value??0)>1;
      if(cleared||(event.type==='purge'&&(event.effect==='legendary'||event.effect==='awakened'))||event.type==='shield_block')this.guardianHappyUntil=seconds+HAPPY_DURATION;
    }
  }

  private drawOrangeArt(x:number,y:number,size:number,rotation:number):void {
    const image=this.assets.get('orange');
    if(!image){drawOrange(this.c,x,y,size,rotation);return;}
    this.c.save();this.c.translate(x,y);this.c.rotate(rotation);this.drawImage(image,size*2.3,size*2.3);this.c.restore();
  }

  private position(unit:Unit):Position {
    return propUnitCenter(unit);
  }

  private drawUnit(unit:Unit,position:Position,seconds:number,opacity=1,drag=false,loadout:Partial<BattleLoadout>={},highlightScale=1):void {
    const c=this.c,hero=HEROES[unit.kind],onBench=unit.location.zone==='bench';
    const requiredCharge=hero?combatCharge(unit,loadout):1;
    const scale=(onBench ? .85 : .92)*(1+(unit.level-1)*.06);
    const motion=onBench?undefined:this.unitMotion.sample(unit,seconds,this.animationPaused);
    const pose=motion?.body??{x:0,y:0,scaleX:1,scaleY:1};
    const wave=Math.sin(seconds*2.7+unit.id*1.71);
    c.save();c.globalAlpha=opacity;c.translate(position.x,position.y);c.scale(highlightScale,highlightScale);
    if(unit.kind==='shovel'){this.drawShovel(false);if(!drag){round(c,16,-37,33,20,6,'#f2d68c',INK,1.4);this.label(t('render.dig'),32,-27,14,INK,'center',800);}c.restore();return;}
    ellipse(c,0,25,(hero?25:22)*scale,6,'rgba(72,79,53,.14)','',0);
    c.save();if(!onBench)c.scale(1.2,1.2);
    if(hero) {
      ellipse(c,0,24,32,12,'#f3d58a','#bb9146',2.3);
      ellipse(c,0,24,27,8,hero.color,'#ffeab0',1.8);
      if(unit.energy>=requiredCharge-1) {c.save();c.globalAlpha*=.4+.15*Math.sin(seconds*5);ellipse(c,0,1,33,33,'rgba(255,255,255,0)','#f1c966',2);c.restore();}
      if(unit.awakened)this.drawAwakenedRing(seconds,unit.id);
    }
    c.restore();
    c.save();c.translate(pose.x,pose.y-2-Math.max(0,unit.animation)*3);c.scale(scale*(1+wave*.018)*pose.scaleX*(motion?.visualFacing??1)*(motion?.spawnScale??1),scale*(1-wave*.025)*pose.scaleY*(motion?.spawnScale??1));
    if(unit.statuses.KNOCKDOWN)c.rotate(-.55);
    // P17: an awakened hero wears its new sticker; until it decodes the original art stands in.
    const override=(unit.awakened?this.assets.get(`${unit.kind}_awakened`):undefined)??this.assets.get(unit.kind);
    if(override){if(motion){c.save();c.translate(0,-3);drawPuppetSprite(c,override,88,motion.rig);c.restore();}else this.drawImage(override,77,77,0,-3);}else {if(!onBench)c.scale(88/77,88/77);drawUnitArt(c,unit.kind,seconds);}
    if(unit.buffTime>0){star(c,-30,-24+Math.sin(seconds*4)*2,5,'#efcf72',1);star(c,31,10,3.5,'#f9e19b',1);}
    c.restore();
    if(!drag){c.save();c.translate(pose.x,pose.y);c.scale(motion?.spawnScale??1,motion?.spawnScale??1);drawHeldWeapon(c,unit,seconds,loadout);c.restore();}
    if(unit.animation>.1){c.save();c.globalAlpha*=Math.min(.2,unit.animation*.16);ellipse(c,0,-3,20,22,'#fffce5','#fffce5',0);c.restore();}
    if(!drag) {
      c.save();if(!onBench)c.scale(1.2,1.2);
      const badgeColor=hero?'#f1cc7d':'#fff7e3';
      // P17: awakened heroes trade the gold "5" for a caramel-red badge with a warm gold star.
      if(unit.awakened){round(c,14,-31,22,18,6,'#b5462e',INK,1.6);this.label('★',25,-21,14,'#ffd66b','center',900);}
      else if((unit.clippedLevels??0)>0){round(c,10,-31,28,18,6,'#ffd5dc','#b52b42',1.8);this.label(`${unit.level}↓`,24,-21,13,'#9e182e','center',900);}
      else{round(c,14,-31,22,18,6,badgeColor,INK,1.6);this.label(String(unit.level),25,-21,14,INK,'center',800);}
      if(hero){
        round(c,-24,30,48,6,3,'#ded6c3',INK,1);const fill=clamp(unit.energy/requiredCharge,0,1);
        if(fill>0)round(c,-23,31,46*fill,4,2,hero.color,hero.color,0);
      }
      this.drawStatus(unit,seconds);c.restore();
    }
    c.restore();
  }

  /**
   * Restrained awakening aura (no glow balls, no white flashes): one thin warm-gold double ring that breathes
   * between 0.55 and 0.78 alpha, and three small embers drifting 28px up. Paused or reduced motion freezes both.
   */
  private drawAwakenedRing(seconds:number,id:number):void {
    const c=this.c,still=this.reducedMotion,t=still?0:seconds,breath=.665+.115*Math.sin(t*2.2+id);
    c.save();c.globalAlpha*=breath;c.lineWidth=2;c.strokeStyle='rgba(255, 206, 92, 0.72)';
    c.beginPath();c.ellipse(0,24,36,13,0,0,Math.PI*2);c.stroke();
    c.setLineDash([4,5]);c.lineDashOffset=-t*6;c.beginPath();c.ellipse(0,24,41,16,0,0,Math.PI*2);c.stroke();c.restore();
    for(let i=0;i<3;i++){
      const phase=still?(i+.5)/3:(t*.42+i/3+id*.137)%1,x=Math.sin(i*2.1+id)*16+(still?0:Math.sin(t*1.3+i)*2),y=22-phase*28;
      c.save();c.globalAlpha*=Math.min(.65,.65*Math.sin(phase*Math.PI));
      ellipse(c,x,y,1.25+.25*(i%3),1.25+.25*(i%3),i===1?'#ffd36b':'#f6a04a','',0);c.restore();
    }
  }
  private drawStatus(unit:Unit,seconds:number):void {
    const c=this.c;
    if(unit.washing&&unit.washing>0)drawWasher(c,seconds,unit.washing);
    if(unit.statuses.SEALED)drawSealed(c,seconds);
    if(unit.statuses.WET)drawWet(c,seconds);
    if(unit.statuses.KNOCKDOWN)for(let i=0;i<3;i++){const a=seconds*2+i*Math.PI*2/3;star(c,Math.cos(a)*24,-31+Math.sin(a)*5,4,'#edcd77',1);}
    if(unit.statuses.CONFUSED)confusionSpiral(c,seconds);
    if(unit.statuses.MERGE_LOCK) {
      ellipse(c,-25,17,11,11,'#e6b6a5',INK,1.7);
      ellipse(c,-29,19,2.5,2.5,'#f8ede0',INK,1.2);ellipse(c,-22,19,2.5,2.5,'#f8ede0',INK,1.2);
      line(c,[[-28,17],[-22,10]],INK,1.5);line(c,[[-23,17],[-29,10]],INK,1.5);
    }
  }

  private drawEnemy(enemy:Enemy,seconds:number,paused:boolean,path:readonly {col:number;row:number}[]):void {
    const c=this.c,p=cellCenter(enemy.col,enemy.row),boss=enemy.boss;
    const size=(boss?1.14:.96)*clamp(enemy.size||1,.75,boss?1.6:1.5),base=boss?126:98;
    const pose=this.enemyMotion.sample(enemy,seconds,paused,path);
    if(!paused&&pose.footfall){this.dust.push({id:enemy.id,x:p.x-pose.dirX*20,y:p.y+30,dir:pose.dirX,age:0});if(this.dust.length>48)this.dust.shift();}
    c.save();c.translate(p.x+(enemy.hitFlash>0?(enemy.knockX||0)+Math.sin(seconds*95)*1.4:0),p.y+(enemy.hitFlash>0?(enemy.knockY||0):0));
    ellipse(c,0,boss?39:29,(boss?35:26)*pose.shadowScale,6*pose.shadowScale,'rgba(80,70,51,.19)','',0);
    if(boss&&enemy.knockbackImmune){
      const pulse=.6+.3*Math.sin(seconds*6);
      c.save();c.globalAlpha*=pulse;
      ellipse(c,0,38,44,12,'rgba(235,92,58,.18)','#e8593c',2.6);
      ellipse(c,0,38,50,15,'rgba(0,0,0,0)','#ffd166',1.6);
      c.restore();
    }
    drawLandingRipple(c,pose,base*size);
    c.save();c.translate(0,pose.hopY);c.rotate(pose.tilt+pose.bankTilt);
    c.scale(size*pose.squashX*(1+pose.jello*.19+pose.roar*.10)*pose.visualFlip*pose.spawnScale,size*pose.squashY*(1-pose.jello*.15+pose.roar*.14)*pose.spawnScale);
    drawEnemyAccents(c,enemy,pose,base);
    const override=this.assets.get(enemy.kind);
    if(enemy.hitFlash>0)c.filter='brightness(0) invert(1)';
    if(override){c.save();c.translate(0,-4);drawPuppetSprite(c,override,base,pose.rig);c.restore();}
    else {c.scale(base/79,base/79);drawEnemyArt(c,enemy.kind,pose.artSeconds);}
    if(enemy.boneShield)boneShield(c);c.restore();
    const width=boss?68:42,height=boss?9:7,y=-base*size*.5-8;
    round(c,-width/2,y,width,height,3,'#d9bea4',INK,1);
    const hp=clamp(enemy.hp/enemy.maxHp,0,1);
    if(hp>0)round(c,-width/2+1,y+1,(width-2)*hp,height-2,2,boss?'#d98a77':'#9eae7b','',0);
    if(boss)star(c,-width/2-8,y+height/2,5,'#e2b46e',1.2);
    if(boss&&enemy.knockbackImmune){
      const tag=t('p19.unstoppableTag'),tw=Math.max(38,tag.length*11+14);
      round(c,-tw/2,y-22,tw,18,7,'#c93828','#ffd166',1.6);
      this.label(tag,0,y-13,11,'#fff7d6','center',900);
    }
    if(enemy.stun>0){for(let i=0;i<2;i++)star(c,Math.sin(seconds*5+i*3)*17,y-7,3.5,'#f7d37b',1);}
    if(enemy.burn>0){polygon(c,[[-5,20],[-9,12],[-3,14],[0,5],[4,13],[8,10],[6,21]],'#edb15c','#d98964',1.3);}
    if(enemy.poison>0){ellipse(c,19,3,4,4,'#99b483',INK,1);ellipse(c,24,-5,2.4,2.4,'#a5bb8c',INK,1);}
    if((enemy.hasteTime||0)>0){line(c,[[-25,9],[-32,9]],'#b69bc6',2.5);line(c,[[-23,16],[-35,16]],'#b69bc6',2);star(c,22,-15,4,'#c4a3cf',1);}
    c.restore();
  }

  private drawDust():void {
    const c=this.c,image=this.assets.get('vfx_dust_puff');
    for(const puff of this.dust){
      const p=puff.age/.42;c.save();c.globalAlpha=.22*(1-p);c.translate(puff.x-puff.dir*p*22,puff.y-p*8);
      if(image)this.drawImage(image,22+p*16,17+p*12);
      else {ellipse(c,-5,0,7+p*7,4+p*4,'#d8c5a1','',0);ellipse(c,5,-2,6+p*5,5+p*3,'#e3d4b5','',0);}
      c.restore();
    }
  }

  private drawInteractionUnderlay(state:BattleState,interaction:Interaction,seconds:number):void {
    const c=this.c,drag=state.units.find(unit=>unit.id===interaction.draggingId),selected=state.units.find(unit=>unit.id===(interaction.previewSourceId??interaction.selectedId));
    const source=drag??selected,benchTool=source?.kind==='shovel'&&source.location.zone==='bench';
    const digging=!!interaction.shovel||benchTool,canDig=benchTool||state.sides.player.shovels>=1;
    if(interaction.propId){this.drawPropTargets(state,interaction,seconds);return;}
    for(const hint of this.passiveCallouts(state,interaction).filter(h=>h.zone==='board')){
      const p=this.position(state.units.find(u=>u.id===hint.unitId)!),hero=hint.kind==='hero',pulse=(1+Math.sin(seconds*3))/2;
      c.save();c.globalAlpha=.5+pulse*.24;
      ellipse(c,p.x,p.y+6,48+pulse*3,42+pulse*3,'transparent',hero?'rgba(244,190,55,.28)':'rgba(56,184,109,.28)',8);
      ellipse(c,p.x,p.y+6,48+pulse*3,42+pulse*3,'transparent',hero?'#e7b33e':'#4bb780',2.5);c.restore();
    }
    if(selected?.location.zone==='board'&&!drag&&!interaction.shovel) {
      const p=this.position(selected),range=combatRange(selected,state.sides[selected.side].loadout);
      c.save();c.beginPath();c.rect(STAGE.boardX,STAGE.boardY,STAGE.cell*STAGE.cols,STAGE.cell*STAGE.rows);c.clip();
      if(range>0){c.fillStyle='rgba(92,153,138,.09)';c.strokeStyle='rgba(82,137,121,.58)';c.lineWidth=1.8;c.setLineDash([5,6]);c.beginPath();c.arc(p.x,p.y,range*STAGE.cell,0,Math.PI*2);c.fill();c.stroke();}
      c.restore();round(c,p.x-32,p.y-32,64,64,12,'rgba(255,248,221,.16)',TEAL,3);
    }
    if(drag||digging) {
      for(let row=0;row<STAGE.rows;row++)for(let col=0;col<STAGE.cols;col++){
        const tile=state.grid[row][col],valid=digging?canDig&&(tile==='G'||tile==='B'):tile==='O';
        const occupied=state.units.some(u=>u.location.zone==='board'&&u.location.col===col&&u.location.row===row);
        if(valid&&(digging||!occupied)){const p=cellCenter(col,row);c.save();if(!digging)c.setLineDash([5,8]);round(c,p.x-40,p.y-40,80,80,10,'rgba(255,253,222,.08)',digging?'#c9a25a':'rgba(122,161,140,.45)',1.5);c.restore();}
      }
    }
    const hover=interaction.hover||(interaction.pointer?this.hitTest(interaction.pointer.x,interaction.pointer.y):null);
    const point=hover&&'col'in hover&&'row'in hover?hover:null;
    if(point&&(drag||digging)) {
      const tile=state.grid[point.row]?.[point.col],own=point.row>=0&&point.row<STAGE.rows&&point.col>=0&&point.col<STAGE.cols;
      const p=cellCenter(point.col,point.row),target=state.units.find(unit=>unit.side==='player'&&unit.location.zone==='board'&&unit.location.col===point.col&&unit.location.row===point.row);
      const outcome=!digging&&drag&&target&&drag.id!==target.id?MergeSystem.combine(drag,target):null;
      const valid=own&&(digging?canDig&&(tile==='G'||tile==='B'):tile==='O')&&(!outcome||outcome.ok);
      const merging=!!outcome?.unit;
      round(c,p.x-34,p.y-34,68,68,12,valid?'rgba(251,237,163,.4)':'rgba(218,138,119,.22)',valid?(merging?'#cfaa54':TEAL):CORAL,3);
      if(valid&&merging){star(c,p.x+25,p.y-25,7,'#f1cf75',1.6);star(c,p.x-24,p.y+24,5,'#f1cf75',1.3);}
      else if(!valid){line(c,[[p.x-6,p.y-6],[p.x+6,p.y+6]],CORAL,2.7);line(c,[[p.x+6,p.y-6],[p.x-6,p.y+6]],CORAL,2.7);}
    }
    this.drawMergeTargets(state,interaction,seconds,'board');
  }

  private drawTraps(state:BattleState):void {
    for(const trap of (state.traps||[]).filter(trap=>trap.side==='player')) {
      const point=cellCenter(trap.col,trap.row);this.c.save();this.c.translate(point.x,point.y);
      const image=this.assets.get('glue_trap_placed');if(image)this.drawImage(image,65,52);else drawGlueTrap(this.c,trap.charges);
      this.label(String(trap.charges),20,-15,11,INK,'center',800);this.c.restore();
    }
  }

  private drawMergeTargets(state:BattleState,interaction:Interaction,seconds:number,zone:'board'|'bench',onlyId?:number):void {
    const source=this.mergeSource(state,interaction);if(!source)return;
    for(const target of getMergeTargets(state,source.id)){
      const unit=state.units.find(unit=>unit.id===target.unitId);
      if(!unit||unit.location.zone!==zone||(onlyId!==undefined&&unit.id!==onlyId))continue;
      const c=this.c,p=this.position(unit),pulse=(Math.sin(seconds*4+unit.id)+1)/2,hero=target.kind==='hero'&&!target.feedHero;
      c.save();
      round(c,p.x-45,p.y-45,90,90,17,hero?'rgba(255,224,102,.32)':'rgba(142,242,178,.28)','',0);
      round(c,p.x-45,p.y-45,90,90,17,'transparent',hero?`rgba(244,190,55,${(.22+pulse*.14).toFixed(2)})`:`rgba(56,184,109,${(.22+pulse*.14).toFixed(2)})`,10);
      round(c,p.x-45,p.y-45,90,90,17,'transparent',hero?'#df9118':'#2c9d59',hero?4:3.5);c.restore();
    }
  }

  private mergeSource(state:BattleState,interaction:Interaction):Unit|undefined {
    if(interaction.shovel||interaction.propId)return;
    const held=interaction.draggingId??interaction.previewSourceId;
    const source=state.units.find(u=>u.id===(held??interaction.selectedId)&&u.side==='player');
    return source&&(held!==undefined||getMergeTargets(state,source.id).length)?source:undefined;
  }
  private passiveCallouts(state:BattleState,interaction:Interaction){
    if(interaction.draggingId!==undefined||interaction.previewSourceId!==undefined||interaction.shovel||interaction.propId)return [];
    const source=this.mergeSource(state,interaction),covered=new Set(source?getMergeTargets(state,source.id).map(t=>t.unitId):[]);
    return getPassiveMergeCallouts(state).filter(h=>!covered.has(h.unitId));
  }
  /** Same-phase partner badges stay above sprites and combat effects even with an unrelated selection. */
  private drawPassiveMergeOverlay(state:BattleState,interaction:Interaction,seconds:number):StageRect[] {
    const used:StageRect[]=[],c=this.c,pulse=(1+Math.sin(seconds*3))/2;
    for(const hint of this.passiveCallouts(state,interaction)){
      const unit=state.units.find(u=>u.id===hint.unitId)!,p=(unit.location.zone==='board'?this.unitPositions.get(unit.id):undefined)??this.position(unit);
      const hero=hint.kind==='hero',radius=unit.location.zone==='board'?47+pulse*4:42+pulse*3;
      c.save();
      ellipse(c,p.x,p.y,radius,radius*.92,'transparent',hero?`rgba(255,170,0,${(.24+pulse*.14).toFixed(2)})`:`rgba(29,185,100,${(.22+pulse*.14).toFixed(2)})`,9);
      ellipse(c,p.x,p.y,radius,radius*.92,'transparent',hero?'#ffaa00':'#1db964',hero?3.5:3);
      if(hero)ellipse(c,p.x,p.y,radius+4,radius*.92+4,'transparent','#fff5ad',1.8);
      this.drawBenchBadge('ui_merge_sparkle',p.x+(unit.location.zone==='board'?-38:38),p.y+(unit.location.zone==='board'?-29:0),hero?26:20);
      const label=hint.breakthroughBaseId!==undefined?t('p17.canBreak',{pct:Math.round((this.chances[hint.breakthroughBaseId]??0)*100)}):t(hero?'p8.merge':'p8.upgrade');c.font=`900 13px ${FONT}`;
      const width=c.measureText(label).width+(hero?34:18),height=24;
      const rect=placeMergeCallout(p,width,height,interaction.mergeAvoidRects??[],used,34);used.push(rect);
      round(c,rect.x,rect.y,width,height,9,hero?'#ffd84d':'#7ef2ad',hero?'#5c3408':'#145c32',2);
      if(hero&&hint.heroId){const image=this.assets.get(hint.heroId);if(image)c.drawImage(image,rect.x+4,rect.y+2,20,20);else{c.save();c.translate(rect.x+14,rect.y+12);c.scale(.25,.25);drawUnitArt(c,hint.heroId,seconds);c.restore();}}
      this.label(label,rect.x+(hero?28:9),rect.y+12,13,hero?'#1f1105':'#0a331b','left',900);
      c.restore();
    }
    return used;
  }
  private mergeScale(unit:Unit,isTarget:boolean,interaction:Interaction,seconds:number):number {
    if(!isTarget)return 1;
    const hit=interaction.pointer?this.hitTest(interaction.pointer.x,interaction.pointer.y):null;
    const loc=unit.location,hover=loc.zone==='board'?interaction.hover??(hit?.kind==='cell'?hit:null):null;
    const hot=loc.zone==='board'?hover?.col===loc.col&&hover?.row===loc.row:hit?.kind==='bench'&&hit.slot===loc.slot;
    return hot&&interaction.draggingId!==undefined?1.12:1+.07*(1+Math.sin(seconds*4+unit.id))/2;
  }
  /** Foreground layer: never hide the outcome behind the pet or the nest background. */
  private drawActiveMergeHighlights(state:BattleState,interaction:Interaction,seconds:number,used:StageRect[]=[]):void {
    const source=this.mergeSource(state,interaction);if(!source)return;
    const c=this.c;
    const obstacles=interaction.mergeAvoidRects??[{x:0,y:0,w:STAGE.width,h:90}];
    for(const target of getMergeTargets(state,source.id)){
      const unit=state.units.find(u=>u.id===target.unitId)!;
      const p=(unit.location.zone==='board'?this.unitPositions.get(unit.id):undefined)??this.position(unit),hero=target.kind==='hero'&&!target.feedHero;
      const pulse=(1+Math.sin(seconds*4+unit.id))/2,radius=49+pulse*5;
      const ink=hero?'#78501e':'#235d40',bright=hero?'#f4be37':'#38b86d',light=hero?'#fff3b0':'#c8fbe0';
      c.save();
      ellipse(c,p.x,p.y,radius,radius*.93,'transparent',hero?`rgba(244,190,55,${(.25+pulse*.16).toFixed(2)})`:`rgba(56,184,109,${(.25+pulse*.16).toFixed(2)})`,11);
      ellipse(c,p.x,p.y,radius,radius*.93,'transparent',bright,3.8);
      ellipse(c,p.x,p.y,radius+4,radius*.93+4,'transparent',light,1.8);
      for(let i=0;i<3;i++){const a=seconds*.9+i*Math.PI*2/3;star(c,p.x+Math.cos(a)*(radius+4),p.y+Math.sin(a)*(radius+1),5.5,light,1);}
      const label=target.breakthrough?t('p17.canBreak',{pct:Math.round((this.chances[target.baseId??-1]??0)*100)}):hero?`→ ${t('hero.'+target.heroId)}`:t(target.feedHero?'p7.feed':'p7.upgrade',{level:target.nextLevel??unit.level+1});
      c.font=`900 15px ${FONT}`;
      const width=Math.min(290,c.measureText(label).width+(hero?46:22)),height=32;
      const placed=placeMergeCallout(p,width,height,obstacles,used),{x,y}=placed;used.push(placed);
      // A short tether preserves association when a top-row label moves below or sideways.
      const end={x:clamp(p.x,x,x+width),y:clamp(p.y,y,y+height)},dx=end.x-p.x,dy=end.y-p.y,d=Math.hypot(dx,dy);
      if(d>radius+2)line(c,[[p.x+dx/d*(radius+2),p.y+dy/d*(radius+2)],[end.x,end.y]],ink,2);
      round(c,x,y,width,height,12,light,ink,2.2);
      if(hero&&target.heroId){
        const image=this.assets.get(target.heroId);
        if(image)c.drawImage(image,x+5,y+3,26,26);
        else{c.save();c.translate(x+18,y+16);c.scale(.33,.33);drawUnitArt(c,target.heroId,seconds);c.restore();}
      }
      this.label(label,x+(hero?36:11),y+height/2,15,ink,'left',900,width-(hero?43:22));c.restore();
    }
  }

  private drawPropTargets(state:BattleState,interaction:Interaction,seconds:number):void {
    const id=interaction.propId!,kind=propTargetKind(id),c=this.c;
    if(kind==='self'){
      if(!interaction.pointer||!isInsideBattleBoard(interaction.pointer))return;
      const pulse=(1+Math.sin(seconds*4))/2;
      c.save();
      round(c,STAGE.boardX,STAGE.boardY,STAGE.cell*STAGE.cols,STAGE.cell*STAGE.rows,20,'rgba(255,222,128,.05)','',0);
      c.shadowColor='#f3c769';c.shadowBlur=22+pulse*10;
      round(c,STAGE.boardX,STAGE.boardY,STAGE.cell*STAGE.cols,STAGE.cell*STAGE.rows,20,'transparent','#edbe55',4+pulse);c.restore();
      return;
    }
    if(kind!=='road')return;
    const point=interaction.pointer??(interaction.hover?cellCenter(interaction.hover.col,interaction.hover.row):undefined);
    const target=point?resolvePropDrop(state,id,point):null;
    c.save();c.setLineDash([7,6]);c.lineDashOffset=-seconds*18;
    for(let row=0;row<STAGE.rows;row++)for(let col=0;col<STAGE.cols;col++)if(isValidPropRoad(state,col,row)){
      const p=cellCenter(col,row),hot=target?.col===col&&target?.row===row;
      round(c,p.x-44,p.y-44,88,88,12,hot?'rgba(246,203,105,.27)':'rgba(246,203,105,.07)','#d9a43d',hot?3.5:2);
    }
    c.restore();
  }

  /** Target rings remain visible above opaque nest art and the large board puppets. */
  private drawPropUnitTargets(state:BattleState,interaction:Interaction,seconds:number):void {
    const id=interaction.propId;if(!id||propTargetKind(id)!=='unit')return;
    const point=interaction.pointer??(interaction.hover?cellCenter(interaction.hover.col,interaction.hover.row):undefined);
    const target=point?resolvePropDrop(state,id,point):null,c=this.c;
    for(const unit of state.units)if(isValidPropUnit(state,id,unit)){
      const p=(unit.location.zone==='board'?this.unitPositions.get(unit.id):undefined)??this.position(unit);
      const pulse=(1+Math.sin(seconds*4+unit.id))/2,hot=target?.unitId===unit.id,color=hot?'#edb740':'#43bf86';
      c.save();c.globalAlpha=.7+pulse*.25;
      ellipse(c,p.x,p.y+28,35+pulse*3,11+pulse*2,'rgba(105,225,161,.1)','',0);
      ellipse(c,p.x,p.y+28,35+pulse*3,11+pulse*2,'transparent',hot?'rgba(237,183,64,.30)':'rgba(67,191,134,.30)',9);
      ellipse(c,p.x,p.y+28,35+pulse*3,11+pulse*2,'transparent',color,hot?3.5:2.5);
      if(hot)ellipse(c,p.x,p.y+28,40+pulse*3,16+pulse*2,'transparent','#fff1ad',1.8);
      c.restore();
    }
  }

  private drawNests(state:BattleState,interaction:Interaction,seconds:number,deferPassiveBadges=false):void {
    const c=this.c;
    const active=this.mergeSource(state,interaction),targets=new Map<number,MergeTarget>(active?getMergeTargets(state,active.id).map(t=>[t.unitId,t]):[]);
    const uncovered=new Set(this.passiveCallouts(state,interaction).map(h=>h.unitId));
    const hints=interaction.pointer?[]:getBenchMergeHints(state).filter(h=>uncovered.has(h.unitId));
    for(let slot=0;slot<5;slot++){
      const x=STAGE.benchX+slot*STAGE.benchStep,y=STAGE.benchY,w=STAGE.benchSize;
      const unit=state.units.find(unit=>unit.side==='player'&&unit.location.zone==='bench'&&unit.location.slot===slot);
      const hovered=interaction.pointer?this.hitTest(interaction.pointer.x,interaction.pointer.y):null;
      const hot=hovered?.kind==='bench'&&hovered.slot===slot&&interaction.draggingId!==undefined;
      const source=state.units.find(candidate=>candidate.id===interaction.draggingId);
      const benchSwap=source?.location.zone==='bench'&&(source.kind==='shovel'||unit?.kind==='shovel');
      const invalid=hot&&source&&unit&&(source.washing||unit.washing||source.statuses.MERGE_LOCK||unit.statuses.MERGE_LOCK||(source.id!==unit.id&&!benchSwap&&!MergeSystem.combine(source,unit).ok&&!(state.endless&&MergeSystem.breakthroughPair(source,unit))));
      const selected=unit&&unit.id===interaction.selectedId;
      c.save();c.shadowColor='rgba(93,80,54,.12)';c.shadowOffsetY=5;
      round(c,x,y,w,w,19,invalid?'#efd7c6':hot?'#efe8bf':unit?'#fff9e8':'#eee4cf',invalid?CORAL:selected||hot?TEAL:'#bbaa8a',selected||hot?2.8:1.9);c.restore();
      c.save();c.setLineDash([2,5]);round(c,x+6,y+6,w-12,w-12,14,'rgba(255,255,255,0)','#d5c6a7',1.2);c.restore();
      const locked=!!unit&&state.sides.player.lockedBenchSlot===slot;
      const hint=hints.find(h=>h.slot===slot);
      if(locked){round(c,x+1,y+1,w-2,w-2,18,'rgba(239,186,72,.08)','#bf8c2c',3);round(c,x+5,y+5,w-10,w-10,14,'transparent','#efc45d',1.5);}
      if(hint){c.save();c.globalAlpha=.65+Math.sin(seconds*3.5)*.25;round(c,x-1,y-1,w+2,w+2,20,'rgba(255,227,135,.08)',hint.kind==='hero'?'#e2b049':'#4bb780',hint.kind==='hero'?3.5:2.5);c.restore();}
      if(unit)this.drawMergeTargets(state,interaction,seconds,'bench',unit.id);
      if(unit)this.drawUnit(unit,this.position(unit),seconds,interaction.draggingId===unit.id ? .2 : targets.size&&!targets.has(unit.id)&&active?.id!==unit.id ? .72 : 1,false,state.sides[unit.side].loadout,this.mergeScale(unit,targets.has(unit.id),interaction,seconds));
      else {
        c.save();c.globalAlpha=.42;c.translate(x+w/2,y+w/2+1);ellipse(c,0,7,11,9,'#bbaa8c','',0);
        [[-11,-4],[-4,-10],[5,-10],[13,-3]].forEach(([px,py])=>ellipse(c,px,py,4,5,'#bbaa8c','',0));c.restore();
      }
      ellipse(c,x+5,y+5,3.5,3.5,'#faf3df','#a89779',1.2);
      if(unit&&interaction.allowBenchLock){
        c.save();c.globalAlpha=locked?1:.62;this.drawBenchBadge(locked?'ui_lock_closed':'ui_lock_open',x+13,y+13,24);c.restore();
      }
      // Full-frame rendering lifts these badges above every nest and combat effect.
      if(hint&&!deferPassiveBadges){
        const hero=hint.kind==='hero',size=hero?28:22;
        this.drawBenchBadge('ui_merge_sparkle',x+w-13,y+w-13+(hero?Math.sin(seconds*3.5)*2.5:0),size);
        if(hero){round(c,x+3,y+w-17,w-30,16,6,'#f4d582','#b88b33',1);this.label(t('p6.heroBadge'),x+(w-24)/2,y+w-9,11,'#68411b','center',800);}
      }
    }

  }

  private drawBenchBadge(id:'ui_lock_open'|'ui_lock_closed'|'ui_merge_sparkle',x:number,y:number,size:number):void {
    const c=this.c,image=this.assets.get(id);
    if(image){c.drawImage(image,x-size/2,y-size/2,size,size);return;}
    c.save();c.translate(x,y);c.scale(size/24,size/24);
    if(id==='ui_merge_sparkle'){ellipse(c,0,0,10,10,'#ffe7a2','#a87c28',1.6);star(c,0,0,7,'#edbc42',1.1);}
    else{line(c,id==='ui_lock_open'?[[-5,-1],[-5,-8],[1,-10],[6,-8]]:[[-5,-1],[-5,-8],[0,-10],[5,-8],[5,-1]],'#855d2d',3);round(c,-9,-2,18,13,4,'#edbd5d','#855d2d',1.5);ellipse(c,0,3,2,2,'#79572e','',0);line(c,[[0,4],[0,7]],'#79572e',2);}
    c.restore();
  }

  private drawTools(state:BattleState,interaction:Interaction,seconds:number):void {
    const c=this.c,{shovelX:x,shovelY:y}=STAGE;
    const source=state.units.find(unit=>unit.id===(interaction.draggingId??interaction.selectedId));
    const storing=source?.kind==='shovel'&&source.location.zone==='bench';
    const capacity=state.sides.player.loadout.equippedPassiveProps?.includes('auto_shovel')?6:4;
    const rules=state.sides.player.loadout.equippedPassiveProps?.includes('auto_shovel')?{interval:30,maxStored:6}:SHOVEL_PRODUCTION;
    const progress=state.sides.player.shovels>=rules.maxStored?1:clamp(state.sides.player.shovelTimer/rules.interval,0,1);
    c.save();c.strokeStyle='rgba(119,91,42,.2)';c.lineWidth=5;c.beginPath();c.arc(x,y,41,0,Math.PI*2);c.stroke();
    if(progress>0){c.strokeStyle='#d9ad48';c.beginPath();c.arc(x,y,41,-Math.PI/2,-Math.PI/2+progress*Math.PI*2);c.stroke();}c.restore();
    c.save();c.shadowColor='rgba(76,70,51,.13)';c.shadowOffsetY=4;
    ellipse(c,x,y,39,39,interaction.shovel?'#f1d48a':'#e4e7ce',INK,2.2);c.restore();
    c.save();c.translate(x,y-2);c.scale(.72,.72);this.drawShovel(!!interaction.shovel,state.sides.player.loadout?.equippedPassiveProps.includes('gold_doge'));c.restore();
    if(interaction.shovel){c.save();c.setLineDash([3,6]);ellipse(c,x,y,44,44,'rgba(255,255,255,0)',TEAL,2);c.restore();}
    if(storing){c.save();c.setLineDash([4,5]);ellipse(c,x,y,44,44,'rgba(255,246,201,.25)',state.sides.player.shovels<capacity?'#c9a25a':CORAL,3);c.restore();}
    round(c,x+13,y+19,35,22,9,state.sides.player.shovels?'#fff6da':'#e4d4c2',INK,1.7);
    this.label(`×${state.sides.player.shovels}`,x+30,y+31,16,INK,'center',800);
    void seconds;
  }

  private drawDrag(state:BattleState,interaction:Interaction,seconds:number):void {
    if(!interaction.pointer)return;
    const c=this.c,p=interaction.pointer;
    if(interaction.propId){c.save();c.translate(p.x,p.y);c.globalAlpha=.95;drawPropCursor(c,interaction.propId,seconds,resolvePropDrop(state,interaction.propId,p)!==null);c.restore();return;}
    if(interaction.shovel){c.save();c.translate(p.x,p.y-12);c.globalAlpha=.9;this.drawShovel(true,state.sides.player.loadout?.equippedPassiveProps.includes('gold_doge'));c.restore();return;}
    const drag=state.units.find(unit=>unit.id===interaction.draggingId);
    if(!drag)return;
    c.save();c.shadowColor='rgba(76,66,43,.18)';c.shadowBlur=15;c.shadowOffsetY=8;
    this.drawUnit(drag,{x:p.x,y:p.y-20},seconds,.96,true,state.sides[drag.side].loadout);c.restore();
    ellipse(c,p.x,p.y+18,3,3,TEAL,PAPER,1.5);
  }

  private drawEvents(state:BattleState,seconds:number,foreground=false,showDamageNumbers=true):void {
    for(const event of state.events) {
      const isForeground=event.type==='bubble'||event.type==='purge'||event.type==='shield_block'||event.type==='lucky_drop';
      if(isForeground!==foreground)continue;
      if(event.type==='damage'&&!showDamageNumbers)continue;
      if(event.side!=='player')continue;
      if(drawCombatEvent(this.c,event,state.units))continue;
      if(drawM3Event(this.c,event))continue;
      if(event.type==='sprinkler'&&this.assets.has('sprinkler')){this.drawSprinklerOverride(event);continue;}
      if(drawM2Event(this.c,event))continue;
      const eventUnit=isForeground?state.units.find(unit=>unit.id===event.unitId):undefined;
      const p=clamp(event.age/event.duration,0,1),from=eventUnit?this.position(eventUnit):cellCenter(event.col,event.row),c=this.c;
      if(event.type==='orange')continue; // Count observation also covers debug additions/removals.
      if(event.type==='shield_block'){this.drawShieldBlock(event,from,state.sides.player.oranges);continue;}
      if(event.type==='lucky_drop'){
        c.save();
        const ring=clamp(event.age/.65,0,1);
        if(ring<1){
          const r=16+ring*48;c.globalAlpha=(1-ring)*.85;ellipse(c,from.x,from.y,r,r*.82,'rgba(255,255,255,0)','#ffd24c',3);
          for(let i=0;i<6;i++){const a=i*Math.PI/3+event.id*.5;star(c,from.x+Math.cos(a)*r,from.y+Math.sin(a)*r*.82,4.2*(1-ring)+1.5,'#ffe885',0);}
        }
        const text=t(event.textKey||'p19.luckyLegendary'),ty=from.y-36-p*34;
        c.globalAlpha=Math.min(1,(1-p)*2.4);c.font=`900 17px ${FONT}`;c.textAlign='center';c.lineWidth=4.2;c.strokeStyle='#5a2b08';c.strokeText(text,from.x,ty);c.fillStyle='#ffe270';c.fillText(text,from.x,ty);
        c.restore();continue;
      }
      c.save();
      if(event.type==='damage') {
        c.globalAlpha=1-p;const value=event.value??0;
        const text=`${value>0?'−':''}${formatCompactNumber(Math.abs(value))}`;c.font=`900 ${value>=100?20:15}px ${FONT}`;c.textAlign='center';c.strokeStyle=event.color==='#fff7da'?INK:PAPER;c.lineWidth=3.5;c.strokeText(text,from.x,from.y-20-p*29);c.fillStyle=event.color||'#bd7862';c.fillText(text,from.x,from.y-20-p*29);
      } else if(event.type==='bubble') {
        this.drawBubble(event,from,p);
      } else {
        if(event.type==='burst'&&this.drawUltimateBurst(state,event,from,p)){c.restore();continue;}
        if(event.type==='purge'&&event.effect==='awakened'){this.drawAwakenedBurst(event,from);c.restore();continue;}
        if(event.type==='purge'&&(event.effect==='clipped'||event.effect==='clip_restore')){
          const clipped=event.effect==='clipped',ring=clamp(event.age/.7,0,1);
          if(ring<1){
            const r=16+ring*44;c.globalAlpha=(1-ring)*.88;
            ellipse(c,from.x,from.y,r,r*.88,'rgba(255,255,255,0)',clipped?'#e04f5f':'#39b56a',3.5);
          }
          const text=t(event.textKey||(clipped?'p19.clippedDowngrade':'p19.clipRestored'));
          c.font=`900 15px ${FONT}`;
          const pillW=Math.min(196,c.measureText(text).width+22),pillH=28,ty=from.y-54-p*26;
          c.globalAlpha=Math.min(1,(1-p)*2.8);
          round(c,from.x-pillW/2,ty-pillH/2,pillW,pillH,11,clipped?'#d63649':'#289658',clipped?'#fff0f2':'#fff9db',2.2);
          this.label(text,from.x,ty,15,'#fffdf8','center',900,pillW-10);
          c.restore();continue;
        }
        const purge=event.type==='purge',radius=(purge?18:10)+p*(purge?43:31);
        c.globalAlpha=(1-p)*.8;ellipse(c,from.x,from.y,radius,radius,'rgba(255,255,255,0)',event.color||(purge?'#e5c05e':'#dab07b'),purge?4:3);
        for(let i=0;i<(purge?8:5);i++){
          const a=i*Math.PI*2/(purge?8:5)+event.id*.7;star(c,from.x+Math.cos(a)*radius,from.y+Math.sin(a)*radius,5*(1-p)+2,event.color||(purge?'#eac76c':'#d9b384'),0);
        }
        if(purge){c.globalAlpha=1-p;this.label(t(event.textKey||'render.chill'),from.x,from.y-45-p*16,17,TEAL,'center',900,160);}
      }
      c.restore();
    }
    void seconds;
  }

  /** Breakthrough success: a single 0.85s warm-gold ripple and six small star glints; never a white flash. */
  private drawAwakenedBurst(event:VisualEvent,from:Position):void {
    const c=this.c,ring=clamp(event.age/.85,0,1),fade=clamp(event.age/event.duration,0,1);
    if(ring<1){
      const r=20+ring*52;c.globalAlpha=(1-ring)*.75;ellipse(c,from.x,from.y+6,r,r*.82,'rgba(255,255,255,0)','#f2b94a',3);
      for(let i=0;i<6;i++){const a=i*Math.PI/3+event.id*.4;star(c,from.x+Math.cos(a)*r,from.y+6+Math.sin(a)*r*.82,3.5*(1-ring)+1.5,'#ffd77a',0);}
    }
    c.globalAlpha=1-fade;this.label(t(event.textKey||'p17.breakthroughSuccess'),from.x,from.y-48-fade*14,17,'#9a4d16','center',900,180);
  }
  /** Bubble shield pop above the tub: a soft ring and droplets for 0.5s, then the floating label. */
  private drawShieldBlock(event:VisualEvent,from:Position,oranges:number):void {
    const c=this.c,spot=GUARDIAN_BATH_SPOTS[getMap(this.battleMap).id];
    const dome=spot?shieldDome(spot,oranges):{x:0,y:-30,rx:46,ry:50},x=(spot?.x??from.x)+dome.x,y=(spot?.y??from.y)+dome.y;
    const pop=clamp(event.age/.5,0,1),fade=clamp(event.age/event.duration,0,1);
    c.save();
    if(pop<1){
      // The dome itself springs outward and fades, shedding a few soft droplets.
      const grow=1+pop*.22;c.globalAlpha=(1-pop)*.85;ellipse(c,x,y,dome.rx*grow,dome.ry*grow,'rgba(255,250,225,0)','rgba(255, 224, 128, 0.85)',2.6);
      for(let i=0;i<6;i++){const a=i*Math.PI/3+.3;ellipse(c,x+Math.cos(a)*dome.rx*grow*1.06,y+Math.sin(a)*dome.ry*grow*1.06,2.6*(1-pop)+.8,2.6*(1-pop)+.8,'rgba(255,240,190,.95)','',0);}
    }
    // Label floats above the dome (never across the orange stack), paper-edged for contrast.
    const text=t(event.textKey||'p17.shieldBlock'),ty=y-dome.ry-14-fade*14;
    c.globalAlpha=1-fade;c.font=`900 16px ${FONT}`;c.textAlign='center';c.lineWidth=4;c.strokeStyle=PAPER;c.strokeText(text,x,ty);c.fillStyle='#9a5a12';c.fillText(text,x,ty);
    c.restore();
  }
  private drawUltimateBurst(state:BattleState,event:VisualEvent,from:Position,p:number):boolean {
    const source=state.units.find(unit=>unit.id===event.unitId)||state.units.find(unit=>unit.side===event.side&&unit.location.zone==='board'&&unit.location.col===event.col&&unit.location.row===event.row);
    if(!source||!HEROES[source.kind])return false;
    // These heroes now own a captured-path event. Suppress their old instant burst entirely.
    if(['ronin_goose','ballin_rooster','purrcerer'].includes(source.kind))return true;
    const c=this.c,color=HEROES[source.kind].color;
    const enemies=state.enemies.filter(enemy=>enemy.side===event.side).sort((a,b)=>Math.hypot(a.col-event.col,a.row-event.row)-Math.hypot(b.col-event.col,b.row-event.row));
    const target=enemies[0]?cellCenter(enemies[0].col,enemies[0].row):{x:from.x+65,y:from.y};
    c.globalAlpha=(1-p)*.85;
    switch(source.kind) {
      case 'kungfu_po':
        for(let i=0;i<3;i++)ellipse(c,from.x,from.y+18,18+p*(74+i*19),7+p*(22+i*9),'rgba(255,255,255,0)',i===1?PAPER:'#abc089',3-i*.5);
        for(let i=0;i<7;i++){const a=i*Math.PI*2/7;star(c,from.x+Math.cos(a)*(25+p*74),from.y+Math.sin(a)*(16+p*45),5,'#ddca82',0);}break;
      case 'bamboo_mafia':
        for(let i=0;i<5;i++){
          const angle=-Math.PI*.9+i*.43,length=20+p*100;
          const x=from.x+Math.cos(angle)*length,y=from.y+Math.sin(angle)*length+60*p*p;
          c.save();c.translate(x,y);c.rotate(angle);round(c,-9,-4,18,8,3,'#a5b778',INK,1.5);polygon(c,[[-9,-4],[-20,0],[-9,4]],'#eeb677',INK,0);c.restore();
        }break;
      case 'zen_master': {
        const x=from.x+(target.x-from.x)*p,y=from.y+(target.y-from.y)*p,r=19+p*17;
        c.save();c.translate(x,y);c.rotate(p*Math.PI*2);ellipse(c,0,0,r,r,'#f8f2d9',INK,2);
        c.beginPath();c.arc(0,0,r,-Math.PI/2,Math.PI/2);c.arc(0,r/2,r/2,Math.PI/2,Math.PI*1.5,true);c.arc(0,-r/2,r/2,Math.PI/2,-Math.PI/2);c.fillStyle='#66746a';c.fill();ellipse(c,0,-r/2,r*.13,r*.13,PAPER,INK,0);ellipse(c,0,r/2,r*.13,r*.13,'#66746a',INK,0);c.restore();break;
      }
      case 'puss_in_hat':
        for(let i=0;i<2;i++){
          const length=15+p*48,sign=i===0?1:-1;
          line(c,[[target.x-length,target.y-sign*length],[target.x+length,target.y+sign*length]],'#fffbed',8*(1-p)+2);
          line(c,[[target.x-length,target.y-sign*length],[target.x+length,target.y+sign*length]],'#dba479',3*(1-p)+1);
        }star(c,target.x,target.y,10+p*8,'#f1cb7c',0);break;
      case 'meowfia':
        for(let i=0;i<8;i++){
          const progress=(p+i*.11)%1,x=from.x+(target.x-from.x)*progress,y=from.y+(target.y-from.y)*progress+Math.sin(i*7)*10;
          c.save();c.translate(x,y);c.rotate(Math.atan2(target.y-from.y,target.x-from.x));line(c,[[-7,0],[7,0]],PAPER,3);line(c,[[-1,-4],[2,0],[-1,4]],PAPER,2);polygon(c,[[-7,0],[-11,-4],[-11,4]],'#d8debc',INK,0);c.restore();
        }break;
      case 'samurai_doge':
        c.save();c.translate(target.x,target.y);c.rotate(-.9+p*1.5);
        line(c,[[0,32],[0,-12]],'#9e7d58',9);round(c,-24,-34,48,26,8,'#c8a473',PAPER,4);round(c,-24,-34,48,26,8,'#c8a473',INK,2);line(c,[[-16,-24],[15,-24]],'#e9c996',3);c.restore();
        for(let i=0;i<5;i++){const a=i*Math.PI*2/5;star(c,target.x+Math.cos(a)*(18+p*44),target.y+Math.sin(a)*(18+p*44),6,'#eac77e',0);}break;
      case 'doge_wick': {
        const dx=target.x-from.x,dy=target.y-from.y;
        for(let i=0;i<3;i++){const offset=(i-1)*10;line(c,[[from.x+dx*p+offset,from.y+dy*p],[target.x+dx*.3+offset,target.y+dy*.3]],PAPER,5);line(c,[[from.x+dx*p+offset,from.y+dy*p],[target.x+dx*.3+offset,target.y+dy*.3]],'#b5bdac',2);}
        star(c,from.x,from.y,16*(1-p)+3,'#edc47b',0);break;
      }
      case 'rocket_coon':
        ellipse(c,target.x,target.y,15+p*65,12+p*49,'rgba(255,255,255,0)','#a4ba9c',5*(1-p)+2);
        for(let i=0;i<8;i++){const a=i*Math.PI/4,length=12+p*61;round(c,target.x+Math.cos(a)*length-3,target.y+Math.sin(a)*length-4,6,8,1,i%2?'#c5d5ba':'#d7bb88',INK,1);}
        star(c,target.x,target.y,18*(1-p)+3,'#f2d598',0);break;
      case 'pepe_king':
        for(let i=0;i<3;i++){const r=16+((p+i*.22)%1)*126;ellipse(c,from.x,from.y,r,r*.69,'rgba(255,255,255,0)',i===1?PAPER:'#a2b780',3);}
        for(let i=0;i<4;i++){const a=i*Math.PI/2+p*.4,x=from.x+Math.cos(a)*(35+p*80),y=from.y+Math.sin(a)*(22+p*58);ellipse(c,x,y,5,3,'#8fa571',INK,1);line(c,[[x+4,y],[x+4,y-14],[x+11,y-10]],'#8fa571',2);}break;
      default: return false;
    }
    // A small gold pulse keeps every ultimate tied to its source pet.
    c.globalAlpha=(1-p)*.45;ellipse(c,from.x,from.y,20+p*27,20+p*27,'rgba(255,255,255,0)',color,2);
    return true;
  }

  private drawBubble(event:VisualEvent,from:Position,p:number):void {
    const c=this.c,text=t(event.textKey||'render.chill',{value:event.value??0}),size=14;
    c.font=`800 ${size}px ${FONT}`;
    const lines=this.wrapText(text,208),width=Math.min(230,Math.max(...lines.map(text=>c.measureText(text).width))+23),height=lines.length*19+15;
    const x=clamp(from.x-width/2,18,STAGE.width-18-width);
    const aboveY=from.y-height-45-p*9;
    const below=aboveY<STAGE.boardY+6;
    const y=below?Math.min(STAGE.height-height-18,from.y+42+p*6):aboveY;
    c.globalAlpha=Math.min(1,(1-p)*4);
    const tailX=clamp(from.x,x+12,x+width-12);
    if(below){
      polygon(c,[[tailX-7,y+1],[tailX+5,y-8],[tailX+9,y+1]],'#fffbed',INK,1.7);
    }else{
      polygon(c,[[tailX-7,y+height-1],[tailX+5,y+height+8],[tailX+9,y+height-1]],'#fffbed',INK,1.7);
    }
    round(c,x,y,width,height,11,'#fffbed',INK,1.8);
    lines.forEach((text,i)=>this.label(text,x+width/2,y+16+i*19,size,INK,'center',800));
  }

  private wrapText(text:string,width:number):string[] {
    const lines:string[]=[],chunks=text.includes(' ')?text.split(' ').map((word,i)=>i?` ${word}`:word):Array.from(text);
    let current='';
    for(const chunk of chunks){if(current&&this.c.measureText(current+chunk).width>width){lines.push(current);current=chunk.trimStart();}else current+=chunk;}
    if(current)lines.push(current);
    return lines.length?lines:[''];
  }

  private drawFog(state:BattleState,seconds:number):void {
    const c=this.c;
    for(const side of ['player'] as const) {
      const fog=state.sides[side].fog;if(fog<=0)continue;
      const x=STAGE.boardX,y=STAGE.boardY,height=STAGE.rows*STAGE.cell;
      c.save();c.beginPath();c.rect(x,y,STAGE.cell*STAGE.cols,height);c.clip();
      c.globalAlpha=Math.min(1,fog)*.54;c.fillStyle='#4d6b55';c.fillRect(x,y,STAGE.cell*STAGE.cols,height);
      for(let i=0;i<8;i++){
        const px=x+((i*137+seconds*12)%(STAGE.cell*STAGE.cols+160))-80,py=y+50+(i*61)%(height-100);
        const gradient=c.createRadialGradient(px,py,5,px,py,120);gradient.addColorStop(0,'rgba(143,166,106,.32)');gradient.addColorStop(1,'rgba(143,166,106,0)');c.fillStyle=gradient;c.fillRect(px-120,py-120,240,240);
      }
      c.restore();
    }
  }

  private observeOranges(state:BattleState,dt:number):void {
    if(this.previousOranges)for(const side of ['player'] as const) {
      const spot=GUARDIAN_BATH_SPOTS[state.mapId];
      const old=this.previousOranges[side],now=state.sides[side].oranges,diff=now-old;
      for(let i=0;i<Math.min(Math.abs(diff),12);i++)this.orangeMotions.push({x:spot.x,y:spot.y+spot.orangeBaseY-Math.max(0,old-1-i)*15,age:0,index:i,add:diff>0,direction:-1,targetY:spot.y+spot.orangeBaseY-Math.max(0,now-1-i)*15});
    }
    this.previousOranges={player:state.sides.player.oranges,ai:state.sides.ai.oranges};
    this.orangeMotions=this.orangeMotions.filter(motion=>(motion.age+=dt)<1.1);
  }

  private drawOrangeMotions():void {
    const c=this.c;
    for(const motion of this.orangeMotions){
      const p=motion.age/1.1;c.save();c.globalAlpha=motion.add?Math.sin(p*Math.PI):1-p;
      const x=motion.add?motion.x+motion.direction*(1-p)*72:motion.x+motion.direction*(25+motion.index*12)*p;
      const y=motion.add?motion.targetY-70*(1-p):motion.y-24*p+150*p*p;
      this.drawOrangeArt(x,y,10,motion.add?-.3*(1-p):motion.direction*p*5);c.restore();
    }
  }

  private drawImage(image:HTMLImageElement,width:number,height:number,x=0,y=0):void {
    const iw=image.naturalWidth||image.width||1,ih=image.naturalHeight||image.height||1;
    const ratio=Math.min(width/iw,height/ih),w=iw*ratio,h=ih*ratio;
    this.c.drawImage(image,x-w/2,y-h/2,w,h);
  }

  private drawShovel(active:boolean,gold=false):void {
    const image=this.assets.get('shovel');if(image)this.drawImage(image,82,82);else drawShovelArt(this.c,active,gold);
  }

  private drawSprinklerOverride(event:VisualEvent):void {
    const image=this.assets.get('sprinkler');if(!image)return;
    const points=event.points?.length?event.points:[{col:event.col,row:event.row},{col:event.targetCol??event.col,row:event.targetRow??event.row}];
    const progress=clamp(event.duration>0?event.age/event.duration:1,0,1),step=progress*Math.max(0,points.length-1),index=Math.min(Math.floor(step),Math.max(0,points.length-2));
    const a=points[index],b=points[Math.min(index+1,points.length-1)],local=step-index,p=cellCenter(a.col+(b.col-a.col)*local,a.row+(b.row-a.row)*local);
    const c=this.c;c.save();c.globalAlpha*=Math.min(1,(1-progress)*7+.15);c.translate(p.x,p.y);c.rotate(Math.atan2(b.row-a.row,b.col-a.col));this.drawImage(image,70,70,0,-2);c.restore();
    c.save();c.globalAlpha*=Math.min(1,(1-progress)*7+.15);c.translate(p.x,p.y);c.rotate(Math.atan2(b.row-a.row,b.col-a.col));
    for(let i=0;i<8;i++){
      const travel=(event.age*3+i/8)%1,x=15+travel*53,y=Math.sin(i*2.7)*travel*39;
      line(c,[[x-9,y*.83],[x,y]],'#91d3df',3*(1-travel)+1);
    }c.restore();
  }
}
/** `#RRGGBB` broth colors to translucent canvas paint. */
export const brothRgba=rgba;
