import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {createGpuSurface} from '../js/combat-gpu-surface.mjs';
import {updateSurfaceBuffers} from '../js/combat-render-cache.mjs';
import {CombatPuddleEffects} from '../js/combat-puddle-effects.mjs';
const face=()=>({grass:true,snowEligible:1,visibility:1,points:[{x:0,y:0},{x:64,y:0},{x:64,y:64},{x:0,y:64}]});
const faces=[face()];faces._surfaceRevision=0;const gpu=createGpuSurface(),geometry=new THREE.BufferGeometry(),counts={};const count=k=>counts[k]=(counts[k]||0)+1;
gpu.update(faces,4,count);updateSurfaceBuffers(geometry,faces,THREE,count);const textureVersion=gpu.texture.version,positionVersion=geometry.attributes.position.version;
gpu.update(faces,4,count);updateSurfaceBuffers(geometry,faces,THREE,count);assert.equal(counts.surfaceRevisionReuses,2);assert.equal(gpu.texture.version,textureVersion);assert.equal(geometry.attributes.position.version,positionVersion);
faces[0].visibility=.3;faces._surfaceRevision++;gpu.update(faces,4,count);updateSurfaceBuffers(geometry,faces,THREE,count);assert(gpu.texture.version>textureVersion);assert(Math.abs(geometry.attributes.surfaceVisibility.array[0]-.3)<1e-6);
gpu.update(faces,8,count);assert.equal(gpu.geometry.instanceCount,2);assert.equal(gpu.geometry.index.count,8*8*3);
delete faces._surfaceRevision;faces[0].points[0].x=7;gpu.update(faces,8,count);updateSurfaceBuffers(geometry,faces,THREE,count);assert.equal(gpu.texture.image.data[0],7);assert.equal(geometry.attributes.position.array[0],7);gpu.dispose();geometry.dispose();
// Spatial lookup must agree with the full scan, including negative coordinates,
// cell boundaries, changing visibility, water level and incremental collection.
let level=.1;const config={elevation:()=>-.1,water:()=>level,permanent:()=>true,visible:f=>f.visibility>.1,waterAt:()=>({water:level,height:0})};
const indexed=new CombatPuddleEffects(config),plain=new CombatPuddleEffects(config),all=[];
for(let y=-4;y<4;y++)for(let x=-4;x<4;x++){const f=face();for(const p of f.points){p.x+=x*64;p.y+=y*64;}all.push(f);}
const owned=all.map((f,i)=>({...f,_groundKey:String(i)}));indexed.collect(owned);plain.collect(all);
for(let y=-255;y<256;y+=17)for(let x=-255;x<256;x+=19){assert.equal(!!indexed.sample(x,y),!!plain.sample(x,y));}
const grid=indexed.faceIndexes.get('faces').grid;indexed.begin(10,{});indexed.collect(owned);indexed.sample(5,5);assert.equal(indexed.faceIndexes.get('faces').grid,grid,'reuse unchanged index');
owned.forEach(f=>f.visibility=0);assert.equal(indexed.sample(5,5),null,'live visibility');owned.forEach(f=>f.visibility=1);level=0;assert.equal(indexed.sample(5,5),null,'live water');level=.1;
const extra={...face(),_groundKey:'extra'};for(const p of extra.points)p.x+=600;indexed.collect([extra]);assert(indexed.sample(620,20),'incremental collection rebuilds index');indexed.scene('next');assert.equal(indexed.sample(5,5),null,'scene reset');
console.log('PASS versioned buffer reuse/invalidation, unversioned edits, water spatial parity and scene reset');
