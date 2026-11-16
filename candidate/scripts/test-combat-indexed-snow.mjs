import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/three.module.min.js';
import {updateSurfaceBuffers} from '../js/combat-render-cache.mjs';
const f={points:[{x:0,y:0,elevation:3},{x:16,y:0,elevation:5},{x:16,y:16,elevation:7},{x:0,y:16,elevation:4}],snowEligible:1,uv:[[0,0],[1,0],[1,1],[0,1]],visibility:.5,multiply:[.2,.3,.4],lightPoints:[[1,2,3],[2,3,4],[3,4,5],[4,5,6]]};
const a=new T.BufferGeometry(),b=new T.BufferGeometry();
for(const d of [8,4,1,8])for(const shift of [0,3]){const faces=[structuredClone(f),{...structuredClone(f),snowEligible:0}];for(const face of faces)for(const p of face.points)p.x+=shift;
updateSurfaceBuffers(a,faces,T,()=>{},false,d);updateSurfaceBuffers(b,faces,T,()=>{},false,d,d>1);
for(const [name,attr] of Object.entries(a.attributes)){const other=b.attributes[name];for(let i=0;i<attr.count;i++)for(let k=0;k<attr.itemSize;k++){const index=b.index?b.index.getX(i):i;assert(Math.abs(attr.array[i*attr.itemSize+k]-other.array[index*attr.itemSize+k])<1e-6,`${name} at ${i}`);}}
if(d===8)assert(b.attributes.position.count<a.attributes.position.count/3);
const index=b.index;updateSurfaceBuffers(b,faces,T,()=>{},false,d,d>1);assert.equal(b.index,index,'Retain unchanged index topology');}
a.dispose();b.dispose();console.log('PASS indexed snow matches original triangles and every vertex attribute across depth, pan and indoor boundaries');
