import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as rules from '../js/mob-class-rules.mjs';
import {PRIEST_SPELLS} from '../js/priest-spells.mjs';
import {normalizeMobDefinition} from '../js/mob-definition.mjs';
const engine=fs.readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
// Extract the production declarations, not a second set of expected tables.
const constants=['FIGHTER_CLASS','MAGE_CLASS','CLERIC_CLASS','THIEF_CLASS','FIGHTER_LEVELS','MAGE_SPELL_SLOT_ROWS','CLERIC_SPELL_SLOT_ROWS','MAGE_SAVING_THROW_BANDS','PRIEST_SAVING_THROW_BANDS','ROGUE_SAVING_THROW_BANDS','WARRIOR_SAVING_THROW_BANDS','MAGE_INTELLIGENCE_TABLE','SPELL_CATALOG'];
const context=vm.createContext({PRIEST_SPELLS,TACTICAL_FEET_PER_HEX:10,Infinity});
for(const name of constants){const source=engine.match(new RegExp('const '+name+'=[\\s\\S]*?^[}\\]];?$','m'))?.[0];assert.ok(source,name);vm.runInContext(source+'\nglobalThis.result='+name,context);assert.equal(JSON.stringify(context.result),JSON.stringify(rules[name]),name+' must match engine');}
for(const id of ['fighter','ranger','mage','cleric','thief'])for(let level=1;level<=20;level++){const p=rules.classProgression(id,level,{con:18,int:18,wis:18});assert.ok(p.thaco>=1);assert.ok(p.dice>0);assert.equal(Object.keys(p.saves).length,5);}
assert.equal(rules.classProgression('fighter',2).thaco,19);assert.equal(rules.classProgression('fighter',3).thaco,18);assert.equal(rules.classProgression('fighter',10).hitDice,'9d10+3');assert.equal(rules.classProgression('mage',11).hitDice,'10d4+1');assert.equal(rules.classProgression('cleric',10).hitDice,'9d8+2');assert.equal(rules.classProgression('thief',11).hitDice,'10d6+2');
assert.equal(rules.classProgression('fighter',7).attacksPerRound,1.5);assert.equal(rules.classProgression('fighter',13).attacksPerRound,2);
assert.deepEqual(rules.classProgression('cleric',1,{wis:18}).spellSlots,[3,0,0,0,0,0,0]);
assert.equal(rules.classProgression('mage',20,{int:9}).spellSlots[4],0);
const prepared={mage:{mode:'prepared',choices:[{spellId:'magic-missile',count:2}]}};
assert.throws(()=>rules.prepareMobSpells('mage',1,{int:10},prepared),/too many/);
assert.deepEqual(rules.prepareMobSpells('mage',2,{int:10},prepared).memorizedSpellIds,['magic-missile','magic-missile']);
assert.throws(()=>rules.normalizeSpellPreparation({cleric:{mode:'prepared',choices:[{spellId:'magic-missile',count:1}]}}));
const pool={mage:{mode:'pool',choices:[{spellId:'magic-missile',count:1},{spellId:'shield',count:3},{spellId:'fireball',count:1}]}};
assert.deepEqual(rules.prepareMobSpells('mage',1,{int:10},pool,()=>.5).memorizedSpellIds,['shield']);
const template=JSON.parse(fs.readFileSync(new URL('../data/mobs/orc-male-uniformed.unit-package.json',import.meta.url)));
let a=rules.generateMobRules(template,{classId:'fighter',level:3},()=>0);assert.equal(a.hp,3);assert.equal(a.thaco,18);
template.character.abilities.con=18;a=rules.generateMobRules(template,{classId:'fighter',level:3},()=>0);assert.equal(a.hp,15);
template.character.rules.overrideHp=true;template.character.rules.hpMode='fixed';template.character.rules.maxHp=42;a=rules.generateMobRules(template,{classId:'fighter',level:3},()=>0);assert.equal(a.hp,42);assert.equal(a.thaco,18);
const mage=structuredClone(template);mage.mob.generation={version:1,kind:'unique',fixed:{classId:'mage',level:2,primary:'none',offHand:'none'},alwaysItems:[]};mage.mob.spellPreparation=prepared;const roundtrip=normalizeMobDefinition(JSON.parse(JSON.stringify(mage)));assert.deepEqual(roundtrip.mob.spellPreparation.mage,prepared.mage);
const first=rules.generateMobRules(roundtrip,{classId:'mage',level:2},()=>0),second=rules.generateMobRules(roundtrip,{classId:'mage',level:2},()=>0);first.memorizedSpellIds.pop();assert.equal(second.memorizedSpellIds.length,2);assert.equal(roundtrip.mob.spellPreparation.mage.choices[0].count,2);
console.log('PASS class progression parity, levels 1–20, HP/CON/caps, overrides, saves, attacks, spell slots, pools, eligibility, round trips and independent resources');
const combat=vm.createContext({});
for(const name of ['mageEnsureSpellState','mageConsumeMemorizedSpell','clericCanCastPreparedSpell','clericConsumePreparedSpell','repositoryAttacksThisRound']){const source=engine.match(new RegExp('function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?^}','m'))?.[0];assert.ok(source,name);vm.runInContext(source,combat);}
const generatedMage={classId:'mage',...rules.prepareMobSpells('mage',2,{int:10},prepared)};
assert.equal(combat.mageConsumeMemorizedSpell(generatedMage,'magic-missile'),true);assert.equal(generatedMage.memorizedSpellIds.length,1);
const generatedCleric={classId:'cleric',...rules.prepareMobSpells('cleric',1,{wis:10},{cleric:{mode:'prepared',choices:[{spellId:'priest-cure-light-wounds',count:1}]}})};
assert.equal(combat.clericConsumePreparedSpell(generatedCleric,'priest-cure-light-wounds'),true);assert.equal(combat.clericConsumePreparedSpell(generatedCleric,'priest-cure-light-wounds'),false);
assert.equal(combat.repositoryAttacksThisRound({attacksPerRound:1.5},1),1);assert.equal(combat.repositoryAttacksThisRound({attacksPerRound:1.5},2),2);
const caster={id:'orc-mage',repositoryMobId:'orc',classId:'mage',level:2,faction:'enemy',alive:true,memorizedSpellIds:['magic-missile']},target={id:'player',faction:'player',alive:true};let cast;
Object.assign(combat,{getSpellEntry:id=>rules.SPELL_CATALOG[id],allUnits:()=>[caster,target],hexDistance:()=>1,spellRangeHexes:()=>10,lineOfSightBlocked:()=>false,getUnitEffect:()=>null,castPreparedCombatSpell:async(action,hex,unit)=>{cast={action,unit};return true;}});
vm.runInContext(engine.match(/async function repositoryMobCast\([^\n]*\)\{[\s\S]*?^}/m)[0],combat);
assert.equal(await combat.repositoryMobCast(caster),true);assert.equal(cast.unit,target);assert.equal(cast.action.type,'memorized-spell');assert.equal(cast.action.sourceUnitId,'orc-mage');
console.log('PASS generated spell resources consumed by production helpers, fractional attacks and hostile caster dispatch');
