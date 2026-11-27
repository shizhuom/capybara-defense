import type {BattleEngine} from './BattleEngine';
import type {Enemy,Point,Unit} from './types';
import {WEAPONS,RARITY_RULES,type WeaponDefinition} from '../config/weapons';
import {GridSystem} from './GridSystem';
import {combatRange,combatCharge} from './CombatRules';

interface Memory {
  attacks:number;target:number;streak:number;seen:Set<number>;yang:boolean;
  killHaste:number;disco:number;wave:number;power:number;
}
export interface CombatStats {damage:number;rate:number;range:number;charge:number}

/** Equipment hooks are separate from hero skills; a proc can never recursively proc itself. */
export class WeaponSystem {
  private memories=new WeakMap<Unit,Memory>();
  constructor(private engine:BattleEngine,private random:()=>number){}
  definition(unit:Unit):WeaponDefinition|undefined{return WEAPONS[this.engine.state.sides[unit.side].loadout.equippedWeapons[unit.kind]];}
  awakened(unit:Unit):boolean{return this.definition(unit)?.signatureHero===unit.kind;}
  stats(unit:Unit,base:CombatStats):CombatStats {
    const weapon=this.definition(unit),m=this.memory(unit),now=this.engine.state.time;
    let damage=base.damage*(weapon?1+RARITY_RULES[weapon.rarity].damageBonus:1),rate=base.rate;
    const id=weapon?.id;
    if(m.power>now)damage*=1.35;
    let haste=(m.killHaste>now?.45:0)+(m.disco>now?.2:0)+(m.wave>now?.15:0);
    if(id==='m05_duster')haste+=Math.min(.48,m.streak*.06);
    if(id==='r06_pressure_washer')haste+=Math.min(.6,m.streak*.1);
    if(id==='w02_balloon')haste+=.1;
    rate*=1+haste;
    const loadout=this.engine.state.sides[unit.side].loadout;
    return{damage,rate,range:combatRange(unit,loadout),charge:combatCharge(unit,loadout)};
  }
  damageMultiplier(unit:Unit,target:Enemy):number {
    const id=this.definition(unit)?.id;
    if(id==='w12_rain_crown_scepter'&&(target.slow>0||target.poison>0))return 1.35;
    if(id==='r11_sniper_laser')return 1+Math.min(.5,GridSystem.distance(this.engine.unitPosition(unit),target)/this.engine.getUnitStats(unit).range*.5);
    return 1;
  }
  onAttack(unit:Unit,target:Enemy,damage:number):void {
    const weapon=this.definition(unit);if(!weapon)return;
    const m=this.memory(unit);m.attacks++;m.streak=m.target===target.id?m.streak+1:1;m.target=target.id;
    const chance=(rate:number)=>this.random()<rate,near=(radius:number)=>this.engine.lane(unit.side).filter(e=>GridSystem.distance(target,e)<=radius);
    switch(weapon.id){
      case 'm04_baguette':if(chance(.15)){this.engine.knockback(target,.35);this.effect(unit,target,'baguette');}break;
      case 'm06_stool':if(chance(.15)){target.stun=Math.max(target.stun,.6);this.effect(unit,target,'stool');}break;
      case 'm07_rolling_pin':if(m.attacks%8===0)this.area(unit,target,1.6,damage*1.8,'wave');break;
      case 'm10_bamboo_staff':if(chance(.18))this.bamboo(unit,target,1,damage);break;
      case 'm12_iron_wok':if(chance(.15)){for(const e of near(1.2))e.stun=Math.max(e.stun,.8);this.area(unit,target,1.2,damage*3,'wok');}break;
      case 'r03_bubble_gun':if(chance(.15)){this.engine.applySlow(target,1.5,.75);this.effect(unit,target,'bubble');}break;
      case 'r04_tennis_launcher':if(chance(.2))this.bounce(unit,target,damage*.7,1.6,'ball');break;
      case 'r05_hair_dryer':if(chance(.15)){this.burn(target,damage,unit);this.effect(unit,target,'heat');}break;
      case 'r07_popcorn_cannon':if(m.attacks%8===0)this.area(unit,target,1.2,damage*2,'popcorn');break;
      case 'r09_bamboo_bazooka':if(chance(.15)){
        for(const e of this.engine.lane(unit.side))if(Math.abs(e.progress-target.progress)<=2)this.burn(e,damage,unit);
        this.effect(unit,target,'fire_dragon');
      }break;
      case 'r10_acorn_minigun':if(m.attacks%10===0)this.projectiles(unit,6,damage,'missile');break;
      case 'w03_bug_zapper':if(chance(.15)){target.stun=Math.max(target.stun,.4);this.effect(unit,target,'zap');}break;
      case 'w05_disco_ball':if(chance(.15)){
        for(const ally of this.allies(unit).filter(u=>GridSystem.distance(this.engine.unitPosition(unit),this.engine.unitPosition(u))<=1.5))this.memory(ally).disco=this.engine.state.time+4;
        this.effect(unit,this.engine.unitPosition(unit),'disco');
      }break;
      case 'w07_cat_scratch_meteor':if(chance(.12))this.area(unit,target,1.2,damage*2.4,'meteor');break;
      case 'w08_fortune_fish':if(m.attacks%9===0){
        for(const ally of this.allies(unit))this.memory(ally).wave=this.engine.state.time+3;
        this.area(unit,this.engine.unitPosition(unit),1.6,damage*1.8,'cyber_wave');
      }break;
      case 'w09_yin_yang_burner':if(m.attacks%8===0){
        m.yang=!m.yang;
        if(m.yang){m.power=this.engine.state.time+4;unit.powerTime=4;this.effect(unit,this.engine.unitPosition(unit),'yang');}
        else {for(const enemy of near(1.5))this.engine.applyDot(enemy,'poison',3,damage*.35,unit);this.effect(unit,target,'yin');}
      }break;
      case 'w10_cosmic_vacuum':if(chance(.15)){
        for(const enemy of near(1.5)){this.engine.knockback(enemy,Math.max(-1,Math.min(1,enemy.progress-target.progress)));enemy.stun=Math.max(enemy.stun,.8);}
        this.effect(unit,target,'vacuum');
      }break;
      case 'w11_golden_hoop_ball':this.area(unit,target,.85,damage*.4,'fire_ball');break;
    }
  }
  onHit(unit:Unit,target:Enemy,damage:number):void {
    const id=this.definition(unit)?.id;
    if(id==='r12_junk_mortar'&&this.random()<.45)this.bounce(unit,target,damage,1.8,'mortar');
    if(id==='r08_coin_slingshot'){
      const m=this.memory(unit);if(!m.seen.has(target.id)){m.seen.add(target.id);if(this.random()<.25){this.engine.state.sides[unit.side].food++;this.effect(unit,target,'coin');}}
    }
  }
  onKill(unit:Unit):void {
    const weapon=this.definition(unit);if(!weapon)return;
    const damage=this.engine.getUnitStats(unit).damage;
    if(weapon.id==='m08_durian')this.memory(unit).killHaste=this.engine.state.time+2.5;
    if(weapon.id==='m09_cat_blade')this.projectiles(unit,4,damage*.8,'claw');
    if(weapon.id==='m11_salted_fish')this.projectiles(unit,2,damage,'fish');
    if(weapon.id==='w06_yarn_storm')this.projectiles(unit,4,damage*.8,'yarn');
  }
  bamboo(unit:Unit,center:Point,radius:number,damage:number,effect='bamboo'):void {
    for(const enemy of this.engine.lane(unit.side))if(GridSystem.distance(center,enemy)<=radius){enemy.stun=Math.max(enemy.stun,.8);this.engine.hurt(enemy,damage*2.2,unit,true,false);}
    this.effect(unit,center,effect);
  }
  projectiles(unit:Unit,count:number,damage:number,effect:string):void {
    for(let i=0;i<count;i++){
      const live=this.engine.lane(unit.side);if(!live.length)break;
      const target=live[Math.floor(this.random()*live.length)];
      this.engine.event({type:'weapon',side:unit.side,...this.engine.unitPosition(unit),targetCol:target.col,targetRow:target.row,points:[{...this.engine.unitPosition(unit)},{col:target.col,row:target.row}],effect,duration:.55,unitId:unit.id});
      this.engine.hurt(target,damage,unit,true,false);
    }
  }
  private memory(unit:Unit):Memory {
    let m=this.memories.get(unit);if(!m){m={attacks:0,target:0,streak:0,seen:new Set(),yang:false,killHaste:0,disco:0,wave:0,power:0};this.memories.set(unit,m);}return m;
  }
  private allies(unit:Unit):Unit[]{return this.engine.state.units.filter(u=>u.side===unit.side&&u.location.zone==='board');}
  private burn(enemy:Enemy,damage:number,unit:Unit):void{this.engine.applyDot(enemy,'burn',3,damage*.35,unit);}
  private effect(unit:Unit,point:Point,effect:string):void{this.engine.event({type:'weapon',side:unit.side,col:point.col,row:point.row,effect,duration:.7,color:WEAPONS[this.engine.state.sides[unit.side].loadout.equippedWeapons[unit.kind]]?.family==='magic'?'#b7a0d1':'#e6b971'});}
  private area(unit:Unit,point:Point,radius:number,damage:number,effect:string):void {
    for(const enemy of this.engine.lane(unit.side))if(GridSystem.distance(point,enemy)<=radius)this.engine.hurt(enemy,damage,unit,true,false);
    this.effect(unit,point,effect);
  }
  private bounce(unit:Unit,from:Enemy,damage:number,radius:number,effect:string):void {
    const target=this.engine.lane(unit.side).filter(e=>e.id!==from.id&&GridSystem.distance(from,e)<=radius).sort((a,b)=>GridSystem.distance(from,a)-GridSystem.distance(from,b))[0];
    if(!target)return;
    this.engine.event({type:'bounce',side:unit.side,col:from.col,row:from.row,points:[{col:from.col,row:from.row},{col:target.col,row:target.row}],effect,duration:.4,unitId:unit.id});
    this.engine.hurt(target,damage,unit,false,false);
  }
}
