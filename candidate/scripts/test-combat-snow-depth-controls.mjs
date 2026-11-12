import assert from 'node:assert/strict';import {createSnowCoatCoverage} from '../js/combat-snow-coats.mjs';import {snowDepthMetres} from '../js/combat-snow-depth.mjs';
const c=createSnowCoatCoverage();c.configure([0,0,2,1],2,1,new Map([['a',{triangles:[{a:{x:0,y:0},b:{x:1,y:0},c:{x:1,y:1}},{a:{x:0,y:0},b:{x:1,y:1},c:{x:0,y:1}}]}]]));
const inches=()=>snowDepthMetres(c.sampleDepthWorld(.5,.5))/.0254;
for(let n=1;n<=38;n++){c.adjustDepth(1/6);assert(Math.abs(inches()-Math.min(36,n))<.06);assert.equal(snowDepthMetres(c.sampleWorld(1.5,.5)),0);}
for(let n=1;n<=38;n++){c.adjustDepth(-1/6);assert(Math.abs(inches()-Math.max(0,36-n))<.06);}
assert.equal(inches(),0);console.log('PASS repeated inch adjustments, 0/36-inch bounds, no accumulated rounding drift and indoor exclusion');
