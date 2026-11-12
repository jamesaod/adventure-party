import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as T from '../assets/vendor/three/three.module.min.js';
import {captureDirectUnit,sampleDirectPose,settledCorpseImage,corpseSnowAmount} from '../js/combat-direct-units.mjs';
import {shadowGeometryFor,registerShadowGeometry} from '../js/combat-shadow-geometry.mjs';
import {snapshotGpuCaster} from '../js/combat-gpu-casters.mjs';
import {createUnitImageCache} from '../js/combat-unit-image-cache.mjs';
import {advanceCorpseSnow,resetCorpseSnow,meltCorpseSnow} from '../js/combat-corpse-snow.mjs';
import {extractCombatFunction} from './combat-test-source.mjs';
// A lethal result precedes the queued death beat: neither cache nor timestamp exists.
for(const pending of [undefined,null,{alive:true},{alive:false},{alive:false,deathPresentationStartedAt:0}])assert.equal(corpseSnowAmount(pending),0,'Uncached or pending death must not abort model rendering');
const body=new T.SphereGeometry(1,48,32),lod=new T.BoxGeometry(1,2,1);
for(const g of [body,lod]){const count=g.attributes.position.count;g.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Array(count*4).fill(0),4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(Array.from({length:count*4},(_,i)=>i%4===0?1:0),4));}
const mesh=new T.SkinnedMesh(body,new T.MeshStandardMaterial()),bone=new T.Bone();mesh.add(bone);mesh.bind(new T.Skeleton([bone]));bone.position.set(.4,.2,0);mesh.position.x=2;
registerShadowGeometry(body,lod);const group=new T.Group();group.add(mesh);
const camera=new T.OrthographicCamera(-5,5,5,-5,.1,30);camera.position.z=10;camera.updateMatrixWorld();
const baked=captureDirectUnit(group,camera,{shareTextures:true}),bakedBody=baked.group.children[0].geometry,bakedShadow=shadowGeometryFor(bakedBody);
assert.notEqual(bakedBody,bakedShadow);assert.equal(bakedShadow.index.count,lod.index.count);
assert.equal(bakedShadow.attributes.skinIndex,undefined);
assert(Math.abs(bakedShadow.attributes.position.getX(0)-(lod.attributes.position.getX(0)+2.4))<1e-6);
assert.equal(mesh.geometry,body);assert.equal(shadowGeometryFor(body),lod);assert.equal(lod.attributes.position.getX(0),.5,'Never mutate shared live LOD vertices');
const count=s=>s.parts.reduce((n,p)=>n+p.groups.reduce((sum,g)=>sum+g.count/3,0),0);
assert.equal(count(snapshotGpuCaster(group,camera)),12);
assert.equal(count(snapshotGpuCaster(baked.group,baked.camera)),12,'Final corpse must retain the live shadow triangle budget');
console.log('PASS skinned final-pose shadow LOD: '+body.index.count/3+' body triangles, 12 shadow triangles before/after death');

let disposed=0,created=0;const cache=createUnitImageCache((w,h,s)=>({id:++created,dispose(){disposed++;}}),{maxBytes:1600,maxEntries:2});
const a={},b={},c={};let image=cache.get(a,'view1',10,10,0);assert(!image.ready);image.ready=true;
assert.equal(cache.get(a,'view1',10,10,0),image);assert(image.ready);
assert.equal(cache.get(a,'view2',10,10,0),image);assert(!image.ready,'Lighting/view changes require rendering again');
image.ready=true;cache.get(b,'view1',10,10,0);cache.get(a,'view2',10,10,0);cache.get(c,'view1',10,10,0);
assert.equal(disposed,1);assert.equal(cache.stats().entries,2);assert(cache.stats().bytes<=1600);
assert.notEqual(cache.get(b,'view1',10,10,0).target.id,2,'Least recently used image was evicted');
assert.equal(cache.get({},'huge',1000,1000,2),null,'Oversize image uses uncached rendering');
cache.clear();assert.equal(cache.stats().bytes,0);assert.equal(disposed,created);
console.log('PASS retained images: reuse, invalidation, LRU eviction, byte/count bounds and disposal');

