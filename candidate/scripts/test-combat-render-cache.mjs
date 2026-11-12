import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {updateSurfaceBuffers,createTargetPool} from '../js/combat-render-cache.mjs';
import {triangulateSurfaces} from '../js/combat-webgl.mjs';
import {orderSurfaceActors} from '../js/combat-surface-lighting.mjs';
// Original exhaustive ordering retained as a regression oracle.
function reference(actors,project,unitPoint){
 const base=[...actors].sort((a,b)=>a.sortY-b.sortY||a.sortX-b.sortX),edges=base.map(()=>new Set()),degree=base.map(()=>0);
 const add=(a,b)=>{if(!edges[a].has(b)){edges[a].add(b);degree[b]++;}};
 for(let i=0;i<base.length;i++)if(base[i].wall)for(let j=0;j<base.length;j++)if(base[j].entity){
  const wall=base[i].wall,a=project(wall.a),b=project(wall.b),p=project(unitPoint(base[j].entity));
  if(p.x<Math.min(a.x,b.x)-24||p.x>Math.max(a.x,b.x)+24)continue;
  if(Math.abs(b.x-a.x)<.01)continue;
  const t=Math.max(0,Math.min(1,(p.x-a.x)/(b.x-a.x))),y=a.y+(b.y-a.y)*t;
  if(Math.abs(p.y-y)>120)continue;
  if(p.y>=y-.01)add(i,j);else add(j,i);
 }
 const done=new Set(),result=[];
 while(result.length<base.length){let i=base.findIndex((_,j)=>!done.has(j)&&degree[j]===0);if(i<0)i=base.findIndex((_,j)=>!done.has(j));done.add(i);result.push(base[i]);for(const j of edges[i])degree[j]--;}
 return result;
}

const f={points:[{x:0,y:0},{x:5,y:0},{x:4,y:3},{x:0,y:2}],multiply:[.5,.7,.8]},g=new THREE.BufferGeometry();
updateSurfaceBuffers(g,[f],THREE);const pos=g.attributes.position,version=pos.version;
updateSurfaceBuffers(g,[structuredClone(f)],THREE);assert.equal(pos.version,version);
f.multiply[0]=.6;updateSurfaceBuffers(g,[f],THREE);assert.equal(pos.version,version);assert.equal(g.attributes.surfaceMultiply.version,2);
f.points[0].x=2;updateSurfaceBuffers(g,[f],THREE);assert.equal(pos.version,version+1);
assert.deepEqual([...pos.array],triangulateSurfaces([f]).position);
let disposed=0;const pool=createTargetPool((w,h,s)=>({w,h,s,dispose(){disposed++;}}),{limit:2});
const first=pool.get(33,35,2);assert.equal(pool.get(40,40,2),first);pool.get(80,80,2);pool.get(40,40,2);pool.get(120,120,2);assert.equal(pool.get(40,40,2),first);assert.equal(disposed,1);pool.dispose();assert.equal(disposed,3);
let seed=71;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
for(let trial=0;trial<100;trial++){const actors=Array.from({length:100},(_,i)=>({id:i,sortX:random()*1000,sortY:random()*1000,...(i%3?{entity:{x:random()*1000,y:random()*1000}}:{wall:{a:{x:random()*1000,y:random()*1000},b:{x:random()*1000,y:random()*1000}}})}));assert.deepEqual(orderSurfaceActors(actors,p=>p,p=>p).map(a=>a.id),reference(actors,p=>p,p=>p).map(a=>a.id));}
console.log('PASS terrain mutation/cache, rounded LRU target lifecycle, and 100 randomized ordering comparisons');

const shadowGeometry=new THREE.BufferGeometry();
updateSurfaceBuffers(shadowGeometry,[f],THREE,()=>{},true);
assert.deepEqual(Object.keys(shadowGeometry.attributes).sort(),['position','uv']);
assert.deepEqual([...shadowGeometry.attributes.position.array],triangulateSurfaces([f]).position);
const sv=shadowGeometry.attributes.position.version;
updateSurfaceBuffers(shadowGeometry,[f],THREE,()=>{},true);
assert.equal(shadowGeometry.attributes.position.version,sv);
f.points[0].y+=1;updateSurfaceBuffers(shadowGeometry,[f],THREE,()=>{},true);
assert.equal(shadowGeometry.attributes.position.version,sv+1);
console.log('PASS shadow-only buffers retain geometry and mutation detection without lighting attributes');
