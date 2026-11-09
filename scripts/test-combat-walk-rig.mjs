import {registerHooks} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
registerHooks({resolve(s,c,n){return n(s==='three'?new URL('../assets/vendor/three/three.module.min.js',import.meta.url).href:s,c)}});
const THREE=await import('../assets/vendor/three/three.module.min.js');
const {FBXLoader}=await import('../assets/vendor/three/addons/loaders/FBXLoader.js');
const {GLTFLoader}=await import('../assets/vendor/three/addons/loaders/GLTFLoader.js');
const {retargetHumanoidClip}=await import('../js/mixamo-retarget.mjs');
const {createGroundedWalk}=await import('../js/combat-walk-motion.mjs');
const {semanticBoneMap}=await import('../js/humanoid-rig.mjs');
const f=fs.readFileSync('assets/animations/locomotion/walking-test.fbx');
const source=new FBXLoader().parse(f.buffer.slice(f.byteOffset,f.byteOffset+f.byteLength),'');
const b=fs.readFileSync('assets/models/dungeon-crawler-carl/v2-ual2-sword-test/dungeon-crawler-carl-v2-ual2-sword-test.glb');
const len=b.readUInt32LE(12),json=JSON.parse(b.subarray(20,20+len));
// Keep actual skin/geometry/animation, omit image decoding in this Node-only test.
json.materials=[];delete json.textures;delete json.images;
for(const m of json.meshes)for(const p of m.primitives)delete p.material;
const binary=b.subarray(28+len);json.buffers[0].uri='data:application/octet-stream;base64,'+binary.toString('base64');
globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data)}};
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
const model=gltf.scene,group=new THREE.Group();group.add(model);
const clip=retargetHumanoidClip(THREE,source.animations[0],source,model,'walk',{mode:'anatomical-aim',hipTranslation:'scaled-world-y'});
const motion=createGroundedWalk(THREE,model,group,clip);
let maxError=0;const poses=[];
for(let i=0;i<=78;i++){const r=motion.sample(i/30);maxError=Math.max(maxError,Math.abs(r.lowest-r.groundY));poses.push(semanticBoneMap(model).get('leftLowerLeg').quaternion.toArray());}
assert(maxError<1e-5);assert.notDeepEqual(poses[0],poses[10]);
console.log('PASS actual Carl rig: 79 walk samples, maximum foot-plane error',maxError,'mapped roles',clip.userData.humanoidImport.mappedRoles.length);
