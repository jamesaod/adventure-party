import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveCombatWeaponMount } from '../js/combat-weapon-mount.mjs';

const catalog = JSON.parse(readFileSync(new URL('../data/studio-models.json', import.meta.url),'utf8'));
const preset = {position:[0.015,0.05,0.005],rotation:[0,-90,0],defaultSizePercent:100};
const equipped = {
  studioId:'medieval-sword',
  grip:{position:preset.position,rotationDegrees:preset.rotation,sizePercent:100}
};
const warrior = catalog.weaponAttachmentProfiles['tripo-woman-warrior-one-hand-sword-v1'];
const orc = catalog.weaponAttachmentProfiles['tripo-mixamo-orc-one-hand-sword-upward-v2'];
const saved = {rightHand:'medieval-sword',position:[-0.025,0.070,0.015],rotation:[12,-85,179],sizePercent:125};
const settings = {equipment:saved,weaponAttachmentProfile:warrior};
assert.deepEqual(resolveCombatWeaponMount(equipped,settings,preset),{
  position:saved.position,rotation:saved.rotation,sizePercent:125,shaftRollDegrees:0
},'Latest captured grip wins, including saved sword size');
assert.deepEqual(resolveCombatWeaponMount(equipped,{weaponAttachmentProfile:warrior},preset),{
  position:[-0.010,0.065,0.010],rotation:[0,-90,180],sizePercent:100,shaftRollDegrees:0
},'Woman Warrior catalog grip is the default even without a saved slider adjustment');
assert.deepEqual(resolveCombatWeaponMount(equipped,{weaponAttachmentProfile:orc},preset).rotation,[-29,-55,175],
  'Orc still uses its own scoped model profile');
assert.deepEqual(resolveCombatWeaponMount(equipped,{
  equipment:{...saved,rightHand:'battle-axe'},weaponAttachmentProfile:warrior
},preset).position,warrior.position,'Unrelated saved weapon must not override the correct model preset');
const axe={studioId:'battle-axe',grip:{position:[0.01,0.02,0.03],rotationDegrees:[-129,-90,0],sizePercent:100}};
assert.deepEqual(resolveCombatWeaponMount(axe,settings,{
  position:[0.01,0.02,0.03],rotation:[-129,-90,0],defaultSizePercent:100
}).rotation,[-129,-90,0],'Axe must never inherit the Woman Warrior sword grip');
assert.deepEqual(resolveCombatWeaponMount(equipped,{},preset).rotation,preset.rotation,
  'Without saved/model-specific settings the universal weapon preset remains intact');

// Exercise the exact IndexedDB record routing from the Studio's Test in combat
// handoff. The generic workspace is deliberately incomplete and lower quality.
globalThis.location = {href:'https://example.test/candidate/index.html?studioSprite=draft'};
const capture = clip => ({
  width:32,height:40,renderWidth:10,renderHeight:12.5,anchorX:16,anchorY:34,
  raw:new Uint8Array(32*40*6*4),clip,time:0.25,
  modelScalePercent:100,hexScalePercent:109,layout:{id:'single',resolutionPercent:100}
});
const matching = {
  version:1,name:'Woman Warrior',savedAt:3210,
  style:{brightness:1,contrast:1,hue:0,saturation:1,outline:0,outlineInches:1.875},
  settings:{
    libraryModelId:'woman-warrior-mixamo-sword-shield-full-17',
    mobType:'fighter',hexScalePercent:109,modelScalePercent:100,
    equipment:saved,shield:{leftHandShield:'none'},
    lighting:{ambientIntensity:1,keyIntensity:2.3},
    frameHeight:6,center:[0,2,0],placement:{position:[0,0,0],scale:1}
  },
  captures:{
    ready:capture('Mixamo_sword_and_shield_idle'),
    attack:capture('Mixamo_sword_and_shield_attack'),
    prone:capture('Mixamo_sword_and_shield_death'),
    'casting-windup':{...capture('Spell Wind Up'),clipSourceId:'uploaded:cast-spell:0',time:0.65},
    cast:{...capture('Magic Attack'),clipSourceId:'uploaded:magic-attack:0',time:1.667}
  }
};
const incorrect = {version:1,name:'Another model',style:matching.style,
  settings:{...matching.settings,libraryModelId:'new-carl-tripo-source'},
  captures:{}};
const draft={manifest:{frame:{width:32,height:40,renderWidth:10,renderHeight:12.5}}};
const records = {'combat-workspace':matching,'workspace':incorrect,'current':draft};
globalThis.indexedDB={
  open() {
    const req={result:{
      transaction() {return {objectStore() {
        return {get(key) {
          const getReq={result:records[key] || null};
          queueMicrotask(()=>getReq.onsuccess?.());
          return getReq;
        }};
      }};},
      close(){}
    }};
    queueMicrotask(()=>req.onsuccess?.());
    return req;
  }
};
globalThis.fetch=async()=>({ok:true,json:async()=>catalog});
const {loadCombatPoseRecipe}=await import('../js/combat-pose-recipe.mjs');
const result=await loadCombatPoseRecipe({mobType:'fighter',fromCombat:true});
assert.equal(result.model.modelId,'woman-warrior-mixamo-sword-shield-full-17');
assert.equal(result.renderSettings.frame.width,32);
assert.equal(result.renderSettings.frame.renderWidth,10);
assert.deepEqual(result.renderSettings.equipment,saved);
assert.deepEqual(result.renderSettings.weaponAttachmentProfile.position,warrior.position);
assert.equal(result.poseProfile.poses.attack.animation,'Mixamo_sword_and_shield_attack');
assert.equal(result.poseProfile.poses['casting-windup'].timeSeconds,0.65);
assert.equal(result.poseProfile.poses.cast.sourceId,'uploaded:magic-attack:0');
assert.equal(result.poseProfile.poses.attack.animation,'Mixamo_sword_and_shield_attack','Casting must not overwrite a weapon attack');
const other=await loadCombatPoseRecipe({mobType:'fighter',fromCombat:false});
assert.equal(other.source,'built-in-profile','Unrelated global workspace must not replace the Studio combat draft');
draft.manifest.frame.renderWidth=5;
await assert.rejects(loadCombatPoseRecipe({mobType:'fighter',fromCombat:true}),/frame dimensions differ/,
  'Never silently downgrade to a lower-resolution replacement');
