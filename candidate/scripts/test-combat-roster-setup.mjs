import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const game=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../css/adventure-party.css',import.meta.url),'utf8');
assert.ok(page.includes('id="combatMobRows"')&&page.includes('id="addCombatMobButton"'));
assert.ok(!page.includes('data-mob-encounter="studio-kobold"'));
assert.ok(!page.includes('6-facing Kobold'));
assert.ok(!page.includes('data-mob-encounter="kobolds"'));
assert.ok(game.includes('const combatMobRoster=[]'),'MOB roster must be empty at startup');
assert.ok(game.includes('combatMobRoster.push({rowId:'),'add button should append rows');
assert.ok(game.includes('const count=document.createElement("input")'));
assert.ok(game.includes('const faction=document.createElement("select")'));
assert.ok(game.includes('function deployConfiguredCombatMobs('));
assert.ok(game.includes('makeStudioTestMob(group.type,index'));
assert.ok(game.includes('mob.controller=friendly?"player":"mob"'));
assert.ok(game.includes('occupiedHexesAt(mob,pos.x,pos.y'),'MOB footprint collision handling');
assert.ok(game.includes('selectedMobEncounter==="studio-kobold" ? makeStudioTestPlayer(condition)'),
 'Studio sprite-test handoff remains supported');
assert.ok(game.includes('const allies=configured.allies'));
assert.ok(game.includes('id="combatPlayerName"')||page.includes('id="combatPlayerName"'));
assert.ok(css.includes('.combat-mob-editor-row'));
console.log('PASS dynamic empty-default MOB roster and deployment source checks');

const {default:vm}=await import('node:vm');
const start=game.indexOf('document.getElementById("addCombatMobButton")?.addEventListener');
const handler=game.slice(start,game.indexOf('\n});',start)+4);
let add,updates=0;
const context={selectedMobEncounter:'studio-kobold',combatMobRoster:[],combatMobRowSequence:0,
 document:{getElementById:()=>({addEventListener:(_event,callback)=>{add=callback;}})},
 availableCombatMobChoices:()=>[["mob:orc-archer","Orc Archer"]],cancelPendingCombatStart(){},updateCombatMobSelection(){updates++;}};
vm.runInNewContext(handler,context);add();add();
assert.equal(context.selectedMobEncounter,'studio-kobold','Adding opponents keeps the selected Studio player');
assert.equal(context.combatMobRoster.length,2);assert.equal(updates,2);
