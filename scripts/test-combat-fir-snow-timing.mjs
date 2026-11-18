import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/three.module.min.js';
import {firSnowOpacity,createFirSnowCaps} from '../js/combat-fir-snow.mjs?v=natural-ac1';
import {createSnowCoatCoverage} from '../js/combat-snow-coats.mjs?v=natural-ac1';
assert.equal(firSnowOpacity(0),0);assert.equal(firSnowOpacity(1),.62);assert(firSnowOpacity(1.999)<1);assert.equal(firSnowOpacity(2),1);assert.equal(firSnowOpacity(3),1);
const ground=createSnowCoatCoverage(),a={x:0,y:0},b={x:16,y:0},c={x:16,y:16},d={x:0,y:16};ground.configure([0,0,16,16],16,16,new Map([['tree',{triangles:[{a,b,c},{a,c,b:d}]}]]));
let seed=12;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);let reached=false;
for(let i=0;i<20000;i++){
 ground.deposit({x:random()*16,y:random()*16},random);const amount=Math.floor(ground.progress/4*400)/400;
 if(ground.coverage.second<1)assert(firSnowOpacity(amount*4)<1,'Tree cannot become fully opaque before ground powder completes');
 else{assert.equal(firSnowOpacity(amount*4),1);reached=true;break;}
}assert(reached,'Ground and tree both reach full coverage');
ground.clear();assert.equal(firSnowOpacity(ground.progress),0);
globalThis.document={createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(32*32*4).fill(255)})})})};
const geometry=new T.PlaneGeometry(2,2);geometry.rotateX(-Math.PI/2);const map=new T.Texture({}),material=new T.MeshStandardMaterial({map,alphaTest:.1}),model=new T.Group();model.add(new T.Mesh(geometry,material));
const caps=createFirSnowCaps(model),shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <lights_fragment_begin>'};caps.mesh.children[0].material.onBeforeCompile(shader);
for(const [amount,expected] of [[0,0],[.25,.62],[.49999,firSnowOpacity(1.99)],[.5,1],[.25,.62],[0,0]]){caps.set(amount);assert(Math.abs(shader.uniforms.branchSnowOpacity.value-expected)<1e-9);assert.equal(caps.mesh.visible,amount>0);}
assert(shader.fragmentShader.includes('min(coverage,branchSnowOpacity)'));caps.dispose();geometry.dispose();material.dispose();map.dispose();
console.log('PASS actual ground deposition gates tree opacity, full powder synchronizes, clear/melt and branch material cap');
