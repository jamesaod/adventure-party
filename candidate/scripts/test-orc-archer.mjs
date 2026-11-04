import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRepositoryMob,createRepositoryMobRegistry} from '../js/repository-mobs.mjs';
import {repositoryRestFrame} from '../js/repository-mob-frame.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const template=read('../data/mobs/orc-archer.unit-package.json'),catalog=read('../data/studio-models.json');
const api=createRepositoryMob(template,catalog);
for(const [roll,level,cls] of [[0,1,null],[.75,3,'fighter'],[.95,4,'fighter']]){
 const values=[roll,0];const unit=api.apply({type:'orc-archer'},()=>values.shift()??0);
 assert.equal(unit.level,level);assert.equal(unit.classId,cls);
 assert.equal(unit.inventory[0].catalogItemId,'recurve-bow');assert.equal(unit.inventory[1].catalogItemId,'shield-orc');assert.equal(unit.inventory[1].equipped,false);
 const recipe=api.recipe(unit);assert.equal(recipe.model.modelId,'orc-leader-male-uniformed');assert.equal(recipe.renderSettings.modelScalePercent,135);
 assert.equal(recipe.renderSettings.transform.fitRest,true);assert.equal(recipe.poseProfile.poses.attack.timeSeconds,.2555);
 assert.deepEqual(recipe.renderSettings.equipment,template.references.studioAppearance.equipment);
 assert.ok(Math.abs(recipe.renderSettings.frame.renderWidth-48*1.35*1.09)<1e-9);
}
assert.throws(()=>createRepositoryMobRegistry([template,template],catalog),/Duplicate/);
const frame=repositoryRestFrame([-1,0,-.2],[1,2,.2],.8);assert.deepEqual(frame.center,[0,1,0]);assert.ok(frame.frameHeight>2&&frame.frameHeight<5);
const source=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
function fn(name){const start=source.indexOf(`function ${name}(`);assert.ok(start>=0);const end=source.indexOf('\n}',start);return source.slice(source.slice(start-6,start)==='async '?start-6:start,end+2);}
function decl(name){const start=source.indexOf('const '+name+'=');return source.slice(start,source.indexOf('\n};',start)+3);}
const ctx={game:{over:false,round:1},projectilePathBlocked:()=>false,unitDistance:()=>3,attackPositionData:()=>({label:'front'}),focusRangedAttacker:async()=>{},setUnitActionBanner:()=>{},updateFacingForStep:()=>{},prepareUnitAttackWindup:async()=>{},triggerUnitAttackPose:()=>{},updateUi:()=>{},breakInvisibility:()=>{},d:()=>2,dexterityAdjustments:()=>({missile:0}),attackEffectModifier:()=>0,effectiveArmorClassForAttack:()=>10,resolveMissileAttackD20:()=>({hit:false}),playNaturalAttackRollSound:()=>{},setLastRoll:()=>{},formatSignedAdjustment:()=>'',animateArrowProjectile:async()=>{},focusRangedMissTarget:async()=>{},playMissSound:()=>{},log:()=>{},flashAttack:()=>{},setCombatMessage:()=>{}};
vm.createContext(ctx);vm.runInContext([decl('MISSILE_WEAPON_CATALOG'),decl('WEAPON_CATALOG'),...['getMissileCatalogEntry','getWeaponCatalogEntry','syncRepositoryMissileEquipment','consumeMissileAmmo','longbowRangeBand','longbowAttack'].map(fn)].join('\n'),ctx);
const unit=api.apply({alive:true},()=>0),target={alive:true};ctx.syncRepositoryMissileEquipment(unit);
assert.equal(unit.missileAmmoQuantity,10);assert.equal(unit.missileAmmoCatalogId,'arrows');assert.equal(unit.missileRangeIncrementHexes,5);
for(let i=9;i>=0;i--){await ctx.longbowAttack(unit,target);assert.equal(unit.missileAmmoQuantity,i);assert.equal(unit.inventory.at(-1).qty,i);ctx.syncRepositoryMissileEquipment(unit);assert.equal(unit.missileAmmoQuantity,i,'sync never refills spent ammunition');}
assert.equal((await ctx.longbowAttack(unit,target)).outOfAmmo,true);
unit.inventory[0].equipped=false;ctx.syncRepositoryMissileEquipment(unit);unit.inventory[0].equipped=true;ctx.syncRepositoryMissileEquipment(unit);assert.equal(unit.missileAmmoQuantity,0);
for(const [profile,ammo] of [['direct-fire','bolt-light'],['sling','sling-bullet']]){const other={repositoryMobId:'test',inventory:[{slot:'weapon',name:profile,equipped:true,weaponPoseProfileId:profile}]};ctx.syncRepositoryMissileEquipment(other);assert.equal(other.missileAmmoCatalogId,ammo);assert.equal(other.missileAmmoQuantity,10);}
const fresh=api.apply({alive:true},()=>0);ctx.syncRepositoryMissileEquipment(fresh);ctx.projectilePathBlocked=()=>true;await ctx.longbowAttack(fresh,target);assert.equal(fresh.missileAmmoQuantity,10);ctx.projectilePathBlocked=()=>false;ctx.unitDistance=()=>99;await ctx.longbowAttack(fresh,target);assert.equal(fresh.missileAmmoQuantity,10);
console.log('PASS Orc Archer package, weighted levels, carried shield, portable framing, source poses, ten consumed arrows, no refill, matching bolts/bullets and rejected-shot preservation');

// Load the real legacy factory wrapper too: it must forward the template ID.
const hazards=readFileSync(new URL('../js/r220-mob-hazard-awareness.js',import.meta.url),'utf8');
const wrapped={makeOrc:(index,position,id)=>({id})};vm.createContext(wrapped);
vm.runInContext(hazards.slice(hazards.indexOf('const r220BaseMakeOrc='),hazards.indexOf('const r220BaseMakeLargeMobTest=')),wrapped);
assert.equal(wrapped.makeOrc(0,{x:0,y:0},'orc-archer').id,'orc-archer');
