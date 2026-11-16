import assert from 'node:assert/strict';
import {createSnowCoatCoverage,createSnowDepositionClock} from '../js/combat-snow-coats.mjs?v=tree-snow-grains1';
import {createHexSnow} from '../js/combat-snow-state.mjs';
import {corpseSnowElapsed,registerCorpseSnow,advanceCorpseSnow,resetCorpseSnow,fillCorpseSnow} from '../js/combat-corpse-snow.mjs?v=tree-snow-grains1';
const state=createHexSnow();state.update([{snowHex:'0,0',snowEligible:1,points:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]}]);
const coats=createSnowCoatCoverage();coats.configure([0,0,1,1],1,1,state.hexes);const clock=createSnowDepositionClock();
const corpse=registerCorpseSnow({alive:false,x:0,y:0}),indoor=registerCorpseSnow({alive:false,x:9,y:9});
for(let n=0;n<10;n++){
 const before=coats.progress;coats.deposit({x:.5,y:.5,landed:true},()=>0);const delta=clock.advance(before,coats.progress,1);advanceCorpseSnow(state.hexes,3);
 assert(Math.abs(corpse.value-(n+1)/10)<1e-9,'Bodies advance independently at one layer per 30 seconds');
 assert.equal(indoor.value,0);
}
assert.equal(coats.progress,3);const late=registerCorpseSnow({alive:false,x:0,y:0});assert.equal(late.value,0);
assert.equal(clock.advance(3,3,0),0,'Paused or queued deposits do not advance snow');
advanceCorpseSnow(state.hexes,3);assert(late.value>0&&late.value<1,'Fresh corpses still accumulate on fully snow-covered ground');
coats.melt(['0,0'],1);assert.equal(coats.progress,0);const before=coats.progress;assert.equal(clock.advance(before,before,0),0,'Melt itself never counts as snowfall');
clock.clear();resetCorpseSnow(true);assert.equal(clock.advance(3,3,1),0);
console.log('PASS independent ground/corpse timing, strict layer gates, pause, indoor exclusion, late corpses, melt and clear');

coats.fill();assert.equal(coats.progress,3);assert.deepEqual(coats.coverage,{first:1,second:1,depth:1,texels:1});
const fullBody=registerCorpseSnow({alive:false,x:0,y:0}),shelteredBody=registerCorpseSnow({alive:false,x:9,y:9});fillCorpseSnow(state.hexes);assert.equal(fullBody.value,4);assert.equal(shelteredBody.value,0);
clock.prime(coats.coverage.texels);assert(clock.advance(3,3,1)>0,'Instant full snow still allows fresh corpses to accumulate');
coats.clear();resetCorpseSnow(true);assert.equal(coats.progress,0);assert.equal(fullBody.value,0);

for(const [intensity,seconds] of [[1,120],[.5,240],[.25,480]]){
 resetCorpseSnow(true);const body=registerCorpseSnow({alive:false,x:0,y:0});
 for(let second=0;second<seconds;second++)advanceCorpseSnow(state.hexes,corpseSnowElapsed(1,intensity));
 assert(Math.abs(body.value-4)<1e-9,`${intensity*100}% snowfall fills in ${seconds} seconds`);
}
assert.equal(corpseSnowElapsed(1,0),0);assert.equal(corpseSnowElapsed(10,1),1);
resetCorpseSnow(true);
console.log('PASS slider-scaled corpse snow timing at 100%, 50%, 25%, zero, and elapsed-time cap');