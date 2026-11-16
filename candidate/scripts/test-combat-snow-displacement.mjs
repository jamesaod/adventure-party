import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {surfaceVertexCount,updateSurfaceBuffers} from '../js/combat-render-cache.mjs';
const floor={snowEligible:1,points:[{x:0,y:0,elevation:2},{x:16,y:0,elevation:2},{x:16,y:16,elevation:2},{x:0,y:16,elevation:2}],uv:[[0,0],[1,0],[1,1],[0,1]],lightPoints:[[0,0,0],[2,0,0],[2,0,2],[0,0,2]],lightWorld:[[0,0],[16,0],[16,16],[0,16]],multiply:[.3,.5,.7],sunLoss:[.1,0,0],visibility:.4};
const indoor={...floor,snowEligible:0},scatter={...floor,snowEligible:-1},g=new THREE.BufferGeometry();
assert.equal(surfaceVertexCount([floor,indoor,scatter],1),18);
assert.equal(surfaceVertexCount([floor,indoor,scatter],4),108,'Only outdoor floor receives the 16x refinement');
updateSurfaceBuffers(g,[floor],THREE,()=>{},false,4);
const p=g.attributes.position,u=g.attributes.uv,light=g.attributes.lightPoint;assert.equal(p.count,96);
let area=0;
for(let i=0;i<p.count;i++){
 const x=p.getX(i),y=p.getY(i);assert(x>=0&&x<=16&&y>=0&&y<=16);assert.equal(p.getZ(i),2);
 assert.equal(u.getX(i),x/16);assert.equal(u.getY(i),y/16);assert.equal(light.getX(i),x/8);assert.equal(light.getZ(i),y/8);
 assert.equal(g.attributes.surfaceSnow.getX(i),1);assert(Math.abs(g.attributes.surfaceVisibility.getX(i)-.4)<1e-6);
}
for(let i=0;i<p.count;i+=3){const ax=p.getX(i),ay=p.getY(i),bx=p.getX(i+1),by=p.getY(i+1),cx=p.getX(i+2),cy=p.getY(i+2);const a=((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))/2;assert(a>0);area+=a;}
assert.equal(area,256,'Refinement preserves floor area and winding');
const version=p.version;updateSurfaceBuffers(g,[structuredClone(floor)],THREE,()=>{},false,4);assert.equal(p.version,version,'Stable displaced surfaces reuse their buffers');
floor.uv[0][0]=.25;updateSurfaceBuffers(g,[floor],THREE,()=>{},false,4);assert.equal(p.version,version,'UV changes do not rebuild positions');assert.equal(g.attributes.uv.getX(0),.25);
updateSurfaceBuffers(g,[floor],THREE,()=>{},false,1);assert.equal(g.attributes.position.count,6,'Clear restores the ordinary mesh');
const h=new THREE.BufferGeometry();updateSurfaceBuffers(h,[floor],THREE,()=>{},true,4);assert.equal(h.attributes.position.count,6,'Shadow-only surfaces are not subdivided');
const q=new THREE.BufferGeometry();updateSurfaceBuffers(q,[floor,indoor],THREE,()=>{},false,4);const v=q.attributes.position.version;updateSurfaceBuffers(q,[indoor,floor],THREE,()=>{},false,4);assert(q.attributes.position.version>v,'Eligibility changes invalidate subdivision even at the same vertex count');
g.dispose();h.dispose();q.dispose();
console.log('PASS bounded outdoor displacement geometry, area/winding, interpolated UV/lighting, cache reuse, eligibility changes, shadow exclusion and reset.');
