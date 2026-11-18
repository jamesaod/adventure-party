import assert from 'node:assert/strict';
import {createHexSnow} from '../js/combat-snow-state.mjs';
import {createSnowCoatCoverage,SNOW_BRUSH_SIZE,SNOW_BRUSHES,SNOW_GRAIN_RATE_SCALE,snowBrushAtlas} from '../js/combat-snow-coats.mjs?v=natural-ac1';
import {createSnowDepositBatch} from '../js/combat-snow-deposits.mjs';
const N=128,ground=createHexSnow();ground.update([{snowHex:'0,0',snowEligible:1,points:[{x:0,y:0},{x:N,y:0},{x:N,y:N},{x:0,y:N}]}]);
const coats=createSnowCoatCoverage();coats.configure([0,0,N,N],N,N,ground.hexes);
let seed=831;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
const batch=createSnowDepositBatch(32768,{grainScale:SNOW_GRAIN_RATE_SCALE}),times=[];
for(let tick=1;tick<=2400;tick++){
 batch.add(.05/60,N*N,1);batch.take(r=>ground.spawn(r),[],random,(p,r)=>coats.deposit(p,r));
 if(!times[0]&&coats.coverage.first===1)times[0]=tick*.05;
 if(coats.coverage.second===1){times[1]=tick*.05;break;}
}
// Measured original 5/7-pixel brushes, identical seed/field: 46.43s and 93.79s.
for(const [i,expected] of [46.43,93.79].entries())assert(Math.abs(times[i]/expected-1)<.05,`Coat ${i+1} retains original snowfall timing: ${times[i]}`);
assert(batch.pending<1,'Normal snowfall does not build a work backlog');
assert.equal(SNOW_BRUSH_SIZE,3);const atlas=snowBrushAtlas();assert.equal(atlas.length,16*3*3*4);
for(const [id,brush] of SNOW_BRUSHES.entries())for(const p of brush){assert(Math.abs(p.x)<=1&&Math.abs(p.y)<=1);assert.equal(atlas[((p.y+1)*48+id*3+p.x+1)*4],p.dose);}
console.log('PASS half-diameter brush atlas, bounded deposition and original coat timing',times);
