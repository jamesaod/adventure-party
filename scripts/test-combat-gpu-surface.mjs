import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {createGpuSurface} from '../js/combat-gpu-surface.mjs';
import {updateSurfaceBuffers} from '../js/combat-render-cache.mjs';
const base={points:[{x:0,y:0,elevation:3},{x:16,y:0,elevation:5},{x:16,y:16,elevation:7},{x:0,y:16,elevation:4}],snowEligible:1,uv:[[0,0],[1,0],[1,1],[0,1]],visibility:.5,multiply:[.2,.3,.4],lightPoints:[[1,2,3],[2,3,4],[3,4,5],[4,5,6]],lightWorld:[[3,4],[5,6],[7,8],[9,10]],sunLoss:[.1,.2,.3],lightNormal:[.2,.8,.1],tint:[.6,.7,.8],boost:[.1,.2,.4],add:[.3,.1,.6]};
const gpu=createGpuSurface(),reference=new THREE.BufferGeometry();
const layout={position:[0,3],surfaceSnow:[3,1],uv:[4,2],lightSampleWorld:[6,2],lightPoint:[8,3],surfaceVisibility:[11,1]},constant={lightNormal:36,surfaceTint:40,surfaceSunLoss:44,surfaceMultiply:48,surfaceBoost:52,surfaceAdd:56};
for(const divisions of [4,8,1,8])for(const n of [1,20,2]){
 const faces=Array.from({length:n},(_,i)=>i%2?structuredClone(base):{points:structuredClone(base.points),snowEligible:1});
 const triangles=gpu.update(faces,divisions);updateSurfaceBuffers(reference,faces,THREE,()=>{},false,divisions,true);
 assert.equal(triangles*3,reference.index.count);
 const data=gpu.texture.image.data,g=gpu.geometry;
 for(let instance=0;instance<g.instanceCount;instance++)for(let t=0;t<g.index.count;t++){
  const j=g.index.getX(t),weights=[g.attributes.position.getX(j),g.attributes.position.getY(j),g.attributes.position.getZ(j)],expectedIndex=reference.index.getX(instance*g.index.count+t);
  for(const [name,a] of Object.entries(reference.attributes))for(let k=0;k<a.itemSize;k++){
   let actual;if(name in constant)actual=data[instance*64+constant[name]+k];else{const [offset]=layout[name];actual=name==='surfaceSnow'||name==='surfaceVisibility'?data[instance*64+offset+k]:weights.reduce((sum,w,c)=>sum+w*data[instance*64+c*12+offset+k],0);}
   assert(Math.abs(actual-a.array[expectedIndex*a.itemSize+k])<1e-5,`${name} ${instance}/${t}/${k}`);
  }
 }
 const version=gpu.texture.version,geometry=gpu.geometry;gpu.update(faces,divisions);assert.equal(gpu.texture.version,version);assert.equal(gpu.geometry,geometry);
 faces[0].points[0].x+=1;gpu.update(faces,divisions);assert(gpu.texture.version>version,'In-place mutation updates source texture');
}
gpu.dispose();reference.dispose();console.log('PASS GPU source expansion matches every refined terrain attribute; topology, texture growth/reuse, defaults and in-place mutations');
