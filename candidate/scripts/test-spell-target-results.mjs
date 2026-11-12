import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readCombatFixture as readFileSync} from './combat-test-source.mjs';
import {harness} from './test-combat-result-panel.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function setup(){
 const h=harness(),s=h.s,trace=[];
 Object.assign(h.a,{alive:true,hp:40,faction:'party'});
 for(const u of [h.b,h.c])Object.assign(u,{alive:true,hp:5,faction:'enemy',controller:'mob',x:2,y:1});
 Object.assign(s,{hoverHex:null,centerCameraOn:u=>trace.push({at:s.performance.now(),event:'focus',id:u.id}),draw(){},updateUi(){},presentCombatFrame:async()=>{},sleep:ms=>new Promise(resolve=>s.setTimeout(resolve,ms)),checkCombatVictory:()=>{trace.push({event:'victory'});return true;},checkPartyDefeat:()=>false,rollSpellSave:()=>({success:false,modifiedRoll:1,targetNumber:10}),log(){},registerElementalDamageFx:(u,t)=>trace.push({event:'element-fx',id:u.id,type:t}),markEnemyNeutralized:u=>trace.push({event:'neutralized',id:u.id}),isKoboldUnit:()=>false,activeEnemies:()=>[h.c],scheduleKoboldGroupMoraleCheck:()=>false,waitForCombatActionPause:async()=>{},onUnitDamaged:(u,n)=>{trace.push({at:s.performance.now(),event:'damage',id:u.id,hp:u.hp});s.r236ShowDamageText(u,n);}});
 vm.runInContext(read('js/combat-spell-results.js'),s);
 return {...h,trace};
}
async function complete(h,promise,max=20000){
 let done=false,error,value;
 promise.then(v=>{done=true;value=v;},e=>{done=true;error=e;});
 for(let i=0;!done&&i<max/20;i++){await Promise.resolve();h.advance(h.s.performance.now()+20);await Promise.resolve();}
 if(error)throw error;
 assert(done,'Production sequence completed without a stuck pause');return value;
}
const serial=setup();
const resolved=serial.s.presentSpellTargetResults(serial.a,[{unit:serial.b},{unit:serial.c}],({unit})=>{
 unit.hp=0;serial.s.onUnitDamaged(unit,5);unit.alive=false;serial.s.triggerDeathFx(unit);serial.s.checkCombatVictory();
});
assert.equal(await complete(serial,resolved),true);
assert.deepEqual(serial.trace.filter(e=>e.event==='focus').map(e=>e.id),['orc','gnoll']);
const damage=serial.trace.filter(e=>e.event==='damage');
assert.equal(damage.length,2);assert(damage[1].at-damage[0].at>=2000,'Next target waits for damage and the full death beat');
assert.deepEqual(serial.history.map(e=>e.text.split('\n').slice(-2).join(' ')),['HITTING FOR 5 POINTS OF DAMAGE','GOES DOWN AND IS DYING','HITTING FOR 5 POINTS OF DAMAGE','GOES DOWN AND IS DYING']);
assert.equal(serial.result.children.length,2,'New target clears the previous target, retaining its own damage and death');
assert(!serial.trace.some(e=>e.event==='victory'),'No mid-blast victory');serial.s.checkCombatVictory();assert.equal(serial.trace.at(-1).event,'victory');
const cone=setup();cone.s.rollSpellSave=u=>({success:u===cone.c,modifiedRoll:15,targetNumber:10});
assert.equal(await complete(cone,cone.s.resolveAoeDamageSpell({caster:cone.a,spellName:'Burning Hands',targets:[cone.b,cone.c],damage:6,damageType:'fire'})),true);
assert.equal(cone.b.hp,0);assert.equal(cone.c.hp,2,'Area helper preserves saved half damage');
assert(cone.history[1].text.includes('DYING'));assert(cone.history[2].text.includes('GNOLL'));
const staleSession=setup(),session=staleSession.s.captureSpellTargetResults();staleSession.s.window.AdventurePartyCombatBeats.clear();
assert.equal(await complete(staleSession,staleSession.s.presentSpellTargetResults(staleSession.a,[{unit:staleSession.b}],()=>assert.fail('Cancelled VFX must not apply damage'),session)),false);
const cancel=setup();
const interrupted=cancel.s.presentSpellTargetResults(cancel.a,[{unit:cancel.b},{unit:cancel.c}],({unit})=>{unit.hp=0;cancel.s.onUnitDamaged(unit,5);unit.alive=false;cancel.s.triggerDeathFx(unit);});
for(let i=0;i<10;i++){await Promise.resolve();cancel.advance(cancel.s.performance.now()+20);}
cancel.s.window.AdventurePartyCombatBeats.clear();cancel.s.game={};
assert.equal(cancel.s.checkCombatVictory(),true,'Old result holds do not block a new game');
assert.equal(await complete(cancel,interrupted),false);assert.equal(cancel.c.hp,5,'Cancelled spell never damages the next unit');assert(!cancel.cues.some(e=>e.cue==='death'),'Cancelled death presentation stays cancelled');
// Exercise the actual production Fireball resolver, including saves, immunity,
// friendly fire and completion, with only graphics/dice replaced by test doubles.
const fire=setup(),s=fire.s;
Object.assign(fire.a,{hp:6});Object.assign(fire.c,{immune:true,hp:9});
Object.assign(s,{spellCasterForAction:()=>fire.a,getSpellEntry:()=>({name:'Fireball'}),lineOfSightBlocked:()=>false,fireballRangeYards:()=>100,yardsToTacticalHexes:x=>x,hexDistance:()=>1,fireballRadiusHexes:()=>2,fireballBlastCells:()=>[],burnWebCells(){},livingUnitsInAreaCells:()=>[fire.b,fire.c,fire.a],commitSpellCast:()=>true,exitAimMode(){},setUnitActionBanner(){},animateFireballProjectile:async()=>{fire.trace.push({event:'projectile'});},fireballDamageDiceForCasterLevel:()=>6,rollDiceExpression:()=>({total:8}),unitImmuneToDamageType:u=>!!u.immune,setCombatMessage(){},playFireballExplosionSound(){},animateFireballExplosion:async()=>{assert(!fire.trace.some(e=>e.event==='damage'));fire.trace.push({event:'explosion-complete'});},finishTestSpellCast(){fire.trace.push({event:'finish'});}});
vm.runInContext(read('js/r233-multi-result-damage.js'),s);
assert.equal(await complete(fire,s.castFireballFromScroll({spellId:'fireball'}, {x:2,y:1})),true);
assert.deepEqual(fire.trace.filter(e=>e.event==='focus').map(e=>e.id),[],'Fireball does not pan between victims');
const fireHits=fire.trace.filter(e=>e.event==='damage');
assert.equal(fireHits[0].at,fireHits[1].at,'All Fireball damage resolves in the same frame');
const deathCues=fire.cues.filter(e=>e.cue==='death');
assert.equal(deathCues.length,2,'Both lethal targets present death');
assert.equal(deathCues[0].at,deathCues[1].at,'All Fireball deaths begin together');
assert.equal(fire.b.hp,0);assert.equal(fire.c.hp,9);assert.equal(fire.a.hp,0,'Captured friendly target resolves even after the last hostile falls');
assert(fire.trace.findIndex(e=>e.event==='explosion-complete')<fire.trace.findIndex(e=>e.event==='damage'));
assert(fire.history.some(e=>e.text.includes('IMMUNE TO FIRE')));assert.equal(fire.trace.at(-1).event,'finish');
// Window spillover halves the original roll before the ordinary save, once per unit.
fire.trace.length=0;
Object.assign(fire.b,{alive:true,hp:20});Object.assign(fire.c,{alive:true,hp:20,immune:false});Object.assign(fire.a,{alive:true,hp:20});
s.rejectWindowTarget=()=>true;
assert.equal(await complete(fire,s.castFireballFromScroll({spellId:'fireball'},{x:2,y:1})),false,'A blocked target is rejected before VFX or damage');
assert.equal(fire.b.hp,20);assert.equal(fire.c.hp,20);assert.equal(fire.a.hp,20);
s.rejectWindowTarget=()=>false;
s.animateFireballProjectile=async(_caster,target)=>assert.equal(target.x,2,'Valid casts retain the selected aim hex');
s.fireballBlastCells=target=>{assert.equal(target.x,2);return [];};
s.resolveFireballEnvironment=(_origin,cells)=>cells;
s.fireballEnvironmentDamageScale=u=>u===fire.a?1:.5;
s.rollSpellSave=u=>({success:u===fire.c,modifiedRoll:15,targetNumber:10});
assert.equal(await complete(fire,s.castFireballFromScroll({spellId:'fireball'},{x:2,y:1})),true);
assert.equal(fire.b.hp,16,'Half-strength spillover: 8 becomes 4');
assert.equal(fire.c.hp,18,'Successful save halves spillover again: 8 becomes 2');
assert.equal(fire.a.hp,12,'Full exposure still receives the full original roll');
// Extract the final (closure-owned) Magic Missile resolver, retaining its actual
// allocation, Shield/Mirror Image checks and per-target damage implementation.
const missile=setup(),m=missile.s;
Object.assign(m,{COMBAT_MESSAGE_MIN_HOLD_MS:1000,spellCasterForAction:()=>missile.a,getSpellEntry:()=>({name:'Magic Missile',missileDamage:'1d4+1'}),r36MissileCount:()=>3,r36ValidTarget:()=>true,commitSpellCast:()=>true,exitAimMode(){},faceEntityToward(){},setUnitActionBanner(){},r36AnimateVolley:async()=>{assert.equal(missile.b.hp,5);assert.equal(missile.c.hp,5);missile.trace.push({event:'volley-complete'});return true;},getUnitEffect:()=>null,interceptWithMirrorImage:()=>false,rollDiceExpression:()=>({total:3}),playMagicMissileHitSound:()=>missile.cues.push({at:m.performance.now(),cue:'missile'}),r36TargetSummary:()=>'',setCombatMessage(){},finishTestSpellCast(){missile.trace.push({event:'finish'});}});
const volley=read('js/candidate-rev36-magic-missile-volley.js'),start=volley.indexOf("  AdventurePartyCombatServices.register('castMagicMissileFromScroll'");
vm.runInContext(volley.slice(start,volley.indexOf('  /*\n    Keep Previewer Reset/Stop',start)),m);
assert.equal(await complete(missile,m.castMagicMissileFromScroll({magicMissileTargetIds:['orc','gnoll','orc']},missile.b)),true);
assert.deepEqual(missile.trace.filter(e=>e.event==='focus').map(e=>e.id),['orc','gnoll']);
assert.equal(missile.b.hp,0,'Two allocated missiles combine to six damage');assert.equal(missile.c.hp,2);
assert(missile.trace.findIndex(e=>e.event==='volley-complete')<missile.trace.findIndex(e=>e.event==='damage'));
assert.equal(missile.cues.filter(e=>e.cue==='missile').length,2,'One impact cue with each target damage beat');
assert(!missile.cues.some(e=>e.cue==='hit'),'No generic weapon-hit duplicate');
assert.equal(missile.trace.at(-1).event,'finish');
Object.assign(missile.b,{alive:true,hp:5});Object.assign(missile.c,{alive:true,hp:5});
m.getUnitEffect=u=>u===missile.b?{}:null;m.interceptWithMirrorImage=()=>true;
const beforeNegated=missile.history.length;
assert.equal(await complete(missile,m.castMagicMissileFromScroll({magicMissileTargetIds:['orc','gnoll','orc']},missile.b)),true);
assert.equal(missile.b.hp,5);assert.equal(missile.c.hp,5);
assert(missile.history[beforeNegated].text.includes('SHIELD NEGATES'));assert(missile.history[beforeNegated+1].text.includes('MIRROR IMAGES ABSORB'));
const lightning=setup(),l=lightning.s;
Object.assign(l,{TEST_SPELL_CASTER_LEVEL:6,R232_LIGHTNING_RANGE_HEXES:12,R232_LIGHTNING_MAX_REFLECTIONS:3,R233_RESULT_HOLD_MS:1000,spellCasterForAction:()=>lightning.a,getSpellEntry:()=>({name:'Lightning Bolt'}),commitSpellCast:()=>true,exitAimMode(){},setUnitActionBanner(){},r232TraceLightningBolt:()=>({segments:[],collisions:[],reflections:0}),rollDiceExpression:()=>({total:6}),r232UnitOccurrencesAlongTrace:()=>[{unit:lightning.b,segmentIndex:0},{unit:lightning.c,segmentIndex:1}],r233FocusTarget:async()=>{},combatEffectDuration:x=>x,playMagicEffectSound(){},unitImmuneToDamageType:()=>false,setCombatMessage(){},finishTestSpellCast:()=>lightning.trace.push({event:'finish'}),applySpellDamage:(caster,unit,amount)=>{
 assert.equal(l.r226LightningFx,null,'Lightning discharge has finished before damage');
 unit.hp=Math.max(0,unit.hp-amount);l.onUnitDamaged(unit,amount);
 const killed=unit.hp<=0;if(killed){unit.alive=false;l.triggerDeathFx(unit);l.checkCombatVictory();}
 return {damage:amount,killed};
}});
vm.runInContext(read('js/r233-lightning-result-pacing.js'),l);
assert.equal(await complete(lightning,l.r226CastLightningBolt({casterLevel:6},{x:2,y:1})),true);
const exposures=lightning.trace.filter(e=>e.event==='damage');assert.equal(exposures.length,2);assert(exposures[1].at-exposures[0].at>=2000);
assert.equal(lightning.trace.at(-1).event,'finish');
console.log('PASS post-VFX spell target focus, damage/death grouping, friendly fire, immunity, combined Magic Missile allocations, sound timing, deferred battle finish and cancellation');
