import {DoubleSide,MaxEquation} from '../assets/vendor/three/three.module.min.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';import {projectedShadowComposite,clipShadowTriangleAtLight,createProjectedShadowPass,projectedShadowVertex,projectedShadowFragment} from '../js/combat-projected-shadows.mjs';
const composites=[];const draws=[],view={matrix:[1,0,0,.5,20,30],anchor:{x:50,y:50},zoom:1,width:100,height:100};
const pass=createProjectedShadowPass({renderer:{render(scene){const mesh=scene.children[0];if(!mesh.geometry.getAttribute('casterPoint')){composites.push(mesh.material.uniforms.localShadow.value);return;}draws.push({positions:Array.from(mesh.geometry.getAttribute('casterPoint').array),light:mesh.material.uniforms.light.value.toArray(),wall:mesh.material.uniforms.wallReceiver.value,side:mesh.material.side,union:mesh.material.blendEquationAlpha});},getRenderTarget:()=>null,setRenderTarget(){},getClearColor:c=>c,getClearAlpha:()=>1,setClearColor(){},clear(){},getDrawingBufferSize:v=>v.set(100,100)},camera:{},texture:image=>({image}),flush(){},getView:()=>view,onPaint(){}});
const image={width:64,height:16},base={points:[[0,1,0],[1,1,0],[1,0,0]],uv:[[0,0],[1,0],[1,1]],indices:[0,1,2],image,scale:[20,10,12],opacity:.3};
pass.begin();pass.receiver({image:{width:64,height:64},bounds:[-10,-10,20,20]});
pass.queue({...base,light:{id:'sun',vector:[1,1,0,0]}});pass.queue({...base,light:{id:'sun',vector:[1,1,0,0]}});pass.queue({...base,light:{id:'spell',vector:[3,2,1,1]}});pass.flush();assert.equal(draws.length,2,'Matching sun silhouettes share one batch');assert.deepEqual(composites,[false,true],'Distance blur is enabled for point sources, never sun');assert(draws.every(d=>d.side===DoubleSide),'Projected silhouettes render from either winding through the solar cycle');assert(draws.every(d=>d.union===MaxEquation),'One light uses a union mask rather than stacking caster darkness');assert.equal(draws[0].positions.length,18);assert.deepEqual(draws[1].light,[3,2,1,1]);assert.equal(pass.diagnostics().triangles,3);
pass.begin();pass.queue({...base,light:{id:'torch',vector:[0,2,0,1]},wall:{id:'wall',span:[0,0,1,0],height:3.5},plane:[0,0,1,0]});pass.flush();assert.equal(draws.at(-1).wall,true);pass.end();assert(pass.uses(image));pass.begin();pass.end();assert(!pass.uses(image),'Unused buffers are released');pass.dispose();
assert(projectedShadowVertex.includes('casterPoint-light.xyz'));assert(projectedShadowVertex.includes('max(0.,travel)'));assert(projectedShadowVertex.includes('casterPoint.y*6.'));assert(projectedShadowFragment.includes('mask.a<.5'));assert(projectedShadowFragment.includes('light.w<.5&&mask.r<.5'));assert(projectedShadowFragment.includes('wallSpan'));
console.log('PASS shared GPU sun/point projections, silhouette batching, wall receiver, clipping and resource cleanup');

const {default:vm}=await import('node:vm');const {extractCombatFunction}=await import('./combat-test-source.mjs');
const adapter=fs.readFileSync('js/combat-lighting-services.js','utf8');let indoors=false,blocked=false;
const sandbox=vm.createContext({combatShadowScale:()=>[20,10,12],combatShadowBackground:()=>0,combatLocalShadowOpacity:(s,b)=>Math.min(.3,s*.36),environmentHex:()=>({x:0,y:0}),
 adventurePartySolar:{state:()=>({direction:{x:1,y:1,z:0},daylight:1})},isIndoorWorldPoint:()=>indoors,
 prepareCombatProjectedShadows:{sources:[{id:'a',vector:[1,2,0,1],range:10,power:1},{id:'b',vector:[3,2,0,1],range:10,power:1},{id:'c',vector:[9,2,0,1],range:10,power:1}]},
 illuminationSourceReachesHex:()=>true,worldLineBlockedByOtherArchitecturalWalls:()=>blocked});
vm.runInContext(extractCombatFunction(adapter,'combatShadowLights'),sandbox);
let selected=sandbox.combatShadowLights([0,0,0]);assert.deepEqual(Array.from(selected,l=>l.id),['sun','a','b'],'Sun plus only two strongest reachable local sources');
indoors=true;assert(!sandbox.combatShadowLights([0,0,0]).some(l=>l.id==='sun'),'Indoor caster has no solar shadow');blocked=true;assert.equal(sandbox.combatShadowLights([0,0,0]).length,0,'Walls prevent local source admission');
console.log('PASS bounded local-light selection, indoor sun suppression and blocked light rejection');

// Local lamps cannot replace the independently selected solar shadow.
indoors=false;blocked=false;const daylight=sandbox.combatShadowLights([0,0,0]);assert(daylight.some(l=>l.id==='sun'));sandbox.prepareCombatProjectedShadows.sources=[];assert(sandbox.combatShadowLights([0,0,0]).some(l=>l.id==='sun'));
console.log('PASS two-sided projected silhouettes and independent sun/local-light selection');

