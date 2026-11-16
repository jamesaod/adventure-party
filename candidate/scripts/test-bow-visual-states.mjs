import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {newDraft,assignClip,validateDraft} from '../js/mob-workshop-core.mjs';
import {bowDrawnAt,warmBowMaterials} from '../js/equipment-visual-states.mjs';
import {createWorkshopAnimationSelector,workshopAttackTiming} from '../js/workshop-animation-runtime.mjs';
import {createWeaponAttachment,studioWeapon} from '../js/studio-equipment.mjs';
import {snapshotGpuCaster} from '../js/combat-gpu-casters.mjs';
const d=newDraft();d.clips=[{id:'bow',duration:5}];
const a={clipId:'bow',start:1,end:5,speed:2,loop:false,bowTiming:{draw:2,release:4}};
assignClip(d,'bow',a);
assert.deepEqual(validateDraft(JSON.parse(JSON.stringify(d))).assignments.bow[0],a);
assert.deepEqual(workshopAttackTiming(d,'bow'),{windupDurationMs:1500,actionDurationMs:500});
for(const [draw,release] of [[0,4],[4,2],[2,6],[NaN,4]])assert.throws(()=>assignClip(d,'bow',{...a,bowTiming:{draw,release}}),/Bow markers/);
const select=createWorkshopAnimationSelector(d),u={alive:true,poseStartedAt:1000};
for(const [now,drawn] of [[1000,false],[1500,true],[2000,true],[2500,false],[4000,false]]){
 const chosen=select(u,'bow',undefined,now);assert.equal(bowDrawnAt(chosen.assignment,chosen.time),drawn);
}
assert.equal(bowDrawnAt(select(u,'idle',undefined,2000).assignment,0),false);
// Real mount visibility is shared by body and GPU shadow snapshot.
const hand=new THREE.Bone(),root=new THREE.Group();
for(const name of ['BowRest','BowDrawn']){const m=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());m.name=name;root.add(m);}
const preset=studioWeapon('longbow');
const mount=createWeaponAttachment(THREE,hand,root,{rightHand:preset.id});
assert.equal(root.getObjectByName('BowRest').visible,true);
mount.setDrawn(true);assert.equal(root.getObjectByName('BowRest').visible,false);assert.equal(root.getObjectByName('BowDrawn').visible,true);
assert.equal(snapshotGpuCaster(hand,new THREE.PerspectiveCamera()).parts.length,1);
let compiled=0;const renderer={initTexture(){},compile(){compiled++;assert.ok(root.children.every(o=>o.visible));}};
warmBowMaterials(renderer,hand,new THREE.PerspectiveCamera(),root);warmBowMaterials(renderer,hand,new THREE.PerspectiveCamera(),root);
assert.equal(compiled,1);assert.equal(root.getObjectByName('BowRest').visible,false);
mount.setDrawn(false);assert.equal(root.getObjectByName('BowDrawn').visible,false);
for(const id of ['longbow','composite-longbow']){const p=studioWeapon(id),b=readFileSync(p.file),json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));assert.ok(json.nodes.some(n=>n.name==='BowRest'));assert.ok(json.nodes.some(n=>n.name==='BowDrawn'));}
console.log('PASS bow markers: export, trim/speed, release timing, shared mount/shadow visibility and one-time material warmup');
