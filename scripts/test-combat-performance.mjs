import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createCombatPerformance} from '../js/combat-performance.mjs';
let time=0;const p=createCombatPerformance({enabled:true,now:()=>++time});p.begin();p.measure('work',()=>p.count('draws'));p.end();assert.equal(p.snapshot().cpuMs.work,1);assert.equal(p.snapshot().counters.draws,1);p.begin();assert.deepEqual(p.snapshot().counters,{});
for(const file of ['assets/models/orcs/male-orc/male-orc','assets/models/dungeon-crawler-carl/v2-ual2-sword-test/dungeon-crawler-carl-v2-ual2-sword-test']){
 const pack=JSON.parse(fs.readFileSync(file+'.shadow.json'));assert.equal(pack.sourceSha256,crypto.createHash('sha256').update(fs.readFileSync(file+'.glb')).digest('hex'));
 for(const m of Object.values(pack.meshes)){assert.ok(m.index.length/3<=500);assert.ok(m.position.every(Number.isFinite));assert.ok(m.index.every(i=>i>=0&&i<m.position.length/3));if(m.skinWeight){assert.equal(m.skinWeight.length,m.position.length/3*4);for(let i=0;i<m.skinWeight.length;i+=4)assert.ok(Math.abs(m.skinWeight.slice(i,i+4).reduce((a,b)=>a+b,0)-1)<.001);}}
}
console.log('PASS profiling reset/timing and offline skinned LOD source hashes, indices, 500-triangle budgets and normalized weights');
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {snapshotGpuCaster} from '../js/combat-gpu-casters.mjs';
const root=new THREE.Group(),bone=new THREE.Bone(),geometry=new THREE.BoxGeometry();
const skinned=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());root.add(skinned);skinned.add(bone);skinned.bind(new THREE.Skeleton([bone]));
const camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,100);camera.position.z=5;camera.updateMatrixWorld();
const first=snapshotGpuCaster(root,camera);bone.position.x=1;const second=snapshotGpuCaster(root,camera);
assert.notDeepEqual(first.parts[0].bones,second.parts[0].bones);assert.equal(first.parts[0].geometry,second.parts[0].geometry);assert.equal(first.parts[0].bones[12],0);
console.log('PASS independent immutable bone-palette snapshots with shared vertex geometry');
