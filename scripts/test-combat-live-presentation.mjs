import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {setDirectUnit,sampleDirectPose} from '../js/combat-direct-units.mjs';
const group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshBasicMaterial());group.add(mesh);
const camera=new THREE.OrthographicCamera(-4,4,4,-4,.1,100);camera.position.set(0,5,8);camera.lookAt(0,0,0);camera.updateMatrixWorld();
const walk={group,camera,sample(t){mesh.position.x=t;}},asset={walk,group:new THREE.Group(),camera};
const frame={asset,yaw:.4},entity={alive:true,walkPresentation:{seconds:.1}},image={};setDirectUnit(image,asset,.4);
assert.equal(sampleDirectPose(frame,entity).asset,walk);
const first=globalThis.adventurePartyDirectUnits.liveShadow(image,entity);
entity.walkPresentation.seconds=.8;
const second=globalThis.adventurePartyDirectUnits.liveShadow(image,entity);
assert.notDeepEqual(first.parts[0].matrix.elements,second.parts[0].matrix.elements,'Shadow transforms must follow the live pose without copying vertices');
assert.equal(first.parts[0].geometry,second.parts[0].geometry,'GPU reuses immutable vertex buffers');
assert.equal(globalThis.adventurePartyDirectUnits.liveShadow(image,entity),second,'Reuse unchanged pose');
delete entity.walkPresentation;const standing=globalThis.adventurePartyDirectUnits.liveShadow(image,entity);
assert(standing.gpu);assert.notEqual(standing,second,'Stopping switches to the actual standing model');
assert.equal(standing.parts.length,0,'Do not reuse the moving rig for a different standing pose');
assert.equal(globalThis.adventurePartyDirectUnits.liveShadow(image,entity),standing,'Standing transforms are cached too');
assert.equal(globalThis.adventurePartyDirectUnits.liveShadow({},entity),null,'PNG-only units retain their silhouette fallback');
console.log('PASS moving and standing shadows follow the current model, reuse cached geometry, and retain PNG fallback');

const {unitSun}=await import('../js/unit-sun-shadow.mjs');
const {setModelShadow}=await import('../js/combat-model-shadow.mjs');
function checkProjection(shadow,body,captureCamera){
 const expectedCamera=new THREE.Matrix4().multiplyMatrices(captureCamera.projectionMatrix,captureCamera.matrixWorldInverse);
 assert.deepEqual(shadow.camera.elements,expectedCamera.elements);
 const meshes=[];body.traverseVisible(m=>{if(m.isMesh)meshes.push(m);});
 assert.equal(shadow.parts.length,meshes.length);
 let height=0;
 for(let j=0;j<meshes.length;j++){
  const part=shadow.parts[j],model=meshes[j];assert.equal(part.geometry,model.geometry);
  for(let i=0;i<part.geometry.attributes.position.count;i++){
   const p=new THREE.Vector3().fromBufferAttribute(part.geometry.attributes.position,i).applyMatrix4(part.matrix);
   const ground=new THREE.Vector3(p.x,0,p.z).applyMatrix4(shadow.camera),top=p.clone().applyMatrix4(shadow.camera);
   const visible=model.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(model.matrixWorld).project(captureCamera);
   assert(Math.abs(top.x-visible.x)<1e-6&&Math.abs(top.y-visible.y)<1e-6,'Shadow geometry must reconstruct the displayed model, including its height');
   height=Math.max(height,(top.y-ground.y)/2);
  }
 }
 return height;
}
let submitted;globalThis.adventurePartyGpuShadows={unit(_image,options){submitted=options.modelShadow;return true;}};
for(const size of [.5,1,2,4]){
 const body=new THREE.Group(),bodyMesh=new THREE.Mesh(new THREE.BoxGeometry(.6,1.8,.3),new THREE.MeshBasicMaterial());bodyMesh.position.y=.9;body.add(bodyMesh);body.scale.setScalar(size);
 const handle={},actor={alive:true};setDirectUnit(handle,{group:body,camera},.25);
 setModelShadow(handle,{positions:new Float32Array([0,0,99]),indices:new Uint32Array([0,0,0])});
 unitSun.caster=actor;
 for(let view=0;view<6;view++){
  globalThis.adventurePartyUnitViewYawOffset=()=>view*Math.PI/3;
  unitSun.draw(null,handle,{});assert(submitted?.gpu,'Ignore stale saved shadow scale for every direct 3D unit');
  checkProjection(submitted,body,camera);
  assert.equal(globalThis.adventurePartyDirectUnits.liveShadow(handle,actor),submitted,'Reuse unchanged view/pose');
 }
}
delete globalThis.adventurePartyUnitViewYawOffset;delete globalThis.adventurePartyGpuShadows;unitSun.caster=null;
console.log('PASS four unit sizes and all six view angles use displayed geometry instead of oversized saved shadows');

// Exercise Carl's actual published standing model without a browser or textures.
const fs=await import('node:fs'),{gunzipSync}=await import('node:zlib');
const unpack=file=>JSON.parse(gunzipSync(fs.readFileSync(new URL('../assets/prepared-combat/'+file,import.meta.url))));
const pack=unpack('direct-v1-mob-appearance-v1-0d8d7b53.json.gz');
const {expandPreparedChunks}=await import('../js/combat-prepared-chunks.mjs');
pack.scene.images=[];await expandPreparedChunks(pack,hash=>unpack('chunks/'+hash+'.json.gz'));
pack.scene.textures=[];pack.scene.materials=pack.scene.materials.map(m=>({uuid:m.uuid,type:'MeshBasicMaterial',visible:m.visible}));
const loader=new THREE.ObjectLoader(),published=loader.parse(pack.scene);
let readyChecked=0;
for(const [name,saved] of Object.entries(pack.frames)){
 if(!name.startsWith('ready-')||name.endsWith('-battlefield.png'))continue;
 const body=published.getObjectByProperty('uuid',saved.object),captureCamera=loader.parse(saved.camera),handle={},actor={alive:true};
 setDirectUnit(handle,{group:body,camera:captureCamera},saved.yaw);setModelShadow(handle,saved.shadow);
 const shadow=globalThis.adventurePartyDirectUnits.liveShadow(handle,actor);assert(shadow.gpu);
 const height=checkProjection(shadow,body,captureCamera);assert(height>0&&height<.4,'Carl standing shadow uses the actual model height');readyChecked++;
}
assert.equal(readyChecked,6);
console.log('PASS actual published Carl standing model at all six facings has matching shadow projection');
