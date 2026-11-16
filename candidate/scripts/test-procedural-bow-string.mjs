import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){return specifier==='three'?{url:new URL('../assets/vendor/three/three.module.min.js',import.meta.url).href,shortCircuit:true}:next(specifier,context);}});
const {GLTFLoader}=await import('../assets/vendor/three/addons/loaders/GLTFLoader.js');
import {createWeaponAttachment,studioWeapon} from '../js/studio-equipment.mjs';
import {createBowString} from '../js/procedural-bow-string.mjs';
for(const id of ['bow_1','bow_2']){
 const b=readFileSync(`assets/models/weapons/low-poly-medieval/${id}-morph.glb`);
 const gltf=await new GLTFLoader().register(()=>({name:"headless-test-material",loadMaterial:()=>Promise.resolve(new THREE.MeshStandardMaterial())})).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const rig=new THREE.Group(),left=new THREE.Bone(),right=new THREE.Bone();left.name='LeftHand';right.name='RightHand';rig.add(left,right);left.add(gltf.scene);
 let bow;gltf.scene.traverse(o=>{if(o.userData.bowStringAnchors)bow=o;});assert.ok(bow);
 const controller=createBowString(THREE,gltf.scene,left);right.position.set(.3,.5,0);rig.updateMatrixWorld(true);controller.update(true);
 const lines=bow.children.filter(o=>o.name==='ProceduralBowString');assert.equal(lines.length,2);
 for(const line of lines){const end=line.localToWorld(new THREE.Vector3(0,.5,0));assert.ok(end.distanceTo(right.getWorldPosition(new THREE.Vector3()))<1e-5);}
 const arrow=bow.children.find(o=>o.userData.drawnArrow);assert.ok(arrow?.visible);
 const tail=arrow.localToWorld(new THREE.Vector3()),tip=arrow.localToWorld(new THREE.Vector3(0,1,0));
 const grip=left.getWorldPosition(new THREE.Vector3()),drawHand=right.getWorldPosition(new THREE.Vector3());
 assert.ok(tail.distanceTo(drawHand)<1e-5,'arrow rear follows drawing hand');
 assert.ok(tip.clone().sub(tail).normalize().distanceTo(grip.clone().sub(tail).normalize())<1e-5,'arrow points through bow hand');
 assert.ok(tip.distanceTo(tail)>grip.distanceTo(tail)+.119,'head extends past bow hand');
 controller.update(false);assert.equal(arrow.visible,false);assert.equal(bow.morphTargetInfluences[0],0);assert.ok(bow.userData.stringOverdraw<1e-6);
 right.position.x=.4;rig.updateMatrixWorld(true);controller.update(true);assert.ok(bow.morphTargetInfluences[0]>0);controller.update(false);assert.equal(bow.morphTargetInfluences[0],0);
 console.log('PASS',id,'hand attachment, immediate release, redraw, no-string morph');
}


// Imported source units must not shrink equipment alongside the character.
for(const sourceScale of [.0186,1,100]){
 const rig=new THREE.Group();rig.userData.workshopPhysicalEquipment=true;rig.scale.setScalar(sourceScale);
 const hand=new THREE.Bone();hand.name='LeftHand';rig.add(hand);
 const attachment=createWeaponAttachment(THREE,hand,new THREE.Group(),{rightHand:'longbow',sizePercent:100});
 const scale=attachment.socket.getWorldScale(new THREE.Vector3());
 assert.ok(Math.abs(scale.x-studioWeapon('longbow').nativeScale)<1e-6);
 attachment.update({...{rightHand:'longbow'},presetRevision:100,sizePercent:150});
 assert.ok(Math.abs(attachment.socket.getWorldScale(new THREE.Vector3()).x-studioWeapon('longbow').nativeScale*1.5)<1e-6);
}
console.log('PASS Workshop equipment physical size across source units and user scale adjustment');