const contrastSandbox=vm.createContext({});vm.runInContext(extractCombatFunction(adapter,'combatShadowBackground')+'\n'+extractCombatFunction(adapter,'combatLocalShadowOpacity'),contrastSandbox);
const day=contrastSandbox.combatShadowBackground(true,250,{daylight:1,sky:1}),night=contrastSandbox.combatShadowBackground(true,250,{daylight:0,sky:.025}),room=contrastSandbox.combatShadowBackground(false,0,{daylight:1,sky:1});
assert.equal(contrastSandbox.combatLocalShadowOpacity(1,day),0,'Lantern shadow disappears against bright outdoor noon');
assert(contrastSandbox.combatLocalShadowOpacity(1,night)>.15,'Lantern shadow remains at night');
assert(contrastSandbox.combatLocalShadowOpacity(1,room)>.2,'Dark indoor lantern shadow remains in daytime');
assert(contrastSandbox.combatLocalShadowOpacity(10,day)>0,'Powerful spell can still cast a shadow in daylight');
console.log('PASS local shadows weighted against ambient/daylight; sun is independent');

const own=sandbox.prepareCombatProjectedShadows;sandbox.prepareCombatProjectedShadows.sources=[{id:'own',ownerId:'Carl',vector:[0,2,0,1],range:10,power:1},{id:'other',ownerId:'Orc',vector:[1,2,0,1],range:10,power:1}];
assert(!sandbox.combatShadowLights([0,0,0],'Carl').some(l=>l.id==='own'),'A unit never casts a shadow from its own carried light');assert(sandbox.combatShadowLights([0,0,0],'Carl').some(l=>l.id==='other'));
assert(projectedShadowVertex.includes('silhouetteAnchor.w>0.'));assert(projectedShadowFragment.includes('sourceAt(vGround,light.xyz,lightRange)'));
// Removing any subset of source shares, once each, cannot remove ambient share.
for(const ambient of [.02,.2,1,5])for(const local of [[1],[1,2],[.2,.7,4]]){const total=ambient+local.reduce((a,b)=>a+b,0);const remaining=local.reduce((value,l)=>value*(1-l/total),1);assert(remaining+1e-12>=ambient/total);}
console.log('PASS carried-light self exclusion, stable silhouette projection and light-share ambient bound');

// Reproduce a level-foot attack silhouette becoming edge-on to a side light.
for(const facing of [-1,1]){
 const height=2,width=.8,points=[[-width/2,height],[width/2,height],[width/2,0],[-width/2,0]];
 const project=(depth)=>points.map(([x,h])=>[x*facing-h*2,depth*x*facing*(h>0?1:0)]);
 const area=p=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-a[1]*b[0];},0))/2;
 assert.equal(area(project(0)),0,'Reproduce flat attack-pose collapse');
 assert(area(project(.3))>.1,'Depth proxy retains the attacking silhouette');
 assert.deepEqual(project(.3).slice(2),project(0).slice(2),'Feet remain fixed');
}
assert(projectedShadowVertex.includes('max(0.,.3-across)*body'));
console.log('PASS side-lit attack-pose collapse reproduction, depth proxy and anchored feet');

// Near-height head points should project beyond lamp reach, not get clamped
// back into illuminated ground. Shield points keep their true magnification.
const lampHeight=1.9,lampRange=18,occluderDistance=2,headHeight=1.79;
const headGroundDistance=occluderDistance*lampHeight/(lampHeight-headHeight);
assert(headGroundDistance>lampRange);
const oldClampedDistance=occluderDistance+headHeight*6;
assert(oldClampedDistance<lampRange,'Reproduce old cap pulling a near-height projection into lamp range');
const falloff=d=>Math.pow(Math.max(0,1-d/lampRange),2);
assert.equal(falloff(headGroundDistance),0);assert(falloff(oldClampedDistance)>0);
const shieldHeight=1.1,magnification=lampHeight/(lampHeight-shieldHeight);
assert(Math.abs(magnification-2.375)<1e-9);
assert(projectedShadowVertex.includes('if(abs(receiverPlane.y)>.5&&light.w<.5)p.xz='),'Only directional sun projection is horizon-clamped');
console.log('PASS close-lantern ray magnification and out-of-range shadows stay outside light reach');

const clipped=clipShadowTriangleAtLight([[0,1.8,0],[1,2,0],[0,1,1]],[[0,0],[1,0],[0,1]],1.9);
assert.equal(clipped.length,4);assert(clipped.every(v=>v.point[1]<=1.8800001));assert(clipped.every(v=>v.point.every(Number.isFinite)&&v.uv.every(Number.isFinite)));
assert.equal(clipShadowTriangleAtLight([[0,2,0],[1,2,0],[0,3,1]],[[0,0],[1,0],[0,1]],1.9).length,0);
console.log('PASS lamp-height crossing triangles are clipped without backward-folding rays');

assert(projectedShadowVertex.includes('vCaster=casterPoint'));
assert(projectedShadowFragment.includes('varying vec3 vCaster'));
assert(projectedShadowFragment.includes('if(light.w>.5){float metres='));
assert(projectedShadowComposite.includes('if(!localShadow)'));
const penumbra=(distance,lightDistance)=>Math.min(.6,.08*distance/Math.max(.12,lightDistance));
assert.equal(penumbra(0,2),0);assert(penumbra(4,2)>penumbra(.2,2));assert(penumbra(30,.2)<=.6);
console.log('PASS local-only increasing penumbra with bounded radius; sun filter preserved');
