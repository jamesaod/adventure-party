import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {expandPreparedChunks} from '../js/combat-prepared-chunks.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {captureDirectUnit,setDirectUnit,directUnitFrame} from '../js/combat-direct-units.mjs';
import {setModelShadow,getModelShadow} from '../js/combat-model-shadow.mjs';
import {serializePreparedAsset,hydratePreparedAsset,validatePreparedAsset} from '../js/combat-prepared-assets.mjs';
globalThis.Image=class {set src(value){this.source=value;queueMicrotask(()=>this.onload());}};
const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial({color:0x997744})));
const camera=new THREE.OrthographicCamera(-2,2,3,-1,.1,100);camera.position.set(0,3,8);camera.lookAt(0,1,0);// Deliberately leave matrices stale, as happens immediately after lookAt.
const asset=captureDirectUnit(root,camera),a={},b={};
setDirectUnit(a,asset,0);setDirectUnit(b,asset,Math.PI);
for(const image of [a,b])setModelShadow(image,{positions:new Float32Array([0,0,0,1,0,0,0,1,0]),indices:new Uint32Array([0,1,2]),stats:{triangles:1}});
const recipe={mob:{type:'test',heightInches:72},model:{id:'test'},equipment:{id:'sword'}};
const pack=serializePreparedAsset(recipe,{manifest:{id:'test'},images:{'ready.png':a},runtimeImages:{'ready-battlefield.png':b},sourceUrls:{'ready.png':'mask-a','ready-battlefield.png':'mask-b'}});
const loaded=await hydratePreparedAsset(JSON.parse(JSON.stringify(pack)));
assert.equal(directUnitFrame(loaded.images['ready.png']).asset,directUnitFrame(loaded.runtimeImages['ready-battlefield.png']).asset);
assert.equal(directUnitFrame(loaded.runtimeImages['ready-battlefield.png']).yaw,Math.PI);
const restored=directUnitFrame(loaded.images['ready.png']).asset.camera;restored.updateMatrixWorld(true);camera.updateMatrixWorld(true);
assert(new THREE.Vector3().project(restored).distanceTo(new THREE.Vector3().project(camera))<1e-8,'Saved camera must preserve the viewing angle and foot anchor');
assert.equal(getModelShadow(loaded.images['ready.png']).indices.length,3);
assert.equal(directUnitFrame(loaded.images['ready.png']).asset.group.children[0].material.userData.baseColor.getHex(),0x997744);
assert.throws(()=>validatePreparedAsset({...pack,frames:{}},pack.key),/no poses/);
assert.throws(()=>validatePreparedAsset(pack,'another-equipment'),/another equipment/);
assert(!readFileSync('js/adventure-party.js','utf8').includes('generateSpriteSet:rendererModule.generateCombatSpriteSet'));
assert(!readFileSync('js/combat-prepared-assets.mjs','utf8').includes('combat-mob-renderer'));
console.log('PASS prepared geometry round trip, shared facings, materials, shadows, recipe validation and no combat-time build');
let requests=0;const hash='a'.repeat(64);
const shared={sharedSceneVersion:1,scene:{geometries:[{uuid:'one',chunk:hash},{uuid:'two',chunk:hash}],images:[]}};
await expandPreparedChunks(shared,async()=>{requests++;return {type:'BufferGeometry',data:{}};});
assert.equal(requests,1);assert.equal(shared.scene.geometries[1].uuid,'two');
assert.equal(shared.scene.geometries[0].type,'BufferGeometry');
await assert.rejects(expandPreparedChunks({sharedSceneVersion:1,scene:{images:[{uuid:'x',chunk:'../bad'}]}},()=>{}),/Invalid/);
await assert.rejects(expandPreparedChunks({sharedSceneVersion:1,scene:{images:[{uuid:'x',chunk:hash}]}},async()=>{throw Error('missing chunk');}),/missing chunk/);
const index=JSON.parse(readFileSync('assets/prepared-combat/index.json')),checked=new Set();
for(const key of index.keys){
  const published=JSON.parse(gunzipSync(readFileSync(`assets/prepared-combat/${key}.json.gz`)));
  validatePreparedAsset(published,key);
  for(const field of ['geometries','images'])for(const ref of published.scene[field]||[]){
    if(checked.has(ref.chunk))continue;
    const data=gunzipSync(readFileSync(`assets/prepared-combat/chunks/${ref.chunk}.json.gz`));
    assert.equal(createHash('sha256').update(data).digest('hex'),ref.chunk);checked.add(ref.chunk);
  }
}
console.log(`PASS ${index.keys.length} published packs and ${checked.size} content-addressed geometry/image chunks`);
