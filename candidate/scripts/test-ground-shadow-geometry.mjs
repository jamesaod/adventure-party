import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {groundShadowProjection,SHADOW_FLOOR_Y,createGroundShadowMaterial,renderGroundShadow} from '../js/ground-shadow-geometry.mjs';
import {sunPosition,drawUnitShadow,setGroundShadow} from '../js/unit-sun-shadow.mjs';
const projectShadowPoint=point=>new THREE.Vector3(point.x,Math.max(0,point.y),point.z).applyMatrix4(groundShadowProjection());
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
// Standing feet and a prone body can span any ground depth. At ground height,
// both horizontal coordinates must stay fixed, independent of facing/depth.
for(let facing=0;facing<6;facing++)for(const point of [
  [-1,0,-2],[1,0,2],[-2,0,1],[2,0,-1],[-1,.08,-2],[1,.08,2],[0,2,0]
]){
  const world=new THREE.Vector3(...point).applyAxisAngle(new THREE.Vector3(0,1,0),facing*Math.PI/3);
  const shadow=projectShadowPoint(world),sun=sunPosition(12);
  close(shadow.y,SHADOW_FLOOR_Y);
  close(shadow.x,world.x+sun.groundX*world.y);
  close(shadow.z,world.z+sun.groundZ*world.y);
  if(world.y===0){close(shadow.x,world.x);close(shadow.z,world.z);}
}
const lowA=projectShadowPoint({x:0,y:.05,z:-3}),lowB=projectShadowPoint({x:0,y:.05,z:3});
close(lowB.z-lowA.z,6); // A fallen body's depth must not collapse to a foot line.
close(projectShadowPoint({x:1,y:-.01,z:2}).z,2); // Do not invert below-floor vertices.
const material=createGroundShadowMaterial();
const shader={uniforms:{},vertexShader:THREE.ShaderLib.basic.vertexShader};material.onBeforeCompile(shader);
assert.ok(shader.vertexShader.indexOf('#include <skinning_vertex>')<shader.vertexShader.indexOf('vec4 floorVertex'));
assert.ok(shader.vertexShader.includes('modelMatrix * vec4(transformed, 1.0)'));
assert.ok(shader.vertexShader.includes('floorVertex.y = max(0.0, floorVertex.y)'));
assert.ok(shader.vertexShader.includes('viewMatrix * groundShadowProjection * floorVertex'));
assert.deepEqual(shader.uniforms.groundShadowProjection.value.elements,groundShadowProjection().elements);
const original={name:'body'},scene={overrideMaterial:original};let seen;
renderGroundShadow({render(s){seen=s.overrideMaterial;}},scene,{},material);
assert.equal(seen,material);assert.equal(scene.overrideMaterial,original);
assert.throws(()=>renderGroundShadow({render(){throw Error('render failed');}},scene,{},material));
assert.equal(scene.overrideMaterial,original,'A failed shadow pass must never leave model materials overridden');material.dispose();

// The projected sidecar uses exactly the body frame/anchor and is not sheared
// a second time. No source pixels or foot heuristics are needed on this path.
const source={width:160,height:200},shadow={width:80,height:100},draws=[],translations=[];
setGroundShadow(source,shadow);
const ctx={globalAlpha:1,save(){},restore(){this.globalAlpha=1;},translate(...v){translations.push(v);},scale(){},drawImage(...v){draws.push(v);},transform(){throw Error('Double projection');}};
drawUnitShadow(ctx,source,{x:20,y:30,width:96,height:120,anchorX:.4,anchorY:.65});
assert.deepEqual(translations,[[20,30]]);
assert.deepEqual(draws[0],[shadow,0,0,80,100,-38.400000000000006,-78,96,120]);

// Atomic draft persistence stores optional shadow PNGs separately, retains
// ordinary image files, bounds total bytes, and rejects unmatched sidecars.
const store=readFileSync(new URL('../js/sprite-set-store.mjs',import.meta.url),'utf8');
const fn=store.slice(store.indexOf('export async function saveStudioDraft('),store.indexOf('export async function loadStudioDraft(')).replace('export ','');
let records;
const sandbox={Blob,Date,prepareWorkspace:async value=>value,validateSpriteSetManifest(){},validateStudioWorkspace(){},studioDraftImageNames:()=>['ready-e.png'],writeRecords:async value=>{records=value;}};
vm.runInNewContext(fn,sandbox);
const body=new Blob(['character']),sidecar=new Blob(['shadow']),manifest={sheet:{file:'sheet.png'}};
await sandbox.saveStudioDraft({manifest,files:{'ready-e.png':body},shadows:{'ready-e.png':sidecar},workspace:{captures:{}}});
assert.equal(records.length,2);assert.equal(records[0][1].files['ready-e.png'],body);assert.equal(records[0][1].shadows['ready-e.png'],sidecar);
await assert.rejects(()=>sandbox.saveStudioDraft({manifest,files:{'ready-e.png':body},shadows:{'unknown.png':sidecar}}),/Invalid ground-shadow/);
await sandbox.saveStudioDraft({manifest,files:{'ready-e.png':body}});assert.equal(Object.keys(records[0][1].shadows).length,0,'Old drafts remain valid');
console.log('PASS flat world-floor projection for standing/prone vertices, skinning order, material restoration, exact sidecar anchoring and atomic backward-compatible draft shadows');

// Combat uses the original high-resolution character image, so attach the
// native shadow to that exact decoded source, not just its unused derivative.
const runtime=readFileSync(new URL('../js/sprite-set-runtime.mjs',import.meta.url),'utf8');
const registration=runtime.slice(runtime.indexOf('async function registerSet('),runtime.indexOf('async function loadRepositorySet('));
const bodyImage={naturalWidth:160,naturalHeight:200},nativeImage={naturalWidth:80,naturalHeight:100};
const bitmap={width:80,height:100,close(){}},attached=[];
const runtimeSandbox={Blob,URL,createImageBitmap:async()=>bitmap,
 decodeImages:async()=>({images:{'ready-e.png':bodyImage},runtimeImages:{'ready-e-battlefield.png':nativeImage}}),
 unitSun:{setGroundShadow:(...args)=>attached.push(args)},api:{register:()=> 'test'},assets:new Map(),spriteLayout:()=>({})};
vm.runInNewContext(registration,runtimeSandbox);
await runtimeSandbox.registerSet({battlefield:{width:80,height:100}}, {}, [], {'ready-e.png':sidecar});
assert.equal(attached.length,1);assert.equal(attached[0][0],bodyImage);assert.equal(attached[0][1],bitmap);
runtimeSandbox.createImageBitmap=async()=>{throw Error('corrupt optional PNG');};
assert.equal(await runtimeSandbox.registerSet({battlefield:{width:80,height:100}}, {}, [], {'ready-e.png':sidecar}),'test');
console.log('PASS combat sidecar attaches to the full-resolution render source; bad optional shadow leaves the character available');
