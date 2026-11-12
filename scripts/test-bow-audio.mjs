import assert from 'node:assert/strict';
import {combatPresentationTestServices} from './combat-presentation-test-context.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const read=file=>fs.readFileSync(file,'utf8');
function declaration(file,name){
 const source=read(file),match=new RegExp('(?:^|\\n)((?:async )?function '+name+'\\()').exec(source);
 assert(match,'Missing '+name);const start=match.index+(source[match.index]==='\n'?1:0);
 for(let end=source.indexOf('}',start);end>=0;end=source.indexOf('}',end+1)){
  const text=source.slice(start,end+1);try{new vm.Script('('+text+')');return text;}catch{}
 }throw Error('Cannot extract '+name);
}
// Decode/cache, scheduled draw, mute, late loading, scene changes and cancellation.
function audioHarness({deferred=false}={}){
 let now=0,fetches=0,decodes=0,resolveBytes;const events=[],durations={draw:1.7,release:.27,flight:.29,hit:.5139,miss:.2599};
 const pending=new Promise(resolve=>resolveBytes=resolve);
 const context={state:'running',currentTime:10,
  async decodeAudioData(bytes){decodes++;const role=new TextDecoder().decode(bytes);return {role,duration:durations[role]};},
  createGain(){return {connect(){},disconnect(){},gain:{setValueAtTime(){},linearRampToValueAtTime(){}}};},
  createBufferSource(){return {connect(){},disconnect(){},start(...args){events.push({role:this.buffer.role,args,source:this});},stop(){this.stopped=true;}};}};
 const c=vm.createContext({...combatPresentationTestServices(),console,performance:{now:()=>now},audioEnabled:true,audioCtx:context,sfxGain:{},currentScreen:'combat',game:{},
  fetch:async url=>{fetches++;const role=/\/([a-z]+)\.wav/.exec(url)[1];return {ok:true,arrayBuffer:async()=>{if(deferred)await pending;return new TextEncoder().encode(role).buffer;}};}});
 vm.runInContext(read('js/bow-audio.js'),c);
 return {c,context,events,advance:ms=>now+=ms,ready:()=>c.preloadBowAudio(context),resolve:()=>resolveBytes(),counts:()=>({fetches,decodes})};
}
const audio=audioHarness();await audio.ready();await audio.ready();assert.deepEqual(audio.counts(),{fetches:5,decodes:5});
const archer={missileCatalogId:'bow-short',missileAmmoQuantity:3};
const draw=audio.c.playBowDrawSound(archer,2500);assert.equal(audio.events[0].role,'draw');assert.equal(audio.events[0].args[0],10.8);assert.equal(audio.events[0].args[2],1.7);draw.stop();assert(audio.events[0].source.stopped);
const voices=audio.c.playBowReleaseSound(archer);audio.c.playBowImpactSound(archer,true);audio.c.playBowImpactSound(archer,false);
assert.deepEqual(audio.events.map(e=>e.role),['draw','release','flight','hit','miss']);voices.stop();assert(audio.events[1].source.stopped&&audio.events[2].source.stopped);
audio.c.stopBowSounds();assert(audio.events.every(e=>e.source.stopped));
audio.c.audioEnabled=false;audio.c.playBowReleaseSound(archer);assert.equal(audio.events.length,5);
audio.c.audioEnabled=true;audio.c.playBowReleaseSound({missileCatalogId:'crossbow-light'});audio.c.playBowReleaseSound({missileCatalogId:'sling'});assert.equal(audio.events.length,5);
audio.c.playBowDrawSound({...archer,missileAmmoQuantity:0},2500);assert.equal(audio.events.length,5);
for(const mode of ['mute','scene','late','cancel']){
 const h=audioHarness({deferred:true});const ready=h.ready(),voice=h.c.playBowSample('hit');
 if(mode==='mute'){h.c.audioEnabled=false;h.c.stopBowSounds();h.c.audioEnabled=true;}
 if(mode==='scene')h.c.game={};if(mode==='late')h.advance(400);if(mode==='cancel')voice.stop();
 h.resolve();await ready;await Promise.resolve();assert.equal(h.events.length,0,mode+' must not replay stale samples');
}
// Run the actual missile, projectile and empty-hex owner functions with rules mocked.
function combatHarness({hit=true,mirror=false,cancel=false,environment=null,bow=true}={}){
 let now=0;const trace=[];
 const a={id:'a',name:'Archer',alive:true,x:0,y:0,missileCatalogId:bow?'bow-short':'crossbow-light',missileAmmoQuantity:4,rangedWeapon:'Bow',shotsRemaining:2};
 const b={id:'b',name:'Target',alive:true,x:2,y:0,hp:20};
 const c=vm.createContext({console,performance:{now:()=>now},game:{over:false,active:'a'},projectileFx:null,COMBAT_MESSAGE_MIN_HOLD_MS:1000,COMBAT_MESSAGE_DISPLAY_MS:1000,
  usesSelectedBowAudio:u=>u.missileCatalogId.startsWith('bow-'),
  playBowReleaseSound:u=>{if(u.missileCatalogId.startsWith('bow-'))trace.push('release','flight');return {stop:()=>trace.push('stop-flight')};},
  playBowImpactSound:(u,success)=>{if(u.missileCatalogId.startsWith('bow-'))trace.push(success?'flesh':'mud');},
  playAttackSound:()=>trace.push('old-hit'),playMissSound:()=>trace.push('old-miss'),
  prepareUnitAttackWindup:async(_u,options)=>{if(options?.bowAudio)trace.push('draw');},
  projectilePathBlocked:()=>false,longbowRangeBand:()=>({penalty:0,band:'short',distance:2}),attackPositionData:()=>({label:'front'}),
  consumeMissileAmmo:u=>u.missileAmmoQuantity>0&&!!u.missileAmmoQuantity--,
  triggerUnitAttackPose:()=>trace.push('pose'),d:()=>12,dexterityAdjustments:()=>({missile:0}),attackEffectModifier:()=>0,effectiveArmorClassForAttack:()=>10,
  resolveMissileAttackD20:()=>({hit,modifiedRoll:12}),formatSignedAdjustment:()=>'+0',
  interceptWithMirrorImage:()=>mirror,getMissileCatalogEntry:()=>({}),damageExpressionForSize:()=> '1d6',rollDiceExpression:()=>({total:3}),physicalDamageEffectModifier:()=>0,
  onUnitDamaged:()=>trace.push('damage'),hexCenter:(x,y)=>({x:x*80,y:y*80}),combatEffectDuration:x=>x,arrowMissEndpoint:()=>({x:170,y:0}),
  resolveEnvironmentArrow:()=>environment,environmentArrowScreen:()=>({x:170,y:0}),finishEnvironmentArrow:async()=>trace.push('environment'),
  presentCombatFrame:async()=>{now+=100;if(cancel)c.projectileFx=null;else if(c.projectileFx?.t===1)trace.push('arrived');},
  window:{AdventurePartyCombatResults:{physicalHit(){}}},
  environmentActionInProgress:false,spellCastInProgress:false,combatActionPauseRemaining:()=>0,unitHasRangedWeaponInHand:()=>true,rejectWindowTarget:()=>false,
  unitAtHex:()=>null,isHexVisibleToFriendlyParty:()=>true,r226PreparePlayerAttackRate(){},exitAimMode(){},endTurn(){}});
 for(const name of ['focusRangedAttacker','focusRangedMissTarget','focusDamagedTargetIfOffscreen'])c[name]=async()=>{};
 for(const name of ['faceEntityToward','setUnitActionBanner','updateFacingForStep','updateUi','breakInvisibility','playNaturalAttackRollSound','setLastRoll','setCombatMessage','log','flashAttack','draw'])c[name]=()=>{};
 for(const name of ['resolveLongbowHit','r226ProtectedLongbowMiss'])vm.runInContext(declaration('js/combat-missile-actions.js',name),c);
 vm.runInContext(declaration('js/combat-effect-animation.js','animateArrowProjectile'),c);
 vm.runInContext(declaration('js/combat-environment-actions.js','fireAtEnvironmentHex'),c);
 return {c,a,b,trace};
}
for(const controller of ['player','mob']){
 const h=combatHarness();h.a.controller=controller;const result=await h.c.resolveLongbowHit(h.a,h.b);
 assert(result.hit);assert.equal(h.a.missileAmmoQuantity,3);assert.equal(h.b.hp,17);
 assert.deepEqual(h.trace,['draw','pose','release','flight','arrived','flesh','damage']);
}
for(const kind of [null,'ground','wall','window','strayTarget']){
 const h=combatHarness({hit:false,environment:kind?{kind}:null});await h.c.resolveLongbowHit(h.a,h.b);
 assert.equal(h.trace.filter(e=>e==='mud').length,1);assert(!h.trace.includes('flesh')&&!h.trace.includes('old-miss'));
 assert(h.trace.indexOf('mud')>h.trace.indexOf('arrived'));assert.equal(h.b.hp,20);
}
const mirror=combatHarness({mirror:true});assert((await mirror.c.resolveLongbowHit(mirror.a,mirror.b)).mirrorImage);assert(mirror.trace.includes('mud')&&!mirror.trace.includes('flesh'));assert.equal(mirror.b.hp,20);
const protectedShot=combatHarness({environment:{kind:'ground'}});await protectedShot.c.r226ProtectedLongbowMiss(protectedShot.a,protectedShot.b,'Protected');assert.equal(protectedShot.trace.filter(x=>x==='mud').length,1);assert.equal(protectedShot.a.missileAmmoQuantity,4);
const scenery=combatHarness({environment:{kind:'wall'}});await scenery.c.fireAtEnvironmentHex(scenery.a,{x:3,y:0});assert.deepEqual(scenery.trace,['draw','pose','release','flight','arrived','mud','environment']);assert.equal(scenery.a.shotsRemaining,1);
const cancelled=combatHarness({cancel:true});assert((await cancelled.c.resolveLongbowHit(cancelled.a,cancelled.b)).cancelled);assert(cancelled.trace.includes('stop-flight'));assert(!cancelled.trace.some(e=>['flesh','mud','damage'].includes(e)));assert.equal(cancelled.b.hp,20);
for(const type of ['ammo','lane','range']){
 const h=combatHarness();if(type==='ammo')h.a.missileAmmoQuantity=0;if(type==='lane')h.c.projectilePathBlocked=()=>true;if(type==='range')h.c.longbowRangeBand=()=>({penalty:null});
 await h.c.resolveLongbowHit(h.a,h.b);assert.deepEqual(h.trace,[],type+' rejected before any sound');
}
const crossbow=combatHarness({bow:false});await crossbow.c.resolveLongbowHit(crossbow.a,crossbow.b);assert(crossbow.trace.includes('old-hit')&&!crossbow.trace.includes('flesh'));
// Existing generic/melee preparation stays silent; only bow action callers opt in.
const trace=[],w=vm.createContext({unitPoseDefinition:()=>({directionalSprites:{windup:{front:{image:{}}}},actionProfileId:'bow',windupDurationMs:2500}),setTemporaryUnitPose:()=>true,
 playBowDrawSound:(_u,duration)=>{trace.push(duration);return {stop:()=>trace.push('stop')};},sleep:async()=>{}});
vm.runInContext(declaration('js/adventure-party.js','prepareUnitAttackWindup'),w);await w.prepareUnitAttackWindup({});assert.deepEqual(trace,[]);await w.prepareUnitAttackWindup({},{bowAudio:true});assert.deepEqual(trace,[2500,'stop']);
const selected=JSON.parse(read('assets/audio/sfx/bow/selection.json')),roles={draw:'draw',release:'release',flight:'flight','hit-flesh':'hit','hit-ground':'miss'};
assert.equal(selected.selected.length,5);
for(const clip of selected.selected){assert.equal(clip.source.license,'CC0-1.0');assert.equal(crypto.createHash('sha256').update(fs.readFileSync('assets/audio/sfx/bow/'+roles[clip.role]+'.wav')).digest('hex'),clip.sha256);}
console.log('PASS selected bow audio: exact assets, one-time decode, draw/release/arrival timing, player/AI, hit/miss/mirror/protection/scenery, unchanged ammo/rules, mute and cancellation.');
