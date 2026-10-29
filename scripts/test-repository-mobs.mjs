import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRepositoryMob} from '../js/repository-mobs.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const template=read('../data/mobs/orc-male-uniformed.unit-package.json');
const api=createRepositoryMob(template,read('../data/studio-models.json'));
function spawn(values){return api.apply({type:'orc'},()=>values.shift()??0);}
const a=spawn([0,0,0,0]),b=spawn([.75,.5,.5,.99]),c=spawn([.95,0,0,0]);
assert.deepEqual([a.level,b.level,c.level],[1,2,3]);
assert.equal(a.inventory[0].catalogItemId,'battle-axe');assert.equal(b.inventory[0].catalogItemId,'short-sword');
assert.equal(a.inventory[1].slot,'shield');assert.equal(b.inventory.length,1);
assert.equal(a.hp,1);assert.equal(b.hp,11);assert.equal(a.thaco,20);assert.equal(b.thaco,19);assert.equal(c.thaco,18);assert.equal(a.ac,10);
for(const unit of [a,b,c]){const recipe=api.recipe(unit);assert.equal(recipe.model.modelId,'male-orc');assert.equal(recipe.poseProfile.poses.attack.sourceId,'uploaded:stabbing:0');assert.equal(recipe.poseProfile.poses.prone.sourceId,'uploaded:standing-death-forward-01:0');assert.equal(recipe.renderSettings.modelScalePercent,140);assert.equal(recipe.renderSettings.hexScalePercent,109);assert.ok(Math.abs(recipe.renderSettings.frame.renderWidth-48*1.4*1.09)<1e-9);assert.deepEqual(recipe.renderSettings.weaponAttachmentProfile.position,[-.02,.05,.005]);}
assert.deepEqual(template.mob.generation.offHand,[{itemId:'round-wooden-shield',weight:50},{itemId:'none',weight:50}]);
console.log('PASS repository Orc template probabilities, stats, equipment, pinned poses, frame scale and model grips');

// Different asset axes need distinct rotations under the same rig calibration.
const THREE=await import('../assets/vendor/three/three.module.min.js');
const {studioWeapon}=await import('../js/studio-equipment.mjs');
const catalog=read('../data/studio-models.json');
const sword=studioWeapon('medieval-sword'),axe=studioWeapon('battle-axe');
const profiles=catalog.weaponAttachmentProfiles;
const swordGrip=profiles['uniformed-orc-one-handed-v1'],axeGrip=profiles['uniformed-orc-battle-axe-v1'];
const q=r=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...r.map(THREE.MathUtils.degToRad),'XYZ'));
const shaft=(weapon,grip)=>new THREE.Vector3(...weapon.primaryAxis).normalize().applyQuaternion(q(grip.rotation));
assert.ok(shaft(sword,swordGrip).dot(shaft(axe,axeGrip))>.9999,'Orc axe shaft aligns with approved sword blade');
assert.ok(shaft(sword,swordGrip).dot(shaft(axe,swordGrip))<.5,'Regression reproduces the erroneous shared rotation');
assert.deepEqual(swordGrip.rotation,[161,-46,15]);
assert.equal(catalog.models.find(m=>m.id==='male-orc').weaponAttachmentProfileIds.filter(id=>profiles[id].weaponIds.includes('battle-axe')).length,1);
assert.deepEqual(api.recipe(a).renderSettings.weaponAttachmentProfile.rotation,[161,-46,144]);
console.log('PASS Orc axe axis correction, unchanged sword, unique profile and combat mount');
