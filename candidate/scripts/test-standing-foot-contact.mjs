import {registerHooks} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
registerHooks({resolve(s,c,n){return n(s==='three'?new URL('../assets/vendor/three/three.module.min.js',import.meta.url).href:s,c)}});
const THREE=await import('../assets/vendor/three/three.module.min.js');
const {GLTFLoader}=await import('../assets/vendor/three/addons/loaders/GLTFLoader.js');
const {plantStandingFeet}=await import('../js/standing-foot-contact.mjs');
const {semanticBoneMap}=await import('../js/humanoid-rig.mjs');
globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data)}};
for(const path of ['dungeon-crawler-carl/v2-ual2-sword-test/dungeon-crawler-carl-v2-ual2-sword-test.glb','orcs/male-orc/male-orc.glb','orcs/male-orc-blue/male-orc-blue.glb']){
 const bytes=fs.readFileSync('assets/models/'+path),len=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+len));
 json.materials=[];delete json.textures;delete json.images;for(const m of json.meshes)for(const p of m.primitives)delete p.material;
 json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+len).toString('base64');
 const {scene:model,animations}=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
 const entry=JSON.parse(fs.readFileSync('data/animation-library-sources.json')).animations.find(e=>e.label==='Sword And Shield Idle');
 const {FBXLoader}=await import('../assets/vendor/three/addons/loaders/FBXLoader.js');
 const {retargetHumanoidClip}=await import('../js/mixamo-retarget.mjs');
 const f=fs.readFileSync(entry.file),source=new FBXLoader().parse(f.buffer.slice(f.byteOffset,f.byteOffset+f.byteLength),'');
 const clip=retargetHumanoidClip(THREE,source.animations[0],source,model,entry.label,{mode:entry.retargetMode||'world-bind-delta',hipTranslation:'scaled-world-y'});
 if(clip){const mixer=new THREE.AnimationMixer(model);mixer.clipAction(clip).play();mixer.update(0);}
 model.updateMatrixWorld(true);const bones=semanticBoneMap(model);
 const heights=()=>['left','right'].map(side=>{
  let low=Infinity;model.updateMatrixWorld(true);model.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();const p=new THREE.Vector3();
   const ids=[bones.get(side+'Foot'),bones.get(side+'Toe')].map(b=>o.skeleton.bones.indexOf(b)).filter(i=>i>=0);
   const si=o.geometry.attributes.skinIndex,sw=o.geometry.attributes.skinWeight;
   for(let i=0;i<si.count;i++){let w=0;for(let c=0;c<4;c++)if(ids.includes(si.getComponent(i,c)))w+=sw.getComponent(i,c);if(w>=.5){o.getVertexPosition(i,p).applyMatrix4(o.matrixWorld);low=Math.min(low,p.y);}}
  });return low;
 });
 const before=heights(),saved=[...bones.values()].map(b=>b.quaternion.toArray()),restore=plantStandingFeet(model),after=heights();
 console.log(path,clip?.name,{before,after});
 assert(Math.abs(after[0]-after[1])<.0001,'Both soles must contact the same plane');
 assert(Math.abs(Math.min(...after)-Math.min(...before))<.0001,'Keep grounded foot on original plane');
 restore();assert.deepEqual([...bones.values()].map(b=>b.quaternion.toArray()),saved,'Restore authored animation pose');
}


