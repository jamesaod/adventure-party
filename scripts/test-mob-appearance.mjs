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
assert.equal(sword.shield.appearanceId,'round-wooden-shield');\nassert.equal(sword.animation.semanticId,'one-handed-shield');\nassert.equal(sword.animation.resolvedId,'one-handed-swing');\nassert.ok(sword.animation.spriteFamilySignature.startsWith('humanoid-sprite-family-v1-'));
const k1 = appearanceCacheKey(sword), k2 = appearanceCacheKey(structuredClone(sword));
assert.equal(k1, k2);
const cache = new MobAppearanceCache(2); cache.set(k1, { id: 'sword-set' }); assert.equal(cache.get(k1).id, 'sword-set');
const noShieldCarl=structuredClone(carl); noShieldCarl.inventory[2].equipped=false;
const noShield=appearanceRecipeForMob(noShieldCarl,{modelId:'dungeon-crawler-carl-v2-ual2-sword-test',bodyReferenceHeightInches:76});
assert.equal(noShield.shield,null);\nassert.equal(noShield.animation.semanticId,'one-handed-swing');
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