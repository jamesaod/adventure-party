import assert from 'node:assert/strict';
import {
  HUMANOID_ANIMATION_CATALOG_VERSION,HUMANOID_ANIMATION_GROUPS,HUMANOID_ANIMATION_IDS,
  resolveHumanoidAnimationProfile,poseProfileForHumanoid,resolveHumanoidAnimationState,
  humanoidSpriteFamilySignature,isHumanoidPoseAffectingCondition
} from '../js/humanoid-animation-catalog.mjs';

assert.equal(HUMANOID_ANIMATION_CATALOG_VERSION,1);
assert.deepEqual(HUMANOID_ANIMATION_GROUPS.weapon,[
  'one-handed-swing','one-handed-thrust','one-handed-shield','dual-wield',
  'two-handed-swing','two-handed-thrust','polearm','staff','bow','unarmed'
]);
assert.deepEqual(HUMANOID_ANIMATION_GROUPS.casting,['arcane-cast','divine-cast','innate-cast']);
assert.deepEqual(HUMANOID_ANIMATION_GROUPS.condition,['prone','sleep','held','stunned','dead']);
assert.equal(new Set(HUMANOID_ANIMATION_IDS).size,18);

const fallback=resolveHumanoidAnimationProfile('two-handed-swing');
assert.equal(fallback.semanticId,'two-handed-swing');
assert.equal(fallback.resolvedId,'one-handed-swing');
assert.equal(fallback.usedFallback,true);

const shieldProfile=poseProfileForHumanoid('one-handed-shield');
assert.equal(shieldProfile.semanticId,'one-handed-shield');
assert.equal(shieldProfile.resolvedId,'one-handed-swing');
assert.equal(shieldProfile.poses.attack.animation,'UAL2_Sword_Regular_A');

const unit={
  id:'fighter-1',type:'fighter',alive:true,hp:20,heightInches:76,
  inventory:[
    {slot:'weapon',equipped:true,appearanceId:'flaming-sword-5'},
    {slot:'shield',equipped:true,appearanceId:'round-wooden-shield'}
  ],
  buffs:[],debuffs:[]
};
const ready=resolveHumanoidAnimationState(unit,{equipmentAnimationId:'one-handed-swing'});
assert.equal(ready.semanticId,'one-handed-shield');
assert.equal(ready.pose,'ready');
const attack=resolveHumanoidAnimationState(unit,{equipmentAnimationId:'one-handed-swing',action:{type:'attack'}});
assert.equal(attack.semanticId,'one-handed-shield');
assert.equal(attack.pose,'attack');
assert.equal(
  humanoidSpriteFamilySignature(unit,{equipmentAnimationId:'one-handed-swing'}),
  humanoidSpriteFamilySignature(unit,{equipmentAnimationId:'one-handed-swing',action:{type:'attack'}}),
  'ready and attack reuse one sprite family'
);

const cast=resolveHumanoidAnimationState(unit,{
  equipmentAnimationId:'one-handed-swing',
  action:{type:'cast-spell',spellGroup:'Wizard'}
});
assert.equal(cast.semanticId,'arcane-cast');
assert.equal(cast.pose,'cast');
assert.notEqual(
  humanoidSpriteFamilySignature(unit,{equipmentAnimationId:'one-handed-swing'}),
  humanoidSpriteFamilySignature(unit,{equipmentAnimationId:'one-handed-swing',action:{type:'cast-spell',spellGroup:'Wizard'}}),
  'casting is a distinct sprite family'
);

unit.debuffs=[{id:'sleep'}];
const sleeping=resolveHumanoidAnimationState(unit,{equipmentAnimationId:'one-handed-swing',action:{type:'attack'}});
assert.equal(sleeping.semanticId,'sleep');
assert.equal(sleeping.resolvedId,'prone');
assert.equal(sleeping.pose,'state');

unit.debuffs=[{id:'unconscious'}];
assert.equal(resolveHumanoidAnimationState(unit,{equipmentAnimationId:'one-handed-swing'}).semanticId,'prone');
assert.equal(isHumanoidPoseAffectingCondition('unconscious'),true);
assert.equal(isHumanoidPoseAffectingCondition('blind'),false);

unit.alive=false;unit.hp=0;
const dead=resolveHumanoidAnimationState(unit,{action:{type:'cast-spell',spellGroup:'Wizard'}});
assert.equal(dead.semanticId,'dead');
assert.equal(dead.pose,'state');
console.log('PASS universal humanoid semantic animation catalog and resolver');

const paired={...unit,alive:true,hp:20,debuffs:[],inventory:[{slot:'weapon',equipped:true,appearanceId:'sword'},
  {slot:'offhand-weapon',equipped:true,appearanceId:'dagger'}]};
const pairedState=resolveHumanoidAnimationState(paired,{action:'attack'});
assert.equal(pairedState.semanticId,'dual-wield');
assert.equal(pairedState.resolvedId,'one-handed-swing');
assert.equal(poseProfileForHumanoid('dual-wield').poses.attack.animation,'UAL2_Sword_Regular_A');
