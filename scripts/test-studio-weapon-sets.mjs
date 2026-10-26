import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createStudioEquipment,normalizeEquipment,normalizeOffHandEquipment,studioWeapon,STUDIO_WEAPONS} from '../js/studio-equipment.mjs';
import {normalizeShield} from '../js/studio-shield.mjs';
import {buildStudioUnitExport} from '../js/studio-unit-export.mjs';
import {validateUnitPackage} from '../js/unit-package.mjs';
const source=fs.readFileSync(new URL('../assets/vendor/three/three.core.min.js',import.meta.url));
const THREE=await import(`data:text/javascript;base64,${source.toString('base64')}`);
const rig=new THREE.Group(),right=new THREE.Bone(),left=new THREE.Bone();
right.name='mixamorigRightHand';left.name='mixamorigLeftHand';right.position.x=1;left.position.x=-1;rig.add(right,left);
const make=offHand=>createStudioEquipment({THREE,offHand,loadAsset:async()=>new THREE.Group(),disposeObject:()=>{}});
const primary=make(false),off=make(true);
await primary.setModel(rig,{rightHand:'medieval-sword'});
await off.setModel(rig,{rightHand:'dagger'});
assert.equal(right.children.length,1);assert.equal(left.children.length,1);
assert.equal(off.snapshot().attachmentHandBone,left.name);
assert.equal(off.snapshot().settings.sizePercent,100);
assert.deepEqual(off.snapshot().settings.position,[0.005,0.065,-0.005]);
assert.deepEqual(off.snapshot().settings.rotation,[73,0,-90]);
const oldPrimary=primary.snapshot().socketWorldPosition;
const adjusted={...off.snapshot().settings,sizePercent:135,position:[.1,.2,.3],rotation:[30,45,-60]};
await off.select(adjusted);rig.updateWorldMatrix(true,true);
assert.deepEqual(off.snapshot().settings.rotation,[30,45,-60]);
assert.deepEqual(primary.snapshot().socketWorldPosition,oldPrimary);
assert.ok(left.children[0].getWorldPosition(new THREE.Vector3()).distanceTo(left.localToWorld(new THREE.Vector3(.1,.2,.3)))<1e-8);
assert.equal(off.applyConstraints().active,false);
await off.setModel(rig,JSON.parse(JSON.stringify(off.snapshot().settings)));
assert.deepEqual(off.snapshot().settings.rotation,[30,45,-60]);
for(const id of ['spear','recurve-bow','crossbow','wooden-staff','medieval-two-handed-sword']){
  assert.equal(normalizeOffHandEquipment({rightHand:id}).rightHand,'none');
}
await off.select({rightHand:'spear'});assert.equal(left.children.length,0);
// Independent source-pose references exercise all six mounts as the left hand
// changes orientation. Validate the actual shared attachment transform, not
// just the normalizer's returned Euler values.
const handReference=JSON.parse(fs.readFileSync(new URL('./fixtures/carl-uploaded-animation-reference.json',import.meta.url)));
const idleHand=handReference.clips.find(clip=>clip.id==='standing-idle').frames[0].worldQuaternions.LeftHand;
const offWeapons=STUDIO_WEAPONS.filter(weapon=>weapon.handsRequired!==2);
for(const weapon of offWeapons){
  await off.select({rightHand:weapon.id});
  const settings=off.snapshot().settings;
  const socket=left.children[0],asset=socket.children[0].children[0];
  const localAxis=new THREE.Vector3(...weapon.primaryAxis).normalize().applyQuaternion(socket.quaternion);
  if(['medieval-sword','battle-axe','short-sword','dagger'].includes(weapon.id)){
    assert.ok(localAxis.angleTo(new THREE.Vector3(1,0,0))<Math.PI/180,`${weapon.id}: handle must align across the approved left palm`);
  }else{
    const direction=weapon.id==='sling' ? -1 : 1;
    assert.ok(localAxis.applyQuaternion(new THREE.Quaternion(...idleHand).normalize()).angleTo(new THREE.Vector3(0,direction,0))<Math.PI/180,`${weapon.id}: upright/hanging in Standing Idle`);
  }
  for(const clip of handReference.clips)for(const frame of clip.frames){
    left.quaternion.fromArray(frame.worldQuaternions.LeftHand).normalize();
    for(let facing=0;facing<6;facing++){
      rig.rotation.y=facing*Math.PI/3;rig.updateWorldMatrix(true,true);
      const pivot=asset.localToWorld(new THREE.Vector3(...weapon.grip));
      const palm=left.localToWorld(new THREE.Vector3(...settings.position));
      assert.ok(pivot.distanceTo(palm)<1e-8,`${weapon.id}: ${clip.id} grip detached`);
    }
  }
}
assert.deepEqual(normalizeOffHandEquipment({rightHand:'medieval-sword'}).rotation,[163,-180,0],'Keep the user-approved sword');
const legacyMount={rightHand:'dagger',sizePercent:100,position:[.005,.065,-.005],rotation:[163,-180,0]};
assert.deepEqual(normalizeOffHandEquipment(legacyMount).rotation,legacyMount.rotation,'Do not silently rewrite saved/captured mounts');
console.log(`PASS off-hand alignment: ${offWeapons.length} weapons, ${handReference.clips.length} uploaded clips, 70 sampled poses and six facings; calibrated axes and palm pivots`);
primary.dispose();off.dispose();

