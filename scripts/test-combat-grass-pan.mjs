import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {createGroundCover,coverPlacements,GROUND_COVER_DEFAULTS} from '../js/combat-ground-cover.mjs?v=tree-snow-grains1';
globalThis.matchMedia=()=>({matches:true});
// This is a CPU layout test; image loading is exercised by the browser probe.
THREE.TextureLoader.prototype.load=()=>new THREE.Texture();
const snow={texture:null,footprintTexture:null,bounds:new THREE.Vector4(-1000,-1000,2000,2000)},drawn=[],versions=[];
const cover=createGroundCover({snow,texture:t=>t,flush(){},markBackdrop(){},paint(mesh){const u=mesh.material.uniforms,data=u.instances.value.image.data,start=u.instanceStart.value;versions.push(u.instances.value.version);for(let n=start;n<start+mesh.geometry.instanceCount;n++)drawn.push({x:data[n*8],y:data[n*8+1],seed:data[n*8+4],type:u.canopyBlade.value?3:u.kind.value});}});
const face=(left,right)=>({grass:true,snowEligible:1,grassUnit:10,grassSquash:1,visibility:1,points:[{x:left,y:-30},{x:right,y:-30},{x:right,y:180},{x:left,y:180}]}),center=face(-60,230),offscreen=face(300,320);
const visible=(p,v)=>{const [a,b,c,d,tx,ty]=v.matrix,x=v.anchor.x+(a*p.x+c*p.y+tx-v.anchor.x)*v.zoom,y=v.anchor.y+(b*p.x+d*p.y+ty-v.anchor.y)*v.zoom;return x>=-35&&x<=v.width+35&&y>=-15&&y<=v.height+40;};
const key=p=>[Math.fround(p.x),Math.fround(p.y),Math.fround(p.seed),p.type].join(',');
function frame(faces,tx=0,ty=0,zoom=1){const v={width:160,height:150,anchor:{x:80,y:75},zoom,matrix:[1,0,0,1,tx,ty]};drawn.length=0;versions.length=0;cover.begin(v);cover.collect(faces,{});cover.prepare();for(const limit of [25,70,120,Infinity]){const start=drawn.length;cover.drawUntil(limit);for(const p of drawn.slice(start))assert(p.y+ty<=limit+.0001,'Depth interval follows camera translation');}const expected=faces.flatMap(f=>coverPlacements(f,GROUND_COVER_DEFAULTS)).filter(p=>(p.type!==2||p.seed<=.3)&&visible(p,v)).map(key).sort(),actual=drawn.filter(p=>visible(p,v)).map(key).sort();assert.deepEqual(actual,expected,'GPU clipping must preserve the old visible population');return {reused:cover.diagnostics().layoutReused,versions:[...versions]};}
frame([center]);assert(frame([center],5,3).reused);assert(frame([center],10,5,.9).reused);assert(frame([center,offscreen],10,5,.9).reused,'Offscreen collection changes retain buffers');
center.visibility=.4;assert(!frame([center],10,5,.9).reused,'In-place visibility changes invalidate');
const before=frame([center],10,5,.9);const after=frame([center],12,7,.9);assert(after.reused);assert.deepEqual(after.versions,before.versions,'Panning uploads no new root texture');
assert(!frame([center,offscreen],-150,0).reused,'Newly visible terrain must enter the buffer');
center.points[0].x-=1;assert(!frame([center,offscreen],-150,0).reused,'In-place geometry changes invalidate');
function crownFrame(noise=0){cover.begin({width:160,height:150,anchor:{x:80,y:75},zoom:1,matrix:[1,0,0,1,5,3]});cover.collect([center],{});cover.prepare([],[],[{x:1000+noise,y:2000+noise,sortY:2000+noise,rx:1,ry:1}]);cover.drawUntil();return cover.diagnostics().layoutReused;}
assert(!crownFrame());assert(crownFrame(1e-12),'Subpixel cancellation must not rebuild buffers');assert(!crownFrame(.01),'Actual crown movement must invalidate');
const deposits=[{x:10,y:20,seed:.2,type:4,field:999999,key:'fallen-leaf:0'},{x:20,y:80,seed:.7,type:4,field:999999,key:'fallen-leaf:1'}];
cover.begin({width:160,height:150,anchor:{x:80,y:75},zoom:1,matrix:[1,0,0,1,0,0]});cover.collect([center],{});cover.prepare([],[],[],[],deposits);drawn.length=0;cover.drawUntil(-1e9);assert.equal(drawn.length,2,'All ground litter renders before the first actor, regardless of depth');assert(drawn.every(p=>p.type===4),'No raised cover drawn ahead of its depth interval');
cover.dispose();
console.log('PASS resident grass buffers, GPU clip population, camera depth intervals, offscreen collection, visibility and geometry invalidation');

