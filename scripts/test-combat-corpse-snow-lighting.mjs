import assert from 'node:assert/strict';
import {snowAmbientDisplay,corpseSnowTint} from '../js/combat-corpse-snow.mjs?v=natural-ac1';
import {composeSnowDisplay} from '../js/combat-lighting-profile.mjs';
for(const factor of [[0,0,0],[.08,.11,.16],[.3,.35,.42],[.7,.74,.78],[.7,.4,.15],[1,1,1],[1.6,1.8,2.1]])for(const amount of [2,3,3.5,4]){
 const input=factor.map((v,i)=>v*corpseSnowTint(amount)[i]);
 const terrain=input.map(c=>Math.min(1,Math.max(0,c))),baseline=snowAmbientDisplay(input).toArray();
 assert.deepEqual(baseline,terrain,'Snow retains ground display color including clamped noon whites');
 assert.deepEqual(composeSnowDisplay(baseline,[0,0,0]),terrain,'No reflected lamp: exact ambient match');
}
assert.deepEqual(snowAmbientDisplay([-1,NaN,Infinity]).toArray(),[0,0,0]);
for(const amount of [0,1,2])assert.deepEqual(corpseSnowTint(amount),[.902,.916,.930]);
assert.deepEqual(corpseSnowTint(4),[.88,.92,.96]);
assert(corpseSnowTint(3.5)[2]>.930&&corpseSnowTint(3.5)[2]<.96);
console.log('PASS terrain-matched snow ambient: darkness, night, twilight, day, warm light and clipped noon; powder/depth tint retained');
