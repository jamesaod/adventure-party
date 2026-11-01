import assert from 'node:assert/strict';
import {clipPolygon,polygonArea,hexPolygon,worldHex,floorFragmentIndex,faceLightFragments,orderSurfaceActors} from '../js/combat-surface-lighting.mjs';
import {solidPrism} from '../js/exploration-combat-geometry.mjs';
import {spellEffectLightSources,spellSurfaceRadiance} from '../js/spell-illumination.mjs';
const rect=(left,top,right,bottom)=>[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
// A wall crosses the tactical hex; the floor can exist on both sides, or only
// in a sliver whose center is inside a solid block. Neither side may disappear.
const whole=hexPolygon(0,0),index=floorFragmentIndex([{polygon:rect(-40,-30,0,30)},{polygon:rect(0,-30,40,30)}]);
const halves=index({x:0,y:0});assert.equal(halves.length,2);assert(halves[0].point.x<0&&halves[1].point.x>0);
assert(Math.abs(halves.reduce((a,f)=>a+Math.abs(polygonArea(f.polygon)),0)-Math.abs(polygonArea(whole)))<1e-7);
assert.equal(index({x:0,y:0}),halves,'Static fragments are reused');
const sliver=floorFragmentIndex([{polygon:rect(20,-30,40,30)}])({x:0,y:0});assert.equal(sliver.length,1);assert(sliver[0].point.x>0);
assert.equal(clipPolygon(whole,rect(100,100,110,110)).length,0);assert.equal(Math.abs(polygonArea(clipPolygon(whole,[...rect(-40,-30,40,30)].reverse()))),Math.abs(polygonArea(whole)));
for(const angle of [0,Math.PI/3,2*Math.PI/3,Math.PI,4*Math.PI/3,5*Math.PI/3]){
 const a={x:-96,y:-5},b={x:96,y:5},face=solidPrism(a,b,3,35).faces[0],parts=faceLightFragments(face);
 assert(parts.length>=4);assert(parts.every(p=>p.points.length===4));
 const lengths=parts.map(p=>Math.hypot(p.points[1].x-p.points[0].x,p.points[1].y-p.points[0].y));assert(Math.abs(lengths.reduce((x,y)=>x+y,0)-Math.hypot(b.x-a.x,b.y-a.y))<1e-6,'Wall light pieces cover the face exactly once');
 const project=p=>({x:p.x*Math.cos(angle)-p.y/.568*Math.sin(angle),y:p.x*Math.sin(angle)*.568+p.y*Math.cos(angle)});
 const wa={x:-100,y:0},wb={x:100,y:0},pa=project(wa),pb=project(wb),forward={x:Math.sin(angle)*10/.568,y:Math.cos(angle)*10};
 const front={x:forward.x,y:forward.y},back={x:-forward.x,y:-forward.y};
 const wall={wall:{a:wa,b:wb},sortY:Math.max(pa.y,pb.y),sortX:0,id:'wall'},u={entity:front,sortY:project(front).y,sortX:0,id:'front'},v={entity:back,sortY:project(back).y,sortX:0,id:'back'};
 const sorted=orderSurfaceActors([u,wall,v],project,p=>p).map(x=>x.id);
 assert(sorted.indexOf('wall')<sorted.indexOf('front'),'Back wall cannot cut off the unit');assert(sorted.indexOf('back')<sorted.indexOf('wall'),'Foreground wall still conceals units behind it');
}
const edgeFace={cap:false,points:[{x:32,y:-42,elevation:0},{x:32,y:42,elevation:0},{x:32,y:42,elevation:35},{x:32,y:-42,elevation:35}]};
assert(Math.abs(faceLightFragments(edgeFace).reduce((sum,f)=>sum+Math.hypot(f.points[1].x-f.points[0].x,f.points[1].y-f.points[0].y),0)-84)<1e-7,'Shared hex edges receive light once');
const units={caster:{x:1,y:2},target:{x:4,y:2}},lookup=id=>units[id];
const explosion={x:3,y:4,radiusHexes:2,started:100,duration:800};
let lights=spellEffectLightSources({fireballExplosionFx:explosion},500,lookup);assert.equal(lights.length,1);assert.equal(lights[0].x,3);assert(lights[0].intensity>2);assert.equal(spellEffectLightSources({fireballExplosionFx:explosion},901,lookup).length,0);
const projectileFx={kind:'fireball',lightPath:{from:units.caster,to:units.target},t:.5};lights=spellEffectLightSources({projectileFx},500,lookup);assert.equal(lights[0].x,2.5);assert.equal(lights[0].y,2);assert.equal(spellEffectLightSources({projectileFx:{...projectileFx,kind:'arrow'}},500,lookup).length,0);
for(const kind of ['fireball','flame-arrow','acid-arrow','magic-missile'])assert(spellEffectLightSources({projectileFx:{...projectileFx,kind}},500,lookup).length);
const fx={started:100,duration:800,unitId:'target'};
for(const key of ['castingGlowFx','fireDamageFx','magicEffectFx'])assert(spellEffectLightSources({[key]:[fx]},500,lookup).length);
for(const key of ['dragonBreathFx','colorSprayFx'])assert(spellEffectLightSources({[key]:{...fx,cells:[units.target]}},500,lookup).length);
assert(spellEffectLightSources({lightningFx:{...fx,points:[units.caster,units.target]}},500,lookup).length);
assert(spellEffectLightSources({shockingGraspFx:{...fx,casterId:'caster',targetId:'target'}},500,lookup).length);
const sphere={id:'sphere',type:'flaming-sphere',cells:[{x:1,y:1}]};lights=spellEffectLightSources({areaEffects:[sphere]},500,lookup);sphere.cells=[{x:9,y:2}];assert.equal(spellEffectLightSources({areaEffects:[sphere]},600,lookup)[0].x,9);assert.equal(spellEffectLightSources({},600,lookup).length,0);
assert(spellSurfaceRadiance({x:1,y:1},lights,()=>1)[0]>0);assert.deepEqual(spellSurfaceRadiance({x:1,y:1},lights,()=>0),[0,0,0]);
console.log('PASS split-hex floor coverage/slivers/cache, wall hex segmentation, six-angle unit/wall depth, luminous spell families, world projectile paths, mobile sphere and expired flashes');
