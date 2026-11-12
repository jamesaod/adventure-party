import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newDraft} from '../js/mob-workshop-core.mjs';
import {ensureRaceIdentity,racialWeaponBonuses,rollRacialSpellResistance,raceIdOf} from '../js/racial-traits.mjs';
import {instantiateWorkshopCombat,workshopCombatConnections} from '../js/workshop-combat-contract.mjs';
import {validateWorkshopProject} from '../js/mob-workshop-project.mjs';
import {createWorkshopRacePanel} from '../js/workshop-race-panel.mjs';
import {createWorkshopRepositoryMob} from '../js/workshop-repository-mob.mjs';
import {encounterReadiness} from '../js/mob-library.mjs';
import {extractCombatFunction} from './combat-test-source.mjs';
const draft=newDraft();draft.raceId='elf';draft.stats.species='Elf';draft.gender='female';ensureRaceIdentity(draft);
assert.equal(draft.stats.morale,13);
const restored=validateWorkshopProject(JSON.parse(JSON.stringify({draft,files:{}}))).draft;
assert.equal(restored.raceId,'elf');assert.equal(restored.gender,'female');assert.equal(restored.stats.morale,13);
const a=instantiateWorkshopCombat(restored,{id:'archer'}),b=instantiateWorkshopCombat({...restored,name:'Elf swordsman'},{id:'sword'});
assert.equal(a.raceId,b.raceId);assert.equal(a.race,'Elf');assert.equal(a.gender,'female');assert.equal(a.morale,13);
restored.moraleOverride=16;assert.equal(instantiateWorkshopCombat(restored,{id:'elite'}).morale,16);
const legacy=newDraft();delete legacy.raceId;delete legacy.gender;delete legacy.moraleOverride;legacy.stats.species='Wood Elf';ensureRaceIdentity(legacy);
assert.equal(legacy.raceId,'elf');assert.equal(legacy.stats.morale,13);
const published=JSON.parse(readFileSync('data/mobs/wood-elf-archer.workshop-unit.json','utf8'));
const publishedUnit=createWorkshopRepositoryMob(published).apply({id:'published-elf'});
assert.equal(publishedUnit.raceId,'elf');assert.equal(publishedUnit.morale,13);
assert.equal(encounterReadiness(published,{}).ready,true);
const oldVeteran={stats:{species:'Elf',morale:17}};ensureRaceIdentity(oldVeteran);assert.equal(oldVeteran.moraleOverride,17);
const changed=structuredClone(draft);changed.raceId='human';ensureRaceIdentity(changed);assert.equal(changed.stats.morale,10);
assert.throws(()=>ensureRaceIdentity({...draft,gender:'invalid'}));assert.throws(()=>ensureRaceIdentity({...draft,moraleOverride:21}));
assert(workshopCombatConnections(draft).reasons.some(r=>r.includes('Racial combat')));assert(!workshopCombatConnections(draft,{racialTraits:true}).reasons.some(r=>r.includes('Racial combat')));
for(const id of ['bow-short','bow-long','bow-composite-short','bow-composite-long'])assert.equal(racialWeaponBonuses({...a,missileCatalogId:id},'missile').hit,1);
for(const id of ['sword-long','sword-short','sword-two-handed','sword-broad','sword-scimitar'])assert.equal(racialWeaponBonuses({...a,weaponCatalogId:id},'melee').damage,1);
for(const id of ['crossbow-light','sling','dagger','staff','spear'])for(const kind of ['missile','melee',null])assert.equal(racialWeaponBonuses({...a,weaponCatalogId:id,missileCatalogId:id},kind).hit,0);
assert.equal(racialWeaponBonuses({...a,raceId:'half-elf',weaponCatalogId:'sword-long'},'melee').hit,0);assert.equal(raceIdOf({race:'Half-elf'}),'half-elf');
// The actual page-one controls link identity and inherited/overridden morale.
const elements=new Map(),doc={createElement(){return {ownerDocument:doc,children:[],set id(v){this._id=v;elements.set(v,this);},get id(){return this._id;},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},setCustomValidity(v){this.validationMessage=v;},reportValidity(){}};},getElementById:id=>elements.get(id)},host=doc.createElement('div');
const oldOption=globalThis.Option;globalThis.Option=function(text,value){return {text,value};};
try{
 const edited=newDraft();createWorkshopRacePanel({host,getDraft:()=>edited,changed(){}});
 elements.get('raceId').value='elf';elements.get('raceId').onchange();assert.equal(edited.raceId,'elf');assert.equal(edited.stats.morale,13);assert(elements.get('morale').disabled);
 elements.get('gender').value='female';elements.get('gender').onchange();assert.equal(edited.gender,'female');
 elements.get('moraleOverride').checked=true;elements.get('moraleOverride').onchange();assert(!elements.get('morale').disabled);
 elements.get('morale').value='16';elements.get('morale').onchange();assert.equal(edited.moraleOverride,16);assert.equal(edited.stats.morale,16);
 elements.get('morale').value='21';elements.get('morale').onchange();assert.equal(edited.stats.morale,16,'Invalid input cannot change combat morale');
 elements.get('moraleOverride').checked=false;elements.get('moraleOverride').onchange();assert.equal(edited.stats.morale,13);assert.equal(edited.moraleOverride,null);
 elements.get('raceId').value='human';elements.get('raceId').onchange();assert.equal(edited.stats.morale,10);assert.equal(edited.stats.species,'Human');
}finally{if(oldOption===undefined)delete globalThis.Option;else globalThis.Option=oldOption;}
const sleep={id:'sleep',name:'Sleep'},charm={id:'charm-person',school:'Enchantment/Charm'};
for(const spell of [sleep,charm,{id:'hypnotic-pattern'},{id:'priest-command',spheres:['Charm']}]){
 assert.equal(rollRacialSpellResistance(a,spell,()=>90).resisted,true);assert.equal(rollRacialSpellResistance(a,spell,()=>91).resisted,false);
}
for(const unit of [{raceId:'human'},{raceId:'half-elf'},{}])assert.equal(rollRacialSpellResistance(unit,sleep,()=>{throw Error('Must not roll');}).chance,0);
assert.equal(rollRacialSpellResistance(a,{id:'fireball',school:'Evocation'},()=>{throw Error('Not general magic resistance');}).chance,0);
const api={racialWeaponBonuses,rollRacialSpellResistance};
const launcher=readFileSync('js/adventure-party.js','utf8');
const mods=vm.createContext({AdventurePartyRaces:api,getUnitEffect:()=>null,blurAttackPenalty:()=>0,attackPositionData:()=>({rearAttackBonus:0})});
for(const fn of ['attackEffectModifier','physicalDamageEffectModifier'])vm.runInContext(extractCombatFunction(launcher,fn),mods);
const armed={...a,weaponCatalogId:'sword-long',missileCatalogId:'bow-long'};
for(const kind of ['melee','missile']){assert.equal(mods.attackEffectModifier(armed,{},kind),1);assert.equal(mods.physicalDamageEffectModifier(armed,kind),1);}
assert.equal(mods.attackEffectModifier(armed,{}),0,'Touch/spell attacks do not inherit a held sword bonus');
mods.getUnitEffect=(_u,id)=>id==='ray-enfeeblement'?{}:null;assert.equal(mods.attackEffectModifier(armed,{},'melee'),-1);assert.equal(mods.physicalDamageEffectModifier(armed,'melee'),0,'Affinity stacks once with existing modifiers');

