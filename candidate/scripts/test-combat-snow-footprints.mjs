import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {sampleSnowFootfalls,setFootprintCells,snowFootprints,clearSnowFootprints,meltFootprints,createFootprintLayer} from '../js/combat-snow-footprints.mjs';
import {SNOW_LAYER_METRES,SNOW_MAX_METRES,snowDepthMetres} from '../js/combat-snow-depth.mjs';
import {surfaceVertexCount,updateSurfaceBuffers} from '../js/combat-render-cache.mjs';
for(const [coats,inches] of [[[0,0,0],0],[[.34,0,0],6],[[.34,.34,0],12],[[.34,.34,1],18]])assert(Math.abs(snowDepthMetres(coats)-inches*.0254)<1e-10);
const group=new THREE.Group(),foot=new THREE.Bone(),other=new THREE.Bone(),toe=new THREE.Bone();foot.name='mixamorigLeftFoot';other.name='mixamorigRightFoot';toe.position.x=.2;foot.add(toe);group.add(foot,other);other.position.y=.1;
const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,100);camera.position.set(0,4,4);camera.lookAt(0,0,0);camera.updateMatrixWorld();
let depth=SNOW_LAYER_METRES;
setFootprintCells(new Map([['a',{key:'a',amount:1,triangles:[{a:{x:-1000,y:-1000},b:{x:1000,y:-1000},c:{x:0,y:1000}}]}]]),()=>depth);
const entity={alive:true},options={x:0,y:0,width:200,height:200,anchor:{x:.5,y:.5},pixelsPerMetre:100,groundMetresScale:[100,70.71],modelUnitsPerMetre:1},view={matrix:[1,0,0,1,0,0]};
function sample(t,h,x=0){foot.position.y=h;group.updateMatrixWorld(true);sampleSnowFootfalls(group,entity,{...options,x,walkSeconds:t},view,camera);}
clearSnowFootprints();sample(0,.1);const initial=snowFootprints.length;assert.equal(initial,2,'Both planted feet contact snow immediately');
sample(.03,.1,12);assert(snowFootprints.length>initial);assert(snowFootprints.some(f=>f.fromX!==f.x),'Dragging sweeps continuous segments');
const n=snowFootprints.length;sample(.03,.1,12);assert.equal(snowFootprints.length,n,'Duplicate render passes do not add tracks');
sample(.06,.5,24);const raised=snowFootprints.length;sample(.09,.5,36);assert(snowFootprints.slice(raised).every(f=>f.depth<=1),'Lifted foot leaves only the other planted foot trail');
// Isolate lifted-foot detection with the second foot removed from sampling.
other.name='not-a-foot';const solo=new THREE.Group();solo.add(foot);foot.position.y=.1;sampleSnowFootfalls(solo,entity,{...options,walkSeconds:0},view,camera);foot.position.y=.5;solo.updateMatrixWorld(true);const beforeLift=snowFootprints.length;sampleSnowFootfalls(solo,entity,{...options,walkSeconds:.03},view,camera);assert.equal(snowFootprints.length,beforeLift);
const beforeReset=snowFootprints.length;foot.position.y=.1;solo.updateMatrixWorld(true);sampleSnowFootfalls(solo,entity,{...options,x:100,walkSeconds:0},view,camera);assert.equal(snowFootprints.length,beforeReset+1);assert.equal(snowFootprints.at(-1).fromX,snowFootprints.at(-1).x,'Restart/teleport cannot bridge the gap');
const previous=snowFootprints[0].depth;meltFootprints(['other'],1);assert.equal(snowFootprints[0].depth,previous);meltFootprints(['a'],.5);assert.equal(snowFootprints[0].depth,previous*.5);
let target=null,drawn=0;const renderer={getRenderTarget:()=>target,setRenderTarget:v=>{target=v;},getClearColor:c=>c,getClearAlpha:()=>0,setClearColor(){},clear(){},render(){drawn++;}};
const layer=createFootprintLayer(renderer,new THREE.Vector4(-1000,-1000,2000,2000));layer.update(0);assert(layer.hasHex('a'));assert(drawn>0);const cut=snowFootprints[0].depth;layer.update(.1);assert(snowFootprints[0].depth<cut,'Snowfall refills depressions');layer.update(3);assert(!layer.hasHex('a'));layer.dispose();
const face={points:[{x:0,y:0},{x:64,y:0},{x:0,y:42}],snowEligible:1,snowTrackDetail:16};assert.equal(surfaceVertexCount([face],4),3*16);const geom=new THREE.BufferGeometry();updateSurfaceBuffers(geom,[face],THREE,()=>{},false,4);assert.equal(geom.attributes.position.count,3*16);face.snowTrackDetail=0;updateSurfaceBuffers(geom,[face],THREE,()=>{},false,4);assert.equal(geom.attributes.position.count,3*16);geom.dispose();
entity.alive=false;const end=snowFootprints.length;sample(.2,.1);assert.equal(snowFootprints.length,end);clearSnowFootprints();assert.equal(snowFootprints.length,0);
console.log('PASS 6/12/18-inch depths, planted/dragging/lifted feet, no teleport rails, duplicates, melt/refill, bounded track mesh and death exclusion');

