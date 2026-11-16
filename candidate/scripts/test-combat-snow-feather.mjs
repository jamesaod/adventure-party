import assert from 'node:assert/strict';
import {createSnowCoatCoverage} from '../js/combat-snow-coats.mjs?v=tree-snow-grains1';import {createHexSnow} from '../js/combat-snow-state.mjs';
const ground=createHexSnow();ground.update([0,1,2].map(x=>({snowHex:x+',0',snowEligible:1,points:[{x,y:0},{x:x+1,y:0},{x:x+1,y:1},{x,y:1}]})));
const coats=createSnowCoatCoverage();coats.configure([0,0,3,1],96,32,ground.hexes);coats.adjustDepth(6);coats.melt(['0,0'],1);coats.featherMelt(['0,0'],1,1);
const near=coats.sampleDepthWorld(1.05,.5),mid=coats.sampleDepthWorld(1.5,.5),far=coats.sampleDepthWorld(1.95,.5);
assert(near[0]<mid[0]&&mid[0]<far[0]);assert(near[1]<mid[1]&&mid[1]<far[1]);assert.equal(coats.sampleDepthWorld(.5,.5)[2],0);assert.equal(coats.sampleDepthWorld(2.5,.5)[1],1);
console.log('PASS continuous adjacent melt, capped-snow coat gradient, clear core, untouched outer hex');

// Compare every output byte with the original distance calculation.
const {readFileSync}=await import('node:fs');let source=readFileSync(new URL('../js/combat-snow-coats.mjs?v=tree-snow-grains1',import.meta.url),'utf8');
const start=source.indexOf('    let distanceSquared=radius*radius;'),end=source.indexOf('    first[i]=',start);
assert(start>=0&&end>start);
source=source.slice(0,start)+`    let distance=radius;for(const box of buckets.get(Math.floor(x/step)+','+Math.floor(y/step))||[])distance=Math.min(distance,Math.hypot(Math.max(box[0]-x,0,x-box[2]),Math.max(box[1]-y,0,y-box[3])));
    const t=Math.min(1,distance/radius),remaining=t*t*(3-2*t);
`+source.slice(end);
source=source.replace('./combat-snow-water.mjs?v=water1',new URL('../js/combat-snow-water.mjs',import.meta.url).href);
source=source.replace('./combat-snow-depth.mjs',new URL('../js/combat-snow-depth.mjs?v=shore-snow1',import.meta.url).href);
source=source.replaceAll('./snow-grain-brushes.mjs',new URL('../js/snow-grain-brushes.mjs',import.meta.url).href);
const reference=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
for(const radius of [.4,.85,1.2]){const make=fn=>{const c=fn();c.configure([0,0,3,1],256,128,ground.hexes);c.adjustDepth(6);c.melt(['0,0'],1);return c.featherMelt(['0,0'],radius,.73).data;};assert.deepEqual(make(createSnowCoatCoverage),make(reference.createSnowCoatCoverage));}
console.log('PASS optimized gradient matches reference bytes at multiple radii');


