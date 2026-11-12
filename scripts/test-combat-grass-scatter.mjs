import assert from 'node:assert/strict';
import {grassScatter} from '../js/combat-grass-scatter.mjs';
import {triangulateSurfaces,combatProjection} from '../js/combat-webgl.mjs';
const face=(left=0,right=128)=>({grass:true,grassUnit:128/3,grassSquash:.568329,snowEligible:1,visibility:.1,multiply:[.2,.3,.4],points:[{x:left,y:0},{x:right,y:0},{x:right,y:72.746},{x:left,y:72.746}],uv:[[left/128,1],[right/128,1],[right/128,0],[left/128,0]],lightPoints:[[0,0,0],[3,0,0],[3,0,3],[0,0,3]]});
const full=grassScatter([face()]),split=grassScatter([face(0,64),face(64,128)]);
assert(full.length>0);
const shapes=rows=>rows.map(f=>JSON.stringify([f.points,f.tint])).sort();
assert.deepEqual(shapes(full),shapes(split),'Floor clipping must not shrink, reroll or remove grass');
assert.deepEqual(grassScatter([face()]),full,'Repeated frames preserve scatter');
assert.equal(grassScatter([{...face(),grass:false}]).length,0);
assert.equal(grassScatter([{...face(),snowEligible:0}]).length,0);
assert(full.every(f=>f.visibility===.1&&f.multiply[0]===.2&&f.lightWorld.length===f.points.length));
const mesh=triangulateSurfaces(full);assert(Object.values(mesh).flat().every(Number.isFinite));
const blades=full.filter(f=>f.snowEligible===-1);
assert(blades.every(f=>Math.max(...f.points.map(p=>p.elevation))>=7.68),'Tuft height is based on metres, not clipped polygon area');
for(let i=0;i<6;i++){
 const a=i*Math.PI/3,view={matrix:[Math.cos(a),Math.sin(a)*.568329,-Math.sin(a)/.568329,Math.cos(a),0,0],anchor:{x:0,y:0},zoom:1};
 assert(blades.some(f=>{const p=f.points.map(p=>combatProjection(p,view));return Math.max(...p.map(p=>p.x))-Math.min(...p.map(p=>p.x))>1.5;}),'Blades must have visible width at every view angle');
}
const large=grassScatter([{...face(),points:[{x:0,y:0},{x:1024,y:0},{x:1024,y:582},{x:0,y:582}]}]);
assert(large.some(f=>f.snowEligible===-2),'Stones are included with distinct colors');
assert(large.length<6000,'Scatter density stays bounded');
console.log('PASS visible world-scale grass, stable split-floor placements, stones, lighting, exclusions and six view angles');
