import assert from 'node:assert/strict';
import {
  inches, formatHeight, MOB_HEIGHTS, applyMobHeight, bodyScaleForHeight,
  WEAPON_POSE_PROFILES, VISIBLE_WEAPON_ASSETS, VISIBLE_SHIELD_ASSETS, appearanceRecipeForMob,
  appearanceCacheKey, MobAppearanceCache
} from '../js/mob-appearance.mjs';
import { createWeaponPoseProfilePackage } from '../js/weapon-pose-profile-export.mjs';

assert.equal(inches(6, 3), 75);
assert.equal(formatHeight(75), '6′3″');
assert.equal(MOB_HEIGHTS.fighter.heightInches, 75);
const carl = applyMobHeight({ id: 'player', type: 'fighter', name: 'Dungeon Crawler Carl', inventory: [
  { name: 'Flaming Sword +5', slot: 'weapon', equipped: true, appearanceId: 'flaming-sword-5' },
  { name: 'Battle Axe', slot: 'weapon', equipped: false, appearanceId: 'battle-axe' },
  { name: 'Bronze Round Shield', slot: 'shield', equipped: true, appearanceId: 'bronze-round-shield' }
]});
assert.equal(carl.heightInches, 75);
assert.equal(bodyScaleForHeight({ targetHeightInches: 75, referenceHeightInches: 75 }), 1);
assert.equal(WEAPON_POSE_PROFILES['one-handed-swing-v1'].poses.attack.timeSeconds, 0.30);
assert.equal(VISIBLE_WEAPON_ASSETS['battle-axe'].poseProfileId, 'one-handed-swing-v1');
assert.equal(VISIBLE_WEAPON_ASSETS['battle-axe'].grip.sizePercent, 100);
assert.deepEqual(VISIBLE_WEAPON_ASSETS['battle-axe'].primaryAxis, [4, 5, 0]);
assert.deepEqual(VISIBLE_WEAPON_ASSETS['battle-axe'].grip.rotationDegrees, [-129, -90, 0]);
assert.equal(VISIBLE_SHIELD_ASSETS['bronze-round-shield'].attachmentBone,'mixamorig:LeftHand');
assert.equal(VISIBLE_SHIELD_ASSETS['bronze-round-shield'].sourceSha256,'c908d84a286a005a050934f0b5bb409c6d42b2cbfc85ae0669637802375994e0');
const sword = appearanceRecipeForMob(carl, { modelId: 'dungeon-crawler-carl-v2-ual2-sword-test', bodyReferenceHeightInches: 75 });
assert.equal(sword.equipment.appearanceId, 'flaming-sword-5');
assert.equal(sword.shield.appearanceId,'bronze-round-shield');
const k1 = appearanceCacheKey(sword), k2 = appearanceCacheKey(structuredClone(sword));
assert.equal(k1, k2);
const cache = new MobAppearanceCache(2); cache.set(k1, { id: 'sword-set' }); assert.equal(cache.get(k1).id, 'sword-set');
const noShieldCarl=structuredClone(carl); noShieldCarl.inventory[2].equipped=false;
const noShield=appearanceRecipeForMob(noShieldCarl,{modelId:'dungeon-crawler-carl-v2-ual2-sword-test',bodyReferenceHeightInches:75});
assert.equal(noShield.shield,null);
assert.notEqual(appearanceCacheKey(noShield),k1);
const axeCarl = structuredClone(carl); axeCarl.inventory[0].equipped = false; axeCarl.inventory[1].equipped = true;
const axe = appearanceRecipeForMob(axeCarl, { modelId: 'dungeon-crawler-carl-v2-ual2-sword-test', bodyReferenceHeightInches: 75 });
assert.equal(axe.equipment.appearanceId, 'battle-axe');
assert.notEqual(appearanceCacheKey(axe), k1);
const pkg = createWeaponPoseProfilePackage({
  profile: { id: 'one-handed-swing-v1', name: 'One-handed swinging weapon', revision: 1, visualClass: 'battle-axe' },
  mob: { type: 'fighter', name: 'Dungeon Crawler Carl', heightInches: 75 },
  model: { id: 'dungeon-crawler-carl-v2-ual2-sword-test', bodyReferenceHeightInches: 75 },
  equipment: axe.equipment,
  poses: WEAPON_POSE_PROFILES['one-handed-swing-v1'].poses,
  combatMappings: { ready: 'ready', attack: 'attack', prone: 'prone' },
  studio: { resolutionPercent: 100, modelScalePercent: 100 }
});
assert.equal(pkg.mob.heightInches, 75);
assert.equal(pkg.poses.attack.animation, 'UAL2_Sword_Regular_A');
console.log('PASS mob appearance first pass');