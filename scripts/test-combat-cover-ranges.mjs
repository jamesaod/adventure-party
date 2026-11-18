import assert from 'node:assert/strict';
import {createCoverRangeIndex} from '../js/cover-range-index.mjs';
const items=Array.from({length:700},(_,i)=>({x:(i%31)*13-180,y:Math.floor(i/31)*9-100,unit:20+i%7,squash:.4+(i%3)*.1}));
const movers=Array.from({length:32},(_,i)=>[i*33-500,i*17-250,.1+(i%4),.4]);
const index=createCoverRangeIndex(items);let reduced=false;
for(let start=0;start<items.length;start+=37){const end=Math.min(items.length,start+61),selected=index.select(start,end,movers);if(selected.length<movers.length)reduced=true;for(const m of movers)for(const p of items.slice(start,end)){const d=Math.hypot((p.x-m[0])/p.unit,(p.y-m[1])/(p.unit*p.squash));if(d<m[2])assert.ok(selected.includes(m),'Never remove a mover affecting an instance, including partial blocks');}assert.deepEqual(selected,movers.filter(m=>selected.includes(m)),'Preserve mover order');}
assert.ok(reduced);assert.deepEqual(index.select(0,0,movers),[]);assert.equal(createCoverRangeIndex([{x:0,y:0,unit:0,squash:1}]).select(0,1,movers),movers);assert.equal(index.select(0,99999,movers),movers);const odd=[[9999,9999,.01,1],[NaN,0,1,1]];assert.deepEqual(index.select(0,10,odd),odd);console.log('PASS range culling parity, varying scale, partial blocks, stable order and conservative fallbacks');
