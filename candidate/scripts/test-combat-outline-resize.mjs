import assert from 'node:assert/strict';
import {createGpuOutline} from '../js/combat-gpu-outline.mjs';
import {readFileSync} from 'node:fs';
let current=null,allocations=0,uploads=0;const sizes=new WeakMap();
const renderer={getRenderTarget:()=>current,setRenderTarget:t=>{current=t;},getClearColor:c=>c,getClearAlpha:()=>0,setClearColor(){},clear(){},render(scene){const t=scene.children[0].material.uniforms.occlusion.value;if(!sizes.has(t)){sizes.set(t,[t.image.width,t.image.height]);allocations++;t.addEventListener('dispose',()=>sizes.delete(t));}assert.deepEqual(sizes.get(t),[t.image.width,t.image.height],'GPU storage must match incoming mask');uploads++;}};
const pass=createGpuOutline(renderer,()=>{},()=>({width:256,height:256,zoom:1,anchor:{x:0,y:0}}),()=>{}),mask={width:16,height:16};
for(const [w,h] of [[16,16],[128,64],[128,64],[32,200],[8,8],[256,256]]){mask.width=w;mask.height=h;pass.draw(()=>{}, {mask,left:0,top:0,color:'#ffffff',active:true,daylight:1});}
assert.equal(uploads,6);assert.equal(allocations,5,'Same-size frames reuse GPU storage');pass.dispose();
const id='dungeon-crawler-carl-v2-ual2-sword-test';const library=JSON.parse(readFileSync('assets/animations/actions/'+id+'.json'));assert.equal(library.modelId,id);assert.deepEqual(library.entries,[]);
console.log('PASS outline storage follows reused mask dimensions; same-size frames reuse allocation; Carl optional action library exists');