const studio=fs.readFileSync(new URL('../js/3d-studio.mjs',import.meta.url),'utf8');
const manager=(normalize,initial)=>{let settings=normalize(initial);return {snapshot:()=>({settings:structuredClone(settings)}),select:async value=>{settings=normalize(value);return true;}};};
const context=vm.createContext({
 state:{modelReady:true,modelLoading:false,disposed:false,model:{}},
 studioWeapon,normalizeEquipment,normalizeOffHandEquipment,normalizeShield,
 equipment:manager(normalizeEquipment,{rightHand:'medieval-sword'}),
 offHandEquipment:manager(normalizeOffHandEquipment,{}),
 shieldEquipment:manager(normalizeShield,{leftHandShield:'round-wooden-shield'}),
 poseCapture:{invalidateCaptures(){},saveWorkspace(){}},
 updateEquipmentControls(){},resetPreviewReferenceToReady(){}
});
vm.runInContext(studio.slice(studio.indexOf('async function changeEquipment('),studio.indexOf('function setModelReady(')),context);
await vm.runInContext("changeOffHand({rightHand:'dagger'})",context);
assert.equal(context.shieldEquipment.snapshot().settings.leftHandShield,'none');
assert.equal(context.offHandEquipment.snapshot().settings.rightHand,'dagger');
await vm.runInContext("changeShield({leftHandShield:'round-wooden-shield'})",context);
assert.equal(context.offHandEquipment.snapshot().settings.rightHand,'none');
await vm.runInContext("changeOffHand({rightHand:'dagger'})",context);
await vm.runInContext("changeEquipment({rightHand:'spear'},{resetPose:false})",context);
assert.equal(context.offHandEquipment.snapshot().settings.rightHand,'none');
assert.equal(context.shieldEquipment.snapshot().settings.leftHandShield,'none');
await vm.runInContext("changeOffHand({rightHand:'dagger'})",context);
assert.equal(context.offHandEquipment.snapshot().settings.rightHand,'none');

const render={equipment:normalizeEquipment({rightHand:'medieval-sword'}),offHandEquipment:adjusted};
const dual={actionProfileId:'dual-wield',poses:{ready:{clip:'Standing Idle',clipSourceId:'uploaded:standing-idle:0',time:3,render}}};
const stab={actionProfileId:'one-handed-thrust',poses:{ready:{clip:'Stabbing',clipSourceId:'uploaded:stabbing:0',time:1,render:{equipment:normalizeEquipment({rightHand:'short-sword'})}}}};
const unit=buildStudioUnitExport({name:'Carl test',settings:{libraryModelId:'dungeon-crawler-carl-v3',mobType:'fighter'},profiles:[{id:'dual-wield',manifest:dual},{id:'one-handed-thrust',manifest:stab}]});
validateUnitPackage(unit);
assert.deepEqual(unit.actionProfiles,['dual-wield','one-handed-thrust']);
assert.equal(unit.references.spriteSets['dual-wield'].manifest,'profiles/dual-wield/manifest.json');
assert.equal(unit.references.spriteSets['one-handed-thrust'].manifest,'profiles/one-handed-thrust/manifest.json');
assert.equal(unit.references.spriteSets['dual-wield'].poses.ready.clipSourceId,'uploaded:standing-idle:0');
assert.equal(unit.references.spriteSets['dual-wield'].poses.ready.render.offHandEquipment.rightHand,'dagger');
assert.equal(unit.equipment.find(item=>item.slot==='off-hand').itemId,'dagger');
render.offHandEquipment.rotation[0]=99;
assert.equal(unit.references.spriteSets['dual-wield'].poses.ready.render.offHandEquipment.rotation[0],30,'Export owns a snapshot, not the next edited grip');
console.log('PASS weapon sets: independent left-hand mount, adjustable persistence, exclusions and multi-profile Unit Package references');
