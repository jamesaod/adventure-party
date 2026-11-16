import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {createBackAttachment,createStudioBackEquipment,loadWorkshopBackAttachment,normalizeBackEquipment} from '../js/studio-back-equipment.mjs';
import {fitKey,saveFit,savedFit,resetFit,migrateFits} from '../js/mob-workshop-fit-store.mjs';
import {newDraft,validateDraft} from '../js/mob-workshop-core.mjs';
import {validateWorkshopProject} from '../js/mob-workshop-project.mjs';
import {captureFit,readFit} from '../js/mob-workshop-fit-core.mjs';
import {createBowString} from '../js/procedural-bow-string.mjs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return s==='three'?{url:new URL('../assets/vendor/three/three.module.min.js',import.meta.url).href,shortCircuit:true}:n(s,c);}});
const {GLTFLoader}=await import('../assets/vendor/three/addons/loaders/GLTFLoader.js');
function rig(units=1){
 const root=new THREE.Group();root.scale.setScalar(1/units);
 const bone=(name,position,parent=root)=>{const b=new THREE.Bone();b.name=name;b.position.fromArray(position).multiplyScalar(units);parent.add(b);return b;};
 const chest=bone('Spine2',[0,1.4,0]);bone('Neck',[0,.2,0],chest);bone('RightShoulder',[-.16,.05,0],chest);
 const left=bone('LeftHand',[.3,1.4,.2]),right=bone('RightHand',[-.3,1.6,0]);root.updateMatrixWorld(true);return {root,chest,left,right};
}
const prop=()=>new THREE.Mesh(new THREE.BoxGeometry(.26,1,.26),new THREE.MeshBasicMaterial());
const settings={item:'empty-quiver',position:[.2,.1,.15],rotation:[10,20,-15],sizePercent:150};
for(const units of [1,100]){
 const r=rig(units),attachment=createBackAttachment(THREE,r.root,prop(),settings);
 assert(Math.abs(attachment.model.getWorldScale(new THREE.Vector3()).y-.435)<1e-6,'Back size uses metres for metre and centimetre rigs');
 const start=captureFit(THREE,attachment.socket,settings);attachment.socket.position.x+=.05;
 const dragged=readFit(THREE,attachment.socket,start);assert(Math.abs(dragged.position[0]-.25)<1e-8);attachment.update(dragged);
 const relative=attachment.anchor.position.clone(),old=attachment.socket.getWorldPosition(new THREE.Vector3());r.chest.rotation.y=.5;r.root.updateMatrixWorld(true);
 assert(attachment.socket.getWorldPosition(new THREE.Vector3()).distanceTo(old)>.01);assert(attachment.anchor.position.equals(relative),'Animation cannot rewrite the saved fit');
 attachment.detach();assert.equal(attachment.anchor.parent,null);
}
let loads=0,disposed=0;const r=rig();
const manager=createStudioBackEquipment({THREE,loadAsset:async()=>{loads++;return prop();},disposeObject:()=>disposed++});
await manager.setModel(r.root,settings);const socket=manager.getAttachmentSocket();await manager.select({...settings,position:[.25,.1,.15]});assert.equal(loads,1,'Numeric/gizmo edits reuse the loaded asset');assert.equal(manager.getAttachmentSocket(),socket);
const snap=manager.snapshot();snap.settings.position[0]=999;assert.equal(manager.snapshot().settings.position[0],.25,'Snapshot cannot mutate the live fit');
await manager.select({item:'none'});assert.equal(manager.getAttachmentSocket(),null);assert.equal(disposed,1);
let release;const delayed=createStudioBackEquipment({THREE,loadAsset:()=>new Promise(resolve=>release=resolve),disposeObject:()=>disposed++});
const pending=delayed.setModel(r.root,settings);await delayed.select({item:'none'});release(prop());assert.equal(await pending,false);assert.equal(delayed.getAttachmentSocket(),null,'Stale downloads cannot restore a removed Back item');
const draft=newDraft();draft.equipment.back='empty-quiver';saveFit(draft,'back',settings);
const portable=validateWorkshopProject({draft:JSON.parse(JSON.stringify(draft)),files:{}}).draft;
assert.deepEqual(savedFit(portable,'back'),settings);assert.notEqual(fitKey(portable,'back'),fitKey({...portable,model:{id:'other-model'}},'back'));
assert.throws(()=>validateDraft({...newDraft(),equipment:{...newDraft().equipment,back:'unknown'}}),/Unknown Back/);
assert.throws(()=>normalizeBackEquipment({...settings,position:[Infinity,0,0]}),/Invalid Back/);
const restored=await loadWorkshopBackAttachment(THREE,r.root,portable,async()=>prop());assert.deepEqual(restored.socket.position.toArray(),settings.position);assert.equal(restored.socket.scale.x,1.5);
const legacy=newDraft();delete legacy.equipment.back;migrateFits(legacy);assert.equal(legacy.equipment.back,'auto');assert.equal(await loadWorkshopBackAttachment(THREE,r.root,legacy,async()=>{throw Error('Automatic quiver keeps the existing bow path');}),null);
resetFit(portable,'back');assert.equal(savedFit(portable,'back'),null);
// An authored quiver supplies the arrow storage socket without a duplicate auto quiver.
const bytes=readFileSync('assets/models/weapons/low-poly-medieval/bow_1-morph.glb');
const bow=await new GLTFLoader().register(()=>({name:'headless',loadMaterial:()=>Promise.resolve(new THREE.MeshStandardMaterial())})).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
r.left.add(bow.scene);const controller=createBowString(THREE,bow.scene,r.left);controller.calibratePickup(null,{arrowSocket:restored.arrowSocket});
controller.update(false,{phase:'idle',remaining:4},.4);const arrow=bow.scene.getObjectByName('DrawnBowArrow');
assert(arrow.getWorldPosition(new THREE.Vector3()).distanceTo(restored.arrowSocket.getWorldPosition(new THREE.Vector3()))<1e-6);
assert.equal(restored.model.position.y,-.29,'Bow sampling preserves the authored quiver model transform');
assert.equal(r.root.getObjectByName('BowBackQuiver'),undefined,'No automatic duplicate beside the authored quiver');
controller.dispose();assert(restored.anchor.parent,'Bow cleanup cannot remove separately equipped Back item');assert.equal(restored.arrowSocket.children.length,0);
restored.detach();manager.dispose();delayed.dispose();
const html=readFileSync('mob-workshop.html','utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Back slot must not duplicate navigation button ID');assert(ids.includes('backItem')&&ids.includes('back'));assert(html.includes('<option value="back">Back</option>'));
console.log('PASS Back slot: physical attachment, animation/rotation, gizmo edits, async cleanup, model/item fits, portable round-trip, legacy auto quiver and authored combat pickup without duplicates.');
