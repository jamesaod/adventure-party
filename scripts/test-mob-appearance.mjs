import assert from 'node:assert/strict';
import {
  inches, formatHeight, MOB_HEIGHTS, applyMobHeight, bodyScaleForHeight,
  WEAPON_POSE_PROFILES, VISIBLE_WEAPON_ASSETS, VISIBLE_SHIELD_ASSETS, appearanceRecipeForMob,
  appearanceCacheKey, MobAppearanceCache
} from '../js/mob-appearance.mjs';
import { createWeaponPoseProfilePackage } from '../js/weapon-pose-profile-export.mjs';

assert.equal(inches(6, 4), 76);
assert.equal(formatHeight(76), '6′4″');
assert.equal(MOB_HEIGHTS.fighter.heightInches, 76);
const carl = applyMobHeight({ id: 'player', type: 'fighter', name: 'Dungeon Crawler Carl', inventory: [
  { name: 'Flaming Sword +5', slot: 'weapon', equipped: true, appearanceId: 'flaming-sword-5' },
  { name: 'Battle Axe', slot: 'weapon', equipped: false, appearanceId: 'battle-axe' },
  { name: 'Round Wooden Shield', slot: 'shield', equipped: true, appearanceId: 'round-wooden-shield' }
]});
assert.equal(carl.heightInches, 76);
assert.equal(bodyScaleForHeight({ targetHeightInches: 76, referenceHeightInches: 76 }), 1);
assert.equal(WEAPON_POSE_PROFILES['one-handed-swing-v1'].poses.attack.timeSeconds, 0.30);
assert.equal(VISIBLE_WEAPON_ASSETS['battle-axe'].poseProfileId, 'one-handed-swing');
assert.equal(VISIBLE_WEAPON_ASSETS['battle-axe'].grip.sizePercent, 100);
assert.equal(VISIBLE_WEAPON_ASSETS['two-handed-sword'].poseProfileId,'two-handed-swing');
assert.equal(VISIBLE_WEAPON_ASSETS['two-handed-sword'].asset,'assets/models/weapons/two-handed-swords/medieval-two-handed-sword.glb');
assert.equal(VISIBLE_WEAPON_ASSETS['two-handed-sword'].grip.sizePercent,100);
assert.equal(VISIBLE_WEAPON_ASSETS['two-handed-sword'].handsRequired,2);
assert.deepEqual(VISIBLE_WEAPON_ASSETS['two-handed-sword'].secondaryGrip,[0,0.95,0]);
assert.deepEqual(VISIBLE_WEAPON_ASSETS['battle-axe'].primaryAxis, [4, 5, 0]);
assert.deepEqual(VISIBLE_WEAPON_ASSETS['battle-axe'].grip.rotationDegrees, [-129, -90, 0]);
assert.equal(VISIBLE_SHIELD_ASSETS['round-wooden-shield'].attachmentBone,'mixamorig:LeftHand');
assert.equal(VISIBLE_SHIELD_ASSETS['round-wooden-shield'].sourceSha256,'4a0bad4a77b3e5a086576b00e8890ef5f0c2417ea423559ef7196acd8a488928');
assert.equal(VISIBLE_SHIELD_ASSETS['round-wooden-shield'].asset,'assets/models/shields/round-wooden-shield.glb');
assert.equal(VISIBLE_SHIELD_ASSETS['round-wooden-shield'].assetSha256,'4a0bad4a77b3e5a086576b00e8890ef5f0c2417ea423559ef7196acd8a488928');
assert.deepEqual(VISIBLE_SHIELD_ASSETS['round-wooden-shield'].mount.position,[0,0,0.04]);
assert.deepEqual(VISIBLE_SHIELD_ASSETS['round-wooden-shield'].mount.rotationDegrees,[0,0,0]);
const sword = appearanceRecipeForMob(carl, { modelId: 'dungeon-crawler-carl-v2-ual2-sword-test', bodyReferenceHeightInches: 76 });
assert.equal(sword.equipment.appearanceId, 'flaming-sword-5');
assert.equal(sword.shield.appearanceId,'round-wooden-shield');
assert.equal(sword.animation.semanticId,'one-handed-shield');
assert.equal(sword.animation.resolvedId,'one-handed-swing');
assert.ok(sword.animation.spriteFamilySignature.startsWith('humanoid-sprite-family-v1-'));
const k1 = appearanceCacheKey(sword), k2 = appearanceCacheKey(structuredClone(sword));
assert.equal(k1, k2);
const cache = new MobAppearanceCache(2); cache.set(k1, { id: 'sword-set' }); assert.equal(cache.get(k1).id, 'sword-set');
const noShieldCarl=structuredClone(carl); noShieldCarl.inventory[2].equipped=false;
const noShield=appearanceRecipeForMob(noShieldCarl,{modelId:'dungeon-crawler-carl-v2-ual2-sword-test',bodyReferenceHeightInches:76});
assert.equal(noShield.shield,null);
assert.equal(noShield.animation.semanticId,'one-handed-swing');
assert.notEqual(appearanceCacheKey(noShield),k1);
const axeCarl = structuredClone(carl); axeCarl.inventory[0].equipped = false; axeCarl.inventory[1].equipped = true;
const axe = appearanceRecipeForMob(axeCarl, { modelId: 'dungeon-crawler-carl-v2-ual2-sword-test', bodyReferenceHeightInches: 76 });
assert.equal(axe.equipment.appearanceId, 'battle-axe');
assert.notEqual(appearanceCacheKey(axe), k1);
const pkg = createWeaponPoseProfilePackage({
  profile: { id: 'one-handed-swing-v1', name: 'One-handed swinging weapon', revision: 1, visualClass: 'battle-axe' },
  mob: { type: 'fighter', name: 'Dungeon Crawler Carl', heightInches: 76 },
  model: { id: 'dungeon-crawler-carl-v2-ual2-sword-test', bodyReferenceHeightInches: 76 },
  equipment: axe.equipment,
  poses: WEAPON_POSE_PROFILES['one-handed-swing-v1'].poses,
  combatMappings: { ready: 'ready', attack: 'attack', prone: 'prone' },
  studio: { resolutionPercent: 100, modelScalePercent: 100 }
});
assert.equal(pkg.mob.heightInches, 76);
assert.equal(pkg.poses.attack.animation, 'UAL2_Sword_Regular_A');
console.log('PASS mob appearance first pass');
const spearRecipe=appearanceRecipeForMob({...carl,inventory:[{name:'Spear',slot:'weapon',equipped:true,appearanceId:'spear'}]}, {modelId:'dungeon-crawler-carl-v3'});
assert.match(spearRecipe.equipment.assetSha256,/^[a-f0-9]{64}$/);
const oldSpearRecipe=structuredClone(spearRecipe);
delete oldSpearRecipe.equipment.assetSha256;
assert.notEqual(appearanceCacheKey(spearRecipe),appearanceCacheKey(oldSpearRecipe),'Corrected spear texture invalidates cached combat sprites');