let samples=0;const source={...baked,workshopSample(){samples++;return false;}},frame={asset:source,yaw:0};
const entity={alive:false,deathPresentationStartedAt:1,x:1,y:2};globalThis.adventurePartyCorpseProgress=()=>1;
const options={entity,x:100,y:200,width:100,height:150,anchor:{x:.5,y:.8},solar:{sky:1,daylight:1,direction:{x:1,y:1,z:0}},ambientPercent:150,outdoor:true,localLights:[],opacity:1,saturation:1};
assert.equal(settledCorpseImage(frame,options),null);const frozen=sampleDirectPose(frame,entity);assert.equal(frozen.asset.group.children[0].geometry.attributes.corpseSnowExposure,undefined,"Bare corpses defer snow-exposure baking");const first=settledCorpseImage(frame,options);assert(first);
for(let i=0;i<100;i++)sampleDirectPose(frame,entity);assert.equal(samples,1);
for(const change of [{x:101},{pixelsPerMetre:40},{width:200},{rotation:1},{opacity:.5},{saturation:.5},{outdoor:false},{ambientPercent:50},{solar:{...options.solar,daylight:.2}},{localLights:[{position:[1,2,3],color:[1,0,0],range:4,intensity:2}]},{snowGroundLight:[.8,.9,1]}])assert.notEqual(settledCorpseImage(frame,{...options,...change}).key,first.key);
advanceCorpseSnow(new Set(['1,2']),.3);assert.equal(corpseSnowAmount(entity),.3);assert.notEqual(settledCorpseImage(frame,options).key,first.key);
meltCorpseSnow(['1,2'],1);assert.equal(corpseSnowAmount(entity),0);assert.equal(settledCorpseImage(frame,options).key,first.key);
entity.alive=true;assert.equal(settledCorpseImage(frame,options),null);assert.equal(corpseSnowAmount(entity),0);entity.alive=false;entity.deathPresentationStartedAt=2;assert.equal(settledCorpseImage(frame,options),null);resetCorpseSnow(true);
console.log('PASS settled image invalidation for camera, lighting, snow/melt, resurrection and replacement death');

let snow=0,exposures=0;const context={globalThis:{adventurePartyDirectUnits:{corpseSnowAmount:()=>snow,draw:()=>true}},combatSceneTerrain:{},combatGpu:{},explorationGpuLighting:{},combatSceneContext:{openDoors:[]},battlefieldRotation:0,COMBAT_UNIT_AMBIENT_MULTIPLIER:1.5,
combatShadowScale:()=>[1,1,1],worldPointForHex:()=>({x:0,y:0}),prepareCombatProjectedShadows:{sources:[]},explorationGpuPoint:()=>[0,0,0],explorationVisualLights:()=>[],explorationSurfaceExposure:()=>{exposures++;return {multiply:[1,1,1],boost:[0,0,0]};},explorationVisibilityAtHex:()=>1,getUnitEffect:()=>null,requestDirectMotionFrame(){},isIndoorWorldPoint:()=>false,combatRenderAmbientAtHex:()=>100};
vm.createContext(context);vm.runInContext(extractCombatFunction(readFileSync('js/combat-lighting-services.js','utf8'),'drawDirectCombatUnit'),context);
for(let i=0;i<50;i++)context.drawDirectCombatUnit({},entity,{x:0,y:0},100,100,{x:.5,y:1},1);
assert.equal(exposures,0,'Bare corpses must not calculate terrain snow lighting');snow=.1;context.drawDirectCombatUnit({},entity,{x:0,y:0},100,100,{x:.5,y:1},1);assert.equal(exposures,1,'Snow-covered corpses still track current light');
console.log('PASS no snow-lighting work for bare corpses; covered bodies retain dynamic lighting');
