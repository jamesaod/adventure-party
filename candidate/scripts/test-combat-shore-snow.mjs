import assert from 'node:assert/strict';
import {createStreamSnowLimit,shoreSnowFraction,SHORE_SNOW_FEATHER_METRES} from '../js/stream-snow-limit.mjs?v=shore-snow1';
import {createSnowCoatCoverage} from '../js/combat-snow-coats.mjs?v=tree-snow-grains1';
import {snowDepthMetres,SNOW_MAX_METRES} from '../js/combat-snow-depth.mjs?v=shore-snow1';
import {createHexSnow} from '../js/combat-snow-state.mjs';
assert.equal(SHORE_SNOW_FEATHER_METRES,.9144000000000001);
assert.equal(shoreSnowFraction(0),0);assert.equal(shoreSnowFraction(SHORE_SNOW_FEATHER_METRES/2),.5);assert.equal(shoreSnowFraction(1),1);
assert(Math.abs(SNOW_MAX_METRES/.0254-18)<1e-9);
const stream={revision:1,size:128,bounds:[-2,-4,4,8],settings:{enabled:true},data:new Float32Array(128*128*4)};
for(let y=0;y<128;y++)for(let x=0;x<64;x++)stream.data[(y*128+x)*4+1]=.1;
const limit=createStreamSnowLimit();assert(limit.configure(stream));assert(!limit.configure(stream));assert(limit.distance(-1,0)===0);assert(Math.abs(limit.distance(.45,0)-.45)<.04);assert.equal(limit.fraction(1.2,0),1);
// Rotated shoreline uses real metres despite different X/Y texel dimensions.
stream.revision++;for(let y=0;y<128;y++)for(let x=0;x<128;x++)stream.data[(y*128+x)*4+1]=y<64?.1:0;
limit.configure(stream);assert(Math.abs(limit.distance(0,.45)-.45)<.05);
stream.settings.enabled=false;stream.revision++;limit.configure(stream);assert.equal(limit.fraction(0,0),1);
const ground=createHexSnow();ground.update([{grass:true,snowEligible:1,snowHex:'0,0',points:[{x:0,y:0},{x:2,y:0},{x:2,y:1},{x:0,y:1}]}]);
const c=createSnowCoatCoverage();c.configure([0,0,2,1],64,16,ground.hexes);
const source={revision:1,level:0,threshold:x=>x<.125?-Infinity:Infinity,snowLimit:x=>shoreSnowFraction(Math.max(0,x-.125))};
c.restrictWater(source);c.fill();let previous=0;
for(let x=0;x<64;x++){const wx=(x+.5)/32,h=snowDepthMetres(c.sampleDepthWorld(wx,.5));assert(h+1e-9>=previous);assert(Math.abs(h-SNOW_MAX_METRES*source.snowLimit(wx))<.002);previous=h;}
for(let i=0;i<30;i++)c.adjustDepth(1/6);
assert(snowDepthMetres(c.sampleDepthWorld(.2,.5))<.02);assert(Math.abs(snowDepthMetres(c.sampleDepthWorld(1.5,.5))-SNOW_MAX_METRES)<1e-6);
c.clear();let seed=12;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let n=0;n<140000;n++)c.deposit({x:rng()*2,y:rng()},rng);
assert.equal(c.coverage.first,1,'Low-cap shore cannot stall first coat');assert.equal(c.coverage.second,1,'Low-cap shore cannot stall powder');
assert(c.sampleDepthWorld(1.5,.5)[2]>0,'Inland third layer still accumulates');
for(let x=0;x<64;x++){const wx=(x+.5)/32;assert(snowDepthMetres(c.sampleDepthWorld(wx,.5))<=SNOW_MAX_METRES*source.snowLimit(wx)+.002);}
assert.equal(c.restrictWater(source),false,'Stable shoreline does not rebake');
console.log('PASS metric three-foot shoreline, smooth 0–18 inch cap, fill/manual/natural snowfall, completion gates, rotation, disabled stream and cached updates');
