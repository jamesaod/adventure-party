import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readdirSync} from 'node:fs';
import {readCombatFixture as readFileSync} from './combat-test-source.mjs';
const engine=readFileSync('js/adventure-party.js','utf8');
const entries=['longbowAttack','slingAttack','castPreparedCombatSpell','activateAimTarget'];
const trace=[],actor={alive:true},target={id:'target'},selected={id:'selected'};let blocked=false,fail=false;
const c=vm.createContext({rejectWindowTarget:()=>{trace.push('admission');return blocked;},missileMeleeTarget:()=>{trace.push('select');return selected;},resolveLongbowAction:async(a,t)=>{assert.equal(t,selected);assert.equal(a.environmentMissileRoll,null);trace.push('resolver');a.environmentMissileRoll={roll:1};if(fail)throw Error('cancelled');return {hit:false};},resolveSlingAction:async()=>{trace.push('sling');return true;},spellCasterForAction:()=>actor,resolvePreparedSpellAction:async()=>{trace.push('spell');return true;},pendingAimAction:null,aimMode:true,aimCursor:{x:1,y:0},activePlayerControlledUnit:()=>actor,unitHasRangedWeaponInHand:()=>true,fireAtEnvironmentHex:async()=>{trace.push('empty-shot');return true;},resolveAimAction:async()=>{trace.push('aim');return true;}});
for(const name of entries){const start=engine.indexOf('async function '+name+'('),end=engine.indexOf('\nasync function ',start+1);vm.runInContext(engine.slice(start,end),c);}
await c.longbowAttack(actor,target);assert.deepEqual(trace,['admission','select','resolver']);assert(!('environmentMissileRoll' in actor));
trace.length=0;blocked=true;assert((await c.longbowAttack(actor,target)).blockedByObstacle);assert((await c.slingAttack(actor,target)).blockedByObstacle);assert.equal(await c.castPreparedCombatSpell({},target),false);assert.equal(await c.activateAimTarget(),false);assert.deepEqual(trace,Array(4).fill('admission'),'Reject before protection/result/ammo/casting resolvers');
blocked=false;fail=true;await assert.rejects(c.longbowAttack(actor,target),/cancelled/);assert(!('environmentMissileRoll' in actor),'Cleanup survives interrupted resolver');fail=false;
trace.length=0;actor.rangedWeapon='Bow';await c.activateAimTarget();assert.deepEqual(trace,['admission','empty-shot']);
trace.length=0;c.pendingAimAction={spellId:'magic-missile'};await c.activateAimTarget();assert.deepEqual(trace,['admission','aim'],'Volley target selection still uses existing AIM resolver');
trace.length=0;await c.castPreparedCombatSpell({},target);await c.slingAttack(actor,target);assert.deepEqual(trace,['admission','spell','admission','sling']);
for(const file of readdirSync('js').filter(n=>/\.(js|mjs)$/.test(n))){const source=readFileSync('js/'+file,'utf8');for(const name of entries)assert(!new RegExp('\\b'+name+'\\s*=\\s*(?:async\\s+)?(?:function|physical\\()').test(source),`${file} replaces stable ${name}`);}
assert.match(readFileSync('js/candidate-rev36-magic-missile-volley.js','utf8'),/return await castPreparedCombatSpell\(/,'Volley completion returns through public spell admission');
console.log('PASS stable public entry ownership, rejection before costs, melee selection order, cleanup, empty-hex AIM and spell-volley handoff');
const protection=readFileSync('js/combat-missile-actions.js','utf8');const hitResolver=c.resolveLongbowAction;c.resolveLongbowHit=hitResolver;let protectedShot=false;c.r226NormalMissileProtected=()=>{trace.push('protection');return protectedShot;};c.r226LineCrossesWindWall=()=>false;c.r226ProtectedLongbowMiss=async()=>{trace.push('protected-miss');return {hit:false,blockedByMagic:true};};const ps=protection.indexOf('async function resolveProtectedLongbow('),pe=protection.indexOf('async function r226ProtectedSlingMiss',ps);vm.runInContext(protection.slice(ps,pe),c);c.resolveLongbowAction=c.resolveProtectedLongbow;
trace.length=0;await c.longbowAttack(actor,target);assert.deepEqual(trace,['admission','select','protection','resolver']);
trace.length=0;protectedShot=true;await c.longbowAttack(actor,target);assert.deepEqual(trace,['admission','select','protection','protected-miss']);assert(!('environmentMissileRoll' in actor));
trace.length=0;blocked=true;await c.longbowAttack(actor,target);assert.deepEqual(trace,['admission'],'Intact window rejection precedes protection animation/ammo consumption');
console.log('PASS actual normal-missile protection composition remains behind admission and melee target selection');