// Stationary animation and pivots use the presentation clock, not walk time.
clearSnowFootprints();entity.alive=true;solo.rotation.y=0;foot.position.y=.1;solo.updateMatrixWorld(true);
const pose=t=>sampleSnowFootfalls(solo,entity,{...options,poseSeconds:t},view,camera);
pose(1);const still=snowFootprints.length;pose(1.03);assert.equal(snowFootprints.length,still,'Idle redraw does not accumulate records');
solo.rotation.y=Math.PI/2;solo.updateMatrixWorld(true);pose(1.06);
assert(snowFootprints.length>still+3,'Pivot stamps intermediate boot angles without walkSeconds');
assert(new Set(snowFootprints.slice(still).map(f=>f.angle)).size>3);
foot.position.x=.15;solo.updateMatrixWorld(true);pose(1.09);assert(snowFootprints.some(f=>f.x!==f.fromX||f.y!==f.fromY),'Animation slides carve troughs');
foot.position.y=.6;solo.updateMatrixWorld(true);const airborne=snowFootprints.length;pose(1.12);assert.equal(snowFootprints.length,airborne);
clearSnowFootprints();console.log('PASS nonwalking pivots, animation slides, idle deduplication and airborne exclusion');

const baked=new THREE.Group();for(const x of [-.1,.1]){const boot=new THREE.Mesh(new THREE.BoxGeometry(.1,.15,.25));boot.position.set(x,.075,0);baked.add(boot);}baked.updateMatrixWorld(true);
sampleSnowFootfalls(baked,entity,{...options,poseSeconds:2},view,camera);const bakedCount=snowFootprints.length;assert.equal(bakedCount,2,'Prepared meshes recover two sole contacts');baked.rotation.y=.7;baked.updateMatrixWorld(true);sampleSnowFootfalls(baked,entity,{...options,poseSeconds:2.03},view,camera);assert(snowFootprints.length>bakedCount);clearSnowFootprints();
console.log('PASS baked standing pose pivot contacts');

let sounds=[];globalThis.adventurePartySnowStep=v=>sounds.push(v);clearSnowFootprints();solo.rotation.y=0;foot.position.set(0,.1,0);solo.updateMatrixWorld(true);depth=SNOW_MAX_METRES;
const contactSample=(t,y)=>{foot.position.y=y;solo.updateMatrixWorld(true);sampleSnowFootfalls(solo,entity,{...options,poseSeconds:t},view,camera);};
contactSample(3,.1);assert.equal(sounds.length,0);contactSample(3.03,.3);contactSample(3.06,.1);assert.deepEqual(sounds,[1]);contactSample(3.09,.1);assert.equal(sounds.length,1);
depth=SNOW_LAYER_METRES;contactSample(3.12,.3);contactSample(3.15,.1);assert(Math.abs(sounds[1]-1/3)<1e-8);
depth=0;contactSample(3.18,.3);contactSample(3.21,.1);assert.equal(sounds.length,2);delete globalThis.adventurePartySnowStep;clearSnowFootprints();console.log('PASS snow-only sole-plant audio, idle suppression and contact-depth scaling');