draft.manifest.frame.renderWidth=10;

// The paired v2 workspace may return to Magic while combat still uses the
// last selected physical group, plus exactly one shared copy of each pose.
const {upgradeCaptureWorkspace}=await import('../js/action-capture-groups.mjs');
const sharedWorkspace=upgradeCaptureWorkspace({...matching,settings:{...matching.settings,actionProfileId:'one-handed-swing'}});
sharedWorkspace.settings.actionProfileId='magic';
sharedWorkspace.settings.equipment={rightHand:'none'};
sharedWorkspace.profileEquipment={'one-handed-swing':{equipment:saved}};
sharedWorkspace.captures=sharedWorkspace.sharedActionGroups.magic;
records['combat-workspace']=sharedWorkspace;
const sharedRecipe=await loadCombatPoseRecipe({mobType:'fighter',fromCombat:true});
assert.deepEqual(sharedRecipe.renderSettings.equipment,saved,'Magic selection must not replace the physical group grip');
assert.equal(sharedRecipe.poseProfile.id,'studio-captured-one-handed-swing-v1');
assert.equal(sharedRecipe.poseProfile.poses.attack.animation,'Mixamo_sword_and_shield_attack');
assert.equal(sharedRecipe.poseProfile.poses.cast.timeSeconds,1.667);
assert.equal(sharedRecipe.poseProfile.poses.prone.animation,'Mixamo_sword_and_shield_death');
records['combat-workspace']=matching;

// Every current source-only humanoid must carry the same uploaded animation
// policy through the paired workspace into the equipment render recipe.
const {appearanceRecipeForMob,appearanceCacheKey}=await import('../js/mob-appearance.mjs');
for(const id of ['dungeon-crawler-carl-v3','blond-scale-mail-woman','male-orc','orc-leader-male-uniformed']){
  const entry=catalog.models.find(model=>model.id===id);
  records['combat-workspace']={...matching,settings:{...matching.settings,
    libraryModelId:id,mobType:entry.mobType},captures:{ready:{...capture('Sword And Shield Idle'),
      clipSourceId:'uploaded:sword-and-shield-idle:0'}}};
  const captured=await loadCombatPoseRecipe({mobType:entry.mobType,fromCombat:true});
  assert.equal(captured.model.modelId,id,`${id}: gear refresh retains the selected model`);
  assert.equal(captured.model.animationLibrary,'uploaded-fbx',`${id}: load its shared animations`);
  assert.equal(captured.poseProfile.poses.ready.animation,'Sword And Shield Idle');
  assert.equal(captured.poseProfile.poses.ready.timeSeconds,0.25);
  assert.deepEqual(captured.renderSettings.frame,result.renderSettings.frame);
  const unit={id:'player',type:entry.mobType,inventory:[
    {name:'Battle Axe',slot:'weapon',appearanceId:'battle-axe',equipped:true},
    {name:'Round Wooden Shield',slot:'shield',appearanceId:'round-wooden-shield',equipped:true}]};
  const context={...captured.model,poseProfile:captured.poseProfile,renderSettings:captured.renderSettings};
  const axeRecipe=appearanceRecipeForMob(unit,context);
  assert.equal(axeRecipe.model.animationLibrary,'uploaded-fbx');
  assert.equal(axeRecipe.model.id,id);
  assert.equal(axeRecipe.equipment.studioId,'battle-axe');
  assert.equal(axeRecipe.shield.studioId,'round-wooden-shield');
  unit.inventory[0].appearanceId='flaming-sword-5';
  assert.notEqual(appearanceCacheKey(axeRecipe),appearanceCacheKey(appearanceRecipeForMob(unit,context)),
    `${id}: the old sword cache cannot satisfy an axe render`);
}
records['combat-workspace']=matching;

const game=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const renderer=readFileSync(new URL('../js/combat-mob-renderer.mjs',import.meta.url),'utf8');
assert.ok(game.includes('if(!player.studioSpriteTest && typeof markMobAppearanceDirty'),
  'Entering Studio combat must display its original captured frames without an automatic re-render');
assert.ok(game.includes('fromCombat=!!unit.studioSpriteTest'), 'Gear swaps must use the paired Studio capture');
assert.ok(game.includes('markMobAppearanceDirty(fighter)'), 'Equipment changes still regenerate sprites');
assert.ok(renderer.includes('resolveCombatWeaponMount(recipe.equipment,recipe.renderSettings,preset)'));
assert.ok(renderer.includes('preserveThinSpriteDetails(sourceTopDown'),
  'Runtime continues preserving fine weapon pixels after native downsampling');
assert.ok(renderer.includes('antialias:true'),'Studio and combat must share source antialiasing');
console.log('PASS paired Studio captures, catalog animation libraries, exact frames and equipment refresh across all current humanoids');
