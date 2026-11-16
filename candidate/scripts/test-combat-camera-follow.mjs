import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync('js/adventure-party.js','utf8'),start=source.indexOf('let computerCameraTick='),end=source.indexOf('function centerCameraOn',start);
let time=0,unit={alive:true,controller:'npc',x:10,y:8},visible=true;
const camera={x:0,y:0},context=vm.createContext({adventurePartyWalkBusy:true,camera,activeUnit:()=>unit,isPlayerControlledUnit:u=>u.controller==='player',isQuickCommandUnit:u=>!!u.quick,mobPositionVisibleToFriendlyParty:()=>visible,game:{over:false},currentScreen:'combat',performance:{now:()=>time},matchMedia:()=>({matches:false}),requestCombatAnimationTick:()=>1,draw(){}});
vm.runInContext(source.slice(start,end),context);
for(const controller of ['npc','mob','player']){unit={alive:true,controller,quick:true,x:10,y:8,walkPresentation:{from:{x:2,y:2},to:{x:6,y:4},t:.5}};camera.x=0;camera.y=0;for(let i=0;i<120;i++){time+=16;context.updateComputerCameraFollow();}assert(Math.abs(camera.x-4)<.01&&Math.abs(camera.y-3)<.01,'Follow interpolated motion for '+controller);}
unit={alive:true,controller:'mob',x:20,y:20};visible=false;const before={...camera};time+=16;context.updateComputerCameraFollow();assert.deepEqual(camera,before,'Hidden enemies do not move camera');
unit={alive:true,controller:'player',x:20,y:20};time+=16;context.updateComputerCameraFollow();assert.deepEqual(camera,before,'Manual players retain existing camera');
console.log('PASS NPC, hostile and Quick tracking, interpolated position, hidden-enemy and manual-player guards');

visible=true;unit={alive:true,controller:'mob',x:50,y:50};
for(const framing of [false,true]){vm.runInContext(`computerCameraFraming=${framing}`,context);time+=16;context.updateComputerCameraFollow();assert.deepEqual(camera,before,'No idle/attack pull with ranged framing on or off');}
vm.runInContext('computerCameraFraming=false',context);unit.walkPresentation={from:{x:40,y:40},to:{x:50,y:50},t:1};context.adventurePartyWalkBusy=false;time+=16;context.updateComputerCameraFollow();assert.deepEqual(camera,before,'Retained walk pose during reactions does not resume follow');
console.log('PASS movement-only camera ownership; idle, attacks and retained walk poses leave camera unchanged');