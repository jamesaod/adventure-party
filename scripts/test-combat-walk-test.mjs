import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync('js/combat-movement.js','utf8').split('/* Combat owner:')[0];
for(const cancel of [false,true]){
 let time=0,samples=[];const ctx={location:{search:'?walkTest=1'},URLSearchParams,game:{over:false},performance:{now:()=>time},unit:{x:2,y:3,alive:true}};
 ctx.presentCombatFrame=async()=>{samples.push({...ctx.unit.walkPresentation});time+=100;if(cancel)ctx.game={over:false};};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 const result=await vm.runInContext('presentWalkTestStep(unit,{x:3,y:3})',ctx);
 assert.equal(result,!cancel);assert.equal(ctx.unit.x,2);assert.equal(ctx.unit.y,3);
 assert.equal(ctx.unit.walkPresentation,undefined);assert.equal(ctx.adventurePartyWalkBusy,false);
 if(!cancel){assert.equal(samples[0].t,0);assert.equal(samples.at(-1).t,1);assert(samples.length>=7);}
}
console.log('PASS walk timing, full transition, integer gameplay coordinates, cancellation and input lock release');

// Exercise the registered production overrides, not only the base owner.
const overrides=fs.readFileSync('js/r219-combat-presentation.js','utf8');
for(const service of ['animateEntitySteps','animateMobAlongPath']){
 for(const mode of ['visible','heard','silent']){
  for(const cancelled of [false,true]){
   const unit={x:2,y:3,alive:true,controller:'mob'};
   let walkCalls=0,sleepCalls=0;
   const noop=()=>{};
   const ctx={prepareCombatReactiveWalkStep:(u,p)=>p,prepareCombatWalkPath:(u,p)=>p,game:{over:false},
    AdventurePartyCombatServices:{register(name,owner,fn){if(name===service)this.fn=fn;}},
    createHiddenMobMovementSenseContext:()=>({}),mobMovementPresentationMode:()=>mode,
    unitTransitionBlocked:()=>false,performLeavingHexFreeAttacks:async()=>true,
    updateFacingForStep:noop,setUnitActionBanner:noop,getUnitEffect:()=>null,
    presentWalkTestStep:async(mover,to)=>{walkCalls++;assert.equal(mover.x,2);assert.equal(to.x,3);return !cancelled;},
    clearActivityDetectedFxForUnit:noop,maybeRecenterCamera:noop,centerCameraOn:noop,
    playMoveSound:noop,draw:noop,showActivityDetectedFx:noop,refreshTurnBanner:noop,
    resolvePersistentAreaMovementStep:async()=>({haltMovement:false}),
    maybeTriggerPlayerGuard:()=>false,triggerMobGuardsAgainst:async()=>{},sleep:async()=>{sleepCalls++;},
    r219AutomatedStepDelay:()=>0};
   vm.createContext(ctx);
   const start=overrides.indexOf(`AdventurePartyCombatServices.register('${service}'`);
   const end=overrides.indexOf('\n});',start)+4;
   vm.runInContext(overrides.slice(start,end),ctx);
   const fn=ctx.AdventurePartyCombatServices.fn;
   const result=service==='animateEntitySteps'
    ?await fn(unit,1,()=>({x:3,y:3}))
    :await fn(unit,[{x:2,y:3},{x:3,y:3}],1);
   assert.equal(walkCalls,mode==='visible'?1:0);
   assert.equal(sleepCalls,0,'no idle pause between NPC hexes');
   const aborted=mode==='visible'&&cancelled;
   assert.equal(result,!aborted);
   assert.equal(unit.x,aborted?2:3);
  }
 }
}
console.log('PASS active AI movement overrides animate visible steps, preserve hidden movement, and cancel before committing');

// A multi-hex run must not hold/restart at each center. Sample the actual helper.
{
 let time=0;const samples=[];
 const ctx={location:{search:'?walkTest=1'},URLSearchParams,game:{over:false},performance:{now:()=>time},unit:{x:0,y:0,alive:true}};
 ctx.presentCombatFrame=async()=>{const m=ctx.unit.walkPresentation;samples.push({x:m.from.x+(m.to.x-m.from.x)*m.t,seconds:m.seconds});time+=100;};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 for(let x=1;x<=3;x++){
  assert(await vm.runInContext('presentWalkTestStep(unit,{x:'+x+',y:0},true)',ctx));ctx.unit.x=x;
 }
 for(let i=1;i<samples.length;i++){
  assert(Math.abs(samples[i].x-samples[i-1].x-100/650)<1e-9,'constant speed across hex centers');
  assert(Math.abs(samples[i].seconds-samples[i-1].seconds-.1)<1e-9,'continuous animation phase');
 }
 assert.equal(time,2000,'three 650ms steps round once, not once per hex');
 time+=1000;
 await vm.runInContext('presentWalkTestStep(unit,{x:4,y:0},true)',ctx);
 assert.equal(samples.find(s=>s.seconds>=1.95).x,3,'real interruptions resume at the current center');
}
console.log('PASS continuous multi-hex speed, pose phase and no catch-up after interruptions');

{
 const movement=fs.readFileSync('js/combat-movement.js','utf8');
 const start=movement.indexOf('let heldCombatMove='),end=movement.indexOf('async function tryPlayerMove(',start);
 const unit={id:'friendly',x:0,y:0,alive:true};let steps=0;
 const ctx={clickMovementRunning:false,game:{active:unit.id,over:false},activePlayerControlledUnit:()=>unit,draw:()=>{},tryPlayerMove:async(dx,dy,options)=>{assert.equal(options.continuous,true);unit.x+=dx;steps++;if(steps===2)vm.runInContext('releaseKeyboardCombatMove()',ctx);}};
 vm.createContext(ctx);vm.runInContext(movement.slice(start,end),ctx);
 await vm.runInContext('beginKeyboardCombatMove("KeyD",1,0)',ctx);
 assert.equal(steps,2);assert.equal(unit.x,2);assert.equal(unit.walkPresentation,undefined);
}
console.log('PASS held player movement chains shared segments and stops on key release');
