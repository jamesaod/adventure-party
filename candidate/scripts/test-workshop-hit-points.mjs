import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newDraft,readiness} from '../js/mob-workshop-core.mjs';
import {ensureCreature,creatureIssues,instantiateCreature} from '../js/mob-workshop-creature.mjs';
import {generateHitPoints,hitPointSummary,hitPointIssues} from '../js/workshop-hit-points.mjs';
import {createHitPointPanel} from '../js/workshop-hit-points-panel.mjs';
import {instantiateWorkshopCombat} from '../js/workshop-combat-contract.mjs';
import {validateWorkshopProject} from '../js/mob-workshop-project.mjs';
import {validateWorkshopUnit} from '../js/workshop-unit-package.mjs';
import {createWorkshopRepositoryMob} from '../js/workshop-repository-mob.mjs';
import {extractCombatFunction} from './combat-test-source.mjs';

const d=newDraft();ensureCreature(d);d.stats.hp=17;
const noRoll=()=>{throw Error('Fixed HP must not consume random rolls');};
assert.equal(instantiateCreature(d,{id:'fixed',random:noRoll}).hp,17);
Object.assign(d.creature.combat,{hpMode:'roll',hitDice:'1d8+1'});
assert.equal(instantiateWorkshopCombat(d,{id:'low',random:()=>0}).hp,2);
assert.equal(instantiateWorkshopCombat(d,{id:'high',random:()=>.999999}).hp,9);
assert.equal(d.stats.hp,17,'Rolling does not overwrite the stored fixed-HP choice');
let rolls=0;d.creature.combat.hitDice='3d8-2';
const instance=instantiateWorkshopCombat(d,{id:'three',random:()=>{rolls++;return .5;}});
assert.equal(instance.hp,13);assert.equal(instance.maxHp,13);assert.equal(rolls,3);assert.equal(instance.hitDiceValue,3);
instance.hp--;assert.equal(instance.maxHp,13);assert.equal(rolls,3,'Damage cannot reroll HP');
Object.assign(d.creature.combat,{hpMode:'range',hpRangeMin:1,hpRangeMax:4,hpRangeModifier:1});
for(const [random,hp] of [[0,2],[.249,2],[.25,3],[.5,4],[.75,5],[.999999,5],[1,5]]){
 let calls=0;assert.equal(instantiateWorkshopCombat(d,{id:'range',random:()=>{calls++;return random;}}).hp,hp);assert.equal(calls,1);
}
assert.match(hitPointSummary(d.stats,d.creature.combat),/2–5 HP/);
d.creature.combat.hpRangeModifier=-10;assert.equal(instantiateCreature(d,{id:'minimum',random:()=>0}).hp,1);
d.creature.combat.hpRangeMin=4;d.creature.combat.hpRangeMax=4;d.creature.combat.hpRangeModifier=1;assert.equal(instantiateCreature(d,{id:'equal-range',random:()=>.5}).hp,5);
const good=structuredClone(d);
for(const change of [{hpRangeMin:5},{hpRangeMax:2.5},{hpRangeModifier:1.2},{hpRangeMin:0},{hpMode:'both'},{lessThanOneHitDie:'yes'}]){
 const bad=structuredClone(good);Object.assign(bad.creature.combat,change);assert(creatureIssues(bad).errors.length);assert.throws(()=>instantiateCreature(bad,{id:'invalid'}));
}
// Inactive inputs cannot interfere with the selected HP calculation or its validation.
d.stats.hp=NaN;d.creature.combat.hitDice='unused';assert.equal(creatureIssues(d).errors.length,0);assert.equal(instantiateCreature(d,{id:'range-only',random:()=>0}).hp,5);
assert(readiness(d).find(c=>c.label==='Statistics valid').ok);
d.creature.combat.hpMode='roll';d.creature.combat.hitDice='1d8-10';assert.equal(instantiateCreature(d,{id:'dice-minimum',random:()=>0}).hp,1);
d.creature.combat.hpMode='fixed';d.stats.hp=8;d.creature.combat.hitDice='unused';d.creature.combat.hpRangeMin=10;d.creature.combat.hpRangeMax=1;
assert.equal(creatureIssues(d).errors.length,0);assert.equal(instantiateCreature(d,{id:'fixed-only',random:noRoll}).hp,8);
d.stats.hp=1.5;assert(hitPointIssues(d.stats,d.creature.combat).length);d.stats.hp=8;
const legacy=newDraft();legacy.creature={combat:{hpMode:'average',hitDice:'2d8+2'}};ensureCreature(legacy);
assert.equal(legacy.creature.combat.hpMode,'fixed');assert.equal(legacy.stats.hp,11);assert.equal(instantiateCreature(legacy,{id:'legacy',random:noRoll}).hp,11);
assert.equal(legacy.creature.combat.lessThanOneHitDie,false);

