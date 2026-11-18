import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import {SPELL_CATALOG} from '../js/mob-class-rules.mjs';
const distance=(a,b)=>(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.x+a.y-b.x-b.y))/2;
const radius=(p,r)=>{const out=[];for(let x=p.x-r;x<=p.x+r;x++)for(let y=p.y-r;y<=p.y+r;y++)if(distance(p,{x,y})<=r)out.push({x,y});return out;};
let units=[],sphere=[],light=1;
const ctx={game:{round:3,areaEffects:[]},getSpellEntry:id=>SPELL_CATALOG[id],getUnitEffect:(u,id)=>u.effects?.includes(id)?{}:null,unitVisibleToObserver:(u,t)=>!t.hidden,allUnits:()=>units,unitCanMakeLeavingHexFreeAttack:()=>false,canMeleeAttackTarget:(a,b)=>distance(a,b)<=1,hexDistance:distance,spellRangeHexes:s=>s.range.type==='self'?0:s.range.type==='touch'?1:20,lineOfSightBlocked:()=>false,hexesWithinRadius:radius,fireballBlastCells:p=>radius(p,2),directionalWedgeCells:(s,t,r)=>radius(s,r).filter(p=>p.x>s.x),createWallOfFogCells:(s,t)=>radius(t,1),inside:()=>true,key:(x,y)=>x+','+y,livingUnitsInAreaCells:cells=>units.filter(u=>cells.some(p=>p.x===u.x&&p.y===u.y)),spellHitDiceValue:u=>u.hd||1,isUndeadUnit:u=>!!u.undead,isCharmPersonEligible:u=>!u.undead&&u.sizeCategory==='medium',dexterityAdjustments:()=>({defensive:0}),flamingSphereEffects:()=>sphere,isHexVisibleFromObserver:()=>true,illuminationAtHex:()=>light,hexLineCells:(a,b)=>radius(a,Math.ceil(distance(a,b))).filter(p=>Math.abs(distance(a,p)+distance(p,b)-distance(a,b))<.01)};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/combat-caster-ai.js','utf8')+'\n'+fs.readFileSync('js/combat-wizard-tactics.js','utf8'),ctx);
const ids=Object.values(SPELL_CATALOG).filter(s=>s.spellGroup==='Wizard'&&s.combatImplemented).map(s=>s.id);
for(const id of ids){assert(vm.runInContext('!!WIZARD_SPELL_TACTICS['+JSON.stringify(id)+']?.purpose',ctx),id+' must have an explicit purpose');}
function setup(id){const caster={id:'mage',alive:true,classId:'mage',level:5,faction:'friendly',x:0,y:0,hp:10,maxHp:10,ac:10,stats:{str:10,int:16},memorizedSpellIds:[id]};const enemy={id:'orc',alive:true,classId:'fighter',faction:'hostile',x:3,y:0,hp:40,maxHp:40,hd:1,sizeCategory:'medium',type:'orc',alignment:'evil',rangedWeapon:'Bow',weapon:'Sword',stats:{int:10,str:16}};const ally={id:'ally',alive:true,classId:'fighter',faction:'friendly',x:0,y:1,hp:2,maxHp:12,ac:10,weapon:'Sword',stats:{str:12,dex:10}};units=[caster,enemy,ally];sphere=[];light=1;ctx.game.areaEffects=[];return {caster,enemy,ally};}
function choices(caster){return ctx.wizardSpellChoices(caster,caster,ctx.casterDecisionContext(caster));}
for(const id of ids){const {caster,enemy,ally}=setup(id);
 if(['burning-hands','color-spray','shocking-grasp','chill-touch','strength','enlarge'].includes(id)){enemy.x=1;ally.y=-1;}
 if(id==='deafness')enemy.classId='mage';
 if(id==='taunt')units.push({...enemy,id:'orc2',x:4});
 if(id==='detect-invisibility')caster.mobAiMemory={targets:{lost:{targetId:'lost',x:1,y:0,lastSeenRound:2}}};
 if(id==='spectral-hand')caster.memorizedSpellIds.push('shocking-grasp');
 if(id==='pyrotechnics'){ally.x=-20;sphere=[{cells:[{x:3,y:0}]}];}
 assert(choices(caster).some(c=>c.action.spellId===id&&Number.isFinite(c.score)),id+' must find a useful legal scenario');
}
{
 const {caster,enemy}=setup('sleep');enemy.undead=true;assert.equal(choices(caster).length,0,'Sleep ignores undead');enemy.undead=false;enemy.hd=5;assert.equal(choices(caster).length,0,'Sleep respects HD immunity');
}
{
 const {caster,enemy}=setup('charm-person');enemy.sizeCategory='huge';assert.equal(choices(caster).length,0,'Charm rejects large creatures');
}
{
 const {caster}=setup('armor');units.forEach(u=>u.ac=3);assert.equal(choices(caster).length,0,'Armor must improve AC');units.forEach(u=>{u.ac=10;u.effects=['armor-spell'];});assert.equal(choices(caster).length,0,'Armor uses the actual effect ID');
}
{
 const {caster,enemy}=setup('deafness');assert.equal(choices(caster).length,0,'Do not waste Deafness on a weapon fighter');enemy.classId='mage';assert(choices(caster).length);
}
{
 const {caster}=setup('detect-invisibility');assert.equal(choices(caster).length,0,'No omniscient detection');units.push({id:'hidden',hidden:true,alive:true,faction:'hostile',x:1,y:0});assert.equal(choices(caster).length,0,'Actual hidden foe cannot trigger detection without memory');
}
{
 const {caster}=setup('pyrotechnics');assert.equal(choices(caster).length,0,'Requires real fire source');sphere=[{cells:[{x:3,y:0}]}];assert.equal(choices(caster).length,0,'Fireworks cannot blind allies under safe policy');
}
{
 const {caster,enemy,ally}=setup('burning-hands');enemy.x=1;ally.x=1;ally.y=0;assert.equal(choices(caster).length,0,'Directional fan protects allies');
}
{
 const {caster,enemy}=setup('web');ctx.game.areaEffects=[{type:'web',expiresRound:6,cells:radius(enemy,3)}];assert.equal(choices(caster).length,0,'Do not duplicate a covered persistent area');
}
console.log('PASS '+ids.length+' wizard purposes and useful scenarios, eligibility, real status IDs, detection memory, prerequisites, ally safety and redundant areas');
