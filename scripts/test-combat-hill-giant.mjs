import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {extractCombatFunction} from './combat-test-source.mjs';
import {quickCheckWorkshopUnit} from './workshop-import-checks.mjs';
const source=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const pack=JSON.parse(readFileSync(new URL('../data/mobs/hill-giant.workshop-unit.json',import.meta.url)));
quickCheckWorkshopUnit(pack);assert.equal(pack.draft.stats.str,21);
const ctx={};vm.createContext(ctx);vm.runInContext(extractCombatFunction(source,'strengthMods'),ctx);
for(const [score,hit,damage]of [[18,1,2],[19,3,7],[20,3,8],[21,4,9],[22,4,10],[23,5,11],[24,6,12],[25,7,14]]){assert.equal(ctx.strengthMods(score).hit,hit);assert.equal(ctx.strengthMods(score).damage,damage);}
assert.equal(ctx.strengthMods(18,100).damage,6);
Object.assign(ctx,{makeLegacyOrc:()=>({}),window:{adventurePartyRepositoryMobs:{apply(u){Object.assign(u,{name:'Hill Giant',stats:{str:pack.draft.stats.str},hp:50,maxHp:50,heightInches:192,inventory:[],move:12,authoredBaseAc:10});}}},syncFighterEquipment(){},configureTreeHauler(u){u.treeHauler={stage:'seek',tree:null};}});
vm.runInContext(extractCombatFunction(source,'makeLibraryMob'),ctx);const giant=ctx.makeLibraryMob('hill-giant',0,{x:0,y:0});assert.equal(giant.attackBonus,4);assert.equal(giant.damageBonus,9);assert.equal(giant.hp,50);assert.equal(giant.heightInches,192);assert.equal(giant.treeHauler.stage,'seek');
assert(!extractCombatFunction(source,'availableCombatMobChoices').includes('special:treebreaker-orc'));
console.log('PASS Hill Giant tree AI, authored stats, STR 21 bonuses and retired special orc');