// Real radio and numeric handlers: exactly one editable HP mode at a time.
const elements=new Map();
const doc={createTextNode:text=>({textContent:text}),createElement(){return {ownerDocument:doc,children:[],set id(v){this._id=v;elements.set(v,this);},get id(){return this._id;},append(...items){this.children.push(...items);},setCustomValidity(v){this.validationMessage=v;},reportValidity(){}};}};
const uiDraft=newDraft();let edits=0;const panel=createHitPointPanel({host:doc.createElement('div'),getDraft:()=>uiDraft,changed:()=>edits++});
const el=id=>elements.get(id),select=mode=>{el('hpMode-'+mode).checked=true;el('hpMode-'+mode).onchange();},set=(id,value)=>{el(id).value=String(value);el(id).onchange();};
const exclusive=mode=>{assert.equal(['fixed','roll','range'].filter(k=>el('hpMode-'+k).checked).length,1);assert.equal(el('hp').disabled,mode!=='fixed');assert.equal(el('hpDiceCount').disabled,mode!=='roll');assert.equal(el('hpRangeMin').disabled,mode!=='range');};
exclusive('fixed');set('hp',12);select('roll');exclusive('roll');set('hpDiceModifier',1);
assert.equal(uiDraft.creature.combat.hitDice,'1d8+1');assert.match(el('hpSummary').textContent,/2–9 HP/);
set('hpDiceCount',2);assert.equal(uiDraft.creature.combat.hitDice,'2d8+1');set('hpDiceCount',1.5);assert.equal(uiDraft.creature.combat.hitDice,'2d8+1','Invalid input restores the prior value');
select('range');exclusive('range');set('hpRangeModifier',1);assert.match(el('hpSummary').textContent,/2–5 HP/);
el('lessThanOneHitDie').checked=true;el('lessThanOneHitDie').onchange();assert.equal(uiDraft.creature.combat.lessThanOneHitDie,true);
select('fixed');exclusive('fixed');assert.equal(el('hp').value,12);assert.equal(instantiateCreature(uiDraft,{id:'ui',random:noRoll}).hp,12);assert(edits>0);
const restored=validateWorkshopProject({draft:JSON.parse(JSON.stringify(uiDraft)),files:{}}).draft;
assert.deepEqual(restored.creature.combat,uiDraft.creature.combat);panel.refresh();

// The actual combat Sweep gate and HD-aware spell helper consume the explicit classification.
const sandbox=vm.createContext({});
vm.runInContext(extractCombatFunction(readFileSync('js/combat-melee-actions.js','utf8'),'isSweepEligibleTarget'),sandbox);
vm.runInContext(extractCombatFunction(readFileSync('js/adventure-party.js','utf8'),'spellHitDiceValue'),sandbox);
const unit={...instantiateWorkshopCombat(restored,{id:'sweep'}),alive:true,fled:false,faction:'enemy'};
assert.equal(unit.hp,12);assert.equal(unit.hitDiceValue,.5);assert.equal(unit.lessThanOneHitDie,true);assert(sandbox.isSweepEligibleTarget(unit));assert.equal(sandbox.spellHitDiceValue(unit),.5);
for(const change of [{alive:false},{fled:true},{faction:'friendly'}])assert(!sandbox.isSweepEligibleTarget({...unit,...change}));
restored.stats.hp=1;restored.creature.combat.lessThanOneHitDie=false;
const ordinary={...instantiateWorkshopCombat(restored,{id:'ordinary'}),alive:true,faction:'enemy'};
assert(!sandbox.isSweepEligibleTarget(ordinary),'Low HP alone does not make an unchecked MOB eligible');
assert(sandbox.isSweepEligibleTarget({alive:true,faction:'enemy',hitDiceValue:.5}),'Existing fractional-HD units retain their rule');

const pack=JSON.parse(readFileSync('data/mobs/wood-elf-archer.workshop-unit.json','utf8'));
Object.assign(pack.draft.creature.combat,{hpMode:'range',hpRangeMin:1,hpRangeMax:4,hpRangeModifier:1,lessThanOneHitDie:true});
const published=validateWorkshopUnit(JSON.parse(JSON.stringify(pack))),combatUnit=createWorkshopRepositoryMob(published).apply({id:'published'},()=>.999);
assert.equal(combatUnit.hp,5);assert.equal(combatUnit.maxHp,5);assert.equal(combatUnit.lessThanOneHitDie,true);assert.equal(combatUnit.hitDiceValue,.5);
console.log('PASS exclusive fixed/dice/range HP, modifiers and inclusive bounds, one-time generation, minimum 1 HP, validation, legacy average migration, real UI controls, published round-trip and live Sweep/HD classification.');