const entries=[
 ['castCharmPersonSpell','charm-person','combat-spells-control.js'],['castSleepSpell','sleep','combat-spells-control.js'],
 ['castTauntSpell','taunt','combat-spells-control.js'],['castHypnoticPatternSpell','hypnotic-pattern','combat-spells-control.js'],
 ['castRayOfEnfeeblementSpell','ray-of-enfeeblement','combat-spells-control.js'],['castScareSpell','scare','combat-spells-control.js'],
 ['castTashasHideousLaughterSpell','tashas-hideous-laughter','combat-spells-control.js'],['r226CastHoldPerson','hold-person','r226-level3-casts-b.js'],
 ['castPriestCombatSpell','priest-command','combat-spells-support.js'],['castPriestCombatSpell','priest-hold-person','combat-spells-support.js']
];
function harness(id,percent,{raceId='elf',saveSuccess=false,commit=true}={}){
 const trace={rolls:0,saves:0,effects:[],allegiance:0,finished:0,messages:[],beats:[]};
 const caster={id:'caster',name:'Caster',faction:'friendly',alive:true,level:6,x:0,y:0},target={...a,id:'target',type:'archer',raceId,name:'Target',faction:'enemy',alive:true,stats:{int:12},classGroup:'warrior',x:1,y:0};
 const spell={id,name:id,school:id==='hypnotic-pattern'?'Illusion':'Enchantment/Charm',kind:id==='priest-command'?'command':'hold',targetMode:'hostile-creature'};
 const c=vm.createContext({AdventurePartyRaces:api,TEST_SPELL_CASTER_LEVEL:6,COMBAT_MESSAGE_MIN_HOLD_MS:1,game:{round:1,allies:[]},spellCastInProgress:false,pendingAimAction:null,
  d:n=>{if(n===100){trace.rolls++;return percent;}return 4;},log:m=>trace.messages.push(m),candidateQueueCombatBeat:(_u,beat)=>trace.beats.push(beat),
  spellCasterForAction:()=>caster,getSpellEntry:()=>spell,validCreatureTargetWithinRange:()=>true,isCharmPersonEligible:()=>true,lineOfSightBlocked:()=>false,lineOfSightBlockedBetweenHexes:()=>false,
  spellRangeHexes:()=>12,hexDistance:()=>0,unitDistance:()=>0,inside:()=>true,hexesWithinRadius:()=>[{}],livingUnitsInAreaCells:()=>[target],unitsWithinHexRadius:()=>[target],
  isUndeadUnit:()=>false,spellHitDiceValue:()=>1,r226IsHumanoidPerson:()=>true,commitSpellCast:()=>commit,finishFailedSpellCommit:async()=>false,
  exitAimMode(){},setUnitActionBanner(){},setCombatMessage:m=>trace.messages.push(m),setLastRoll(){},playMagicEffectSound(){},ensurePersistentStatusFxLoop(){},
  rollSpellSave:()=>{trace.saves++;return {success:saveSuccess,rawRoll:5,modifier:0,modifiedRoll:5,targetNumber:12};},
  addUnitEffect:(_u,e)=>trace.effects.push(e),applyCharmPersonAllegiance:()=>trace.allegiance++,
  animateMagicEffectOnUnits:async()=>{},waitForCombatActionPause:async()=>{},finishTestSpellCast:()=>trace.finished++});
 vm.runInContext(readFileSync('js/combat-racial-traits.js','utf8'),c);return {c,trace,target,action:{spellId:id,casterLevel:6}};
}
for(const [fn,id,file] of entries){
 for(const percent of [90,91]){
  const h=harness(id,percent);vm.runInContext(extractCombatFunction(readFileSync('js/'+file,'utf8'),fn),h.c);
  const result=await h.c[fn](h.action,h.target,h.target);assert.equal(result,true,id);assert.equal(h.trace.rolls,1,id+' rolls once');assert.equal(h.trace.finished,1,id+' finishes action');
  if(percent===90){assert.equal(h.trace.saves,0,id+' resistance precedes ordinary save');assert.equal(h.trace.effects.length+h.trace.allegiance,0,id+' resists without applying effect');assert.equal(h.trace.beats.length,1);}
  else{assert(h.trace.effects.length+h.trace.allegiance>0,id+' proceeds on failed resistance');assert.equal(h.trace.saves,id==='sleep'?0:1);}
 }
}
for(const options of [{commit:false},{raceId:'human'},{saveSuccess:true}]){
 const h=harness('charm-person',91,options);vm.runInContext(extractCombatFunction(readFileSync('js/combat-spells-control.js','utf8'),'castCharmPersonSpell'),h.c);await h.c.castCharmPersonSpell(h.action,h.target);
 if(options.commit===false){assert.equal(h.trace.rolls,0);assert.equal(h.trace.saves,0);}if(options.raceId==='human')assert.equal(h.trace.rolls,0);if(options.saveSuccess)assert.equal(h.trace.allegiance,0);
}
for(const [file,kind] of [['combat-melee-actions.js','melee'],['combat-missile-actions.js','missile'],['combat-environment-actions.js','missile']])assert(readFileSync('js/'+file,'utf8').includes('attackEffectModifier(attacker,'+(file==='combat-environment-actions.js'?'target':'defender')+',"'+kind+'")'));
console.log('PASS racial identity/morale/export, Elf-only bow/sword modifiers, weapon/spell separation, 90/91 resistance boundaries, and all ten live Sleep/Charm spell routes including saves and interrupted casts.');