const bowRecipe=appearanceRecipeForMob({...carl,inventory:[{name:'Recurve Bow',slot:'weapon',equipped:true,appearanceId:'recurve-bow'}]}, {modelId:'dungeon-crawler-carl-v3'});
assert.equal(bowRecipe.equipment.attachmentBone,'mixamorig:LeftHand');
assert.equal(bowRecipe.equipment.poseProfileId,'bow');
assert.equal(bowRecipe.equipment.handsRequired,2);
assert.match(bowRecipe.equipment.assetSha256,/^[a-f0-9]{64}$/);
const crossbowRecipe=appearanceRecipeForMob({...carl,inventory:[{name:'Crossbow',slot:'weapon',equipped:true,appearanceId:'crossbow'}]}, {modelId:'dungeon-crawler-carl-v3'});
assert.equal(crossbowRecipe.equipment.attachmentBone,'mixamorig:RightHand');
assert.equal(crossbowRecipe.equipment.poseProfileId,'direct-fire');
assert.equal(crossbowRecipe.equipment.handsRequired,2);
assert.match(crossbowRecipe.equipment.assetSha256,/^[a-f0-9]{64}$/);
assert.notEqual(appearanceCacheKey(crossbowRecipe),appearanceCacheKey(bowRecipe));

for (const [id,profile,hands] of [['wooden-staff','two-handed-swing',2],['short-sword','one-handed-thrust',1],['dagger','one-handed-thrust',1]]) {
 const recipe=appearanceRecipeForMob({...carl,inventory:[{name:id,slot:'weapon',equipped:true,appearanceId:id}]},{modelId:'dungeon-crawler-carl-v3'});
 assert.equal(recipe.equipment.attachmentBone,'mixamorig:RightHand');
 assert.equal(recipe.equipment.poseProfileId,profile);assert.equal(recipe.equipment.handsRequired,hands);
 assert.match(recipe.equipment.assetSha256,/^[a-f0-9]{64}$/);
 const stale=structuredClone(recipe);delete stale.equipment.assetSha256;
 assert.notEqual(appearanceCacheKey(recipe),appearanceCacheKey(stale));
}

const wizardRecipe=appearanceRecipeForMob({...carl,inventory:[{name:'Wizard Staff Grip',slot:'weapon',equipped:true,appearanceId:'wizard-staff-grip'}]},{modelId:'dungeon-crawler-carl-v3'});
assert.equal(wizardRecipe.equipment.handsRequired,1);assert.equal(wizardRecipe.equipment.secondaryGrip,null);
assert.equal(wizardRecipe.animation.semanticId,'wizard-staff-grip');
assert.equal(wizardRecipe.equipment.asset,VISIBLE_WEAPON_ASSETS['wooden-staff'].asset);
assert.notEqual(appearanceCacheKey(wizardRecipe),appearanceCacheKey(appearanceRecipeForMob({...carl,inventory:[{name:'Wooden Staff',slot:'weapon',equipped:true,appearanceId:'wooden-staff'}]},{modelId:'dungeon-crawler-carl-v3'})));
