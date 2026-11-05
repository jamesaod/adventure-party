import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readCombatFixture as readFileSync} from './combat-test-source.mjs';
import {harness} from './test-combat-result-panel.mjs';
const module=readFileSync('js/combat-missile-actions.js','utf8'),engine=readFileSync('js/adventure-party.js','utf8');
const h=harness(),c=h.s,trace=[];vm.runInContext(module,c);
for(const name of ['longbowAttack','slingAttack']){const start=engine.indexOf('async function '+name+'('),end=engine.indexOf('\nasync function ',start+1);vm.runInContext(engine.slice(start,end),c);}
let blocked=false,protectedTarget=false,wind=false;
Object.assign(c,{rejectWindowTarget:()=>{trace.push('admit');return blocked;},missileMeleeTarget:(_a,b)=>{trace.push('select');return b;},getUnitEffect:(_u,id)=>id==='protection-from-normal-missiles'&&protectedTarget?{}:null,r226LineCrossesWindWall:()=>wind,resolveLongbowHit:async(a,b)=>{trace.push('bow');a.missileAmmoQuantity--;return {hit:false};},resolveSlingHit:async(a,b)=>{trace.push('sling');a.missileAmmoQuantity--;c.flashAttack(a,b,false);},focusRangedAttacker:async()=>{},faceEntityToward(){},triggerUnitAttackPose(){},breakInvisibility(){},playMissSound(){},animateArrowProjectile:async()=>trace.push('arrow'),setCombatMessage(){},log(){},COMBAT_MESSAGE_MIN_HOLD_MS:1000,projectilePathBlocked:()=>false,setUnitActionBanner(){},playSlingWindupSound(){},sleep:async()=>{},playSlingReleaseSound(){},animateSlingProjectile:async()=>trace.push('stone'),updateUi(){}});
h.a.alive=h.b.alive=true;h.a.missileAmmoQuantity=5;
for(const controller of ['player','mob']){h.a.controller=controller;trace.length=0;await c.longbowAttack(h.a,h.b);assert.deepEqual(trace,['admit','select','bow']);assert(!('environmentMissileRoll' in h.a));}
assert.equal(h.a.missileAmmoQuantity,3);h.advance(0);assert(h.history.some(x=>x.text?.includes('MISSES')),'Actual result context still presents a missile miss');
trace.length=0;blocked=true;await c.longbowAttack(h.a,h.b);await c.slingAttack(h.a,h.b);assert.deepEqual(trace,['admit','admit']);assert.equal(h.a.missileAmmoQuantity,3);
blocked=false;protectedTarget=true;trace.length=0;assert((await c.longbowAttack(h.a,h.b)).blockedByMagic);assert.deepEqual(trace,['admit','select','arrow']);assert.equal(h.a.missileAmmoQuantity,3,'Extraction preserves existing protected-bow cost');
protectedTarget=false;wind=true;trace.length=0;assert((await c.longbowAttack(h.a,h.b)).blockedByMagic);assert.deepEqual(trace,['admit','select','arrow']);wind=false;
trace.length=0;await c.slingAttack(h.a,h.b);assert.deepEqual(trace,['admit','sling']);assert.equal(h.a.missileAmmoQuantity,2);
protectedTarget=true;trace.length=0;await c.slingAttack(h.a,h.b);assert.deepEqual(trace,['admit','stone']);assert.equal(h.a.missileAmmoQuantity,1,'Preserve protected-sling cost');
trace.length=0;h.a.missileAmmoQuantity=0;await c.slingAttack(h.a,h.b);assert.deepEqual(trace,['admit'],'Empty sling never animates');
for(const source of [engine,readFileSync('js/r226-level3-systems.js','utf8'),readFileSync('js/combat-result-panel.js','utf8')])assert(!/resolve(?:Longbow|Sling)Action\s*=/.test(source),'Missile owner is never replaced by other scripts');
assert(!engine.includes('async function resolveLongbowHit('));assert(!engine.includes('async function resolveSlingHit('));
console.log('PASS extracted missile module with real result context: player/AI parity, blocked shots, protection/Wind Wall, preserved ammo costs and sling misses');
