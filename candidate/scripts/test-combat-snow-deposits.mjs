import assert from 'node:assert/strict';
import {createSnowDepositBatch} from '../js/combat-snow-deposits.mjs';
import {createHexSnow} from '../js/combat-snow-state.mjs';
const state=createHexSnow();state.update([{snowHex:'0,0',snowEligible:1,points:[{x:10,y:20},{x:110,y:20},{x:110,y:120},{x:10,y:120}]}]);
assert.equal(state.area,10000);
let seed=17;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
const batch=createSnowDepositBatch(100);batch.add(.1,state.area,1);let total=0,count;
while((count=batch.take(r=>state.spawn(r),[],random))>0){total+=count;assert(count<=100);for(let i=0;i<count;i++){const [x,y,size]=batch.positions.subarray(i*3,i*3+3);assert(x>=10&&x<=110&&y>=20&&y<=120);assert(size>=4.19&&size<=7.01);}}
assert.equal(total,434);assert(batch.pending<1);
batch.clear();assert.equal(batch.pending,0);assert.equal(batch.take(()=>null),0);
const one=createSnowDepositBatch(),split=createSnowDepositBatch();one.add(.1,10000,2);for(let i=0;i<10;i++)split.add(.01,10000,2);assert(Math.abs(one.pending-split.pending)<1e-8,'Time slicing must preserve snow mass');
const landed=[{x:33,y:44}];one.take(r=>state.spawn(r),landed,random);assert.equal(one.positions[0],33);assert.equal(one.positions[1],44);assert.equal(landed.length,0,'Visible flake landings are deposited first');
console.log('PASS bounded particle batches, conservation across time slices, exact visible landing positions, outdoor sampling and clear');
