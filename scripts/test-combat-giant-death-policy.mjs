import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
import {extractCombatFunction} from './combat-test-source.mjs';
import {newDraft,assignClip} from '../js/mob-workshop-core.mjs';
import {createWorkshopAnimationSelector} from '../js/workshop-animation-runtime.mjs';
const melee=fs.readFileSync('js/combat-melee-actions.js','utf8'),engine=fs.readFileSync('js/adventure-party.js','utf8');
const ctx={};vm.createContext(ctx);for(const name of ['hillGiantWieldsTreeClub','giantClubSkipsDeathFall'])vm.runInContext(extractCombatFunction(melee,name),ctx);
const giant={repositoryMobId:'hill-giant',inventory:[{equipped:true,slot:'weapon',treeLog:true}]};
for(const size of ['tiny','small','medium','large','huge','gargantuan',''])assert.equal(ctx.giantClubSkipsDeathFall(giant,{sizeCategory:size}),['small','medium'].includes(size));
assert.equal(ctx.giantClubSkipsDeathFall({...giant,inventory:[]},{sizeCategory:'medium'}),false);
const draft=newDraft();draft.clips=[{id:'fall',duration:3}];assignClip(draft,'death',{clipId:'fall',start:0,end:3,speed:1,loop:false});const select=createWorkshopAnimationSelector(draft);
for(const skip of [true,false]){const e={alive:false,deathPresentationStartedAt:1000,giantClubProneDeath:skip};const pose=select(e,'death',99,1250);assert.equal(pose.time,skip?3:.25);assert.equal(pose.animating,!skip);assert.equal(e.deathAnimationDurationMs,skip?0:3000);}
// The lead friendly in an autonomous encounter retains its roster ID.
const elf={id:'roster-wood-elf',alive:false};ctx.game={over:true,player:elf,allies:[],enemies:[]};vm.runInContext(extractCombatFunction(engine,'getUnitById'),ctx);assert.equal(ctx.getUnitById(elf.id),elf);assert.equal(ctx.getUnitById('player'),elf);
let shown=false;Object.assign(ctx,{candidateCombatBeatPresentationEnabled:()=>true,r236QueueFloatingCombatText(){}});vm.runInContext(extractCombatFunction(fs.readFileSync('js/candidate-combat-beat-sequence.js','utf8'),'candidateRunCombatBeat'),ctx);ctx.candidateRunCombatBeat({gameRef:ctx.game,unitId:elf.id,show:u=>{assert.equal(u,elf);shown=true;}});assert(shown,'Final autonomous-unit death beat still runs after combat ends');
console.log('PASS giant club size/weapon policy, final prone versus animated death, and final autonomous-unit death lookup');
