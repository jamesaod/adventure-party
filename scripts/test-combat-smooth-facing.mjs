import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync('js/adventure-party.js','utf8');
const start=source.indexOf('const combatFacingTurns='),end=source.indexOf('/* Hex-occupancy walls',start);
let now=0;const callbacks=[];
const c={performance:{now:()=>now},game:{},currentScreen:'combat',draw(){},requestCombatAnimationTick:fn=>{callbacks.push(fn);return callbacks.length;},facingDirectionIndex:u=>u.facingHex||0,updateFacingForStep(u,dx,dy){const angle=Math.atan2(-dy*Math.sqrt(3)/2,dx+dy*.5);u.facingHex=((Math.round(angle/(Math.PI/3))%6)+6)%6;const offset=angle-u.facingHex*Math.PI/3;u.aimYawOffset=Math.atan2(Math.sin(offset),Math.cos(offset));}};
vm.createContext(c);vm.runInContext(source.slice(start,end),c);
const u={x:0,y:0,alive:true,facingHex:0};
c.faceEntityToward(u,{x:-1,y:0});assert(Math.abs(c.combatFacingAngle(Math.PI+u.aimYawOffset))<1e-8,'No visual jump on target change');
now=250;callbacks.shift()(now);assert(Math.abs(Math.abs(c.combatFacingAngle(Math.PI+u.aimYawOffset))-Math.PI/2)<1e-8);
const offset=u.aimYawOffset;c.faceEntityToward(u,{x:-2,y:0});assert.equal(u.aimYawOffset,offset,'Repeated targeting does not restart the turn');
now=500;callbacks.shift()(now);assert(Math.abs(u.aimYawOffset)<1e-8);
// Six-facing wrap follows the short path; retargeting preserves the displayed heading.
u.facingHex=5;u.aimYawOffset=0;now=600;c.faceEntityToward(u,{x:1,y:0});assert(Math.abs(u.aimYawOffset+Math.PI/3)<1e-8);
now=700;callbacks.shift()(now);const before=u.facingHex*Math.PI/3+u.aimYawOffset;c.faceEntityToward(u,{x:1,y:-1});const after=u.facingHex*Math.PI/3+u.aimYawOffset;assert(Math.abs(c.combatFacingAngle(before-after))<1e-8);
now=1200;while(callbacks.length)callbacks.shift()(now);assert(Math.abs(u.aimYawOffset)<1e-8);
console.log('PASS shared smooth facing: no snap, smooth midpoint, shortest wrap, repeated target and continuous retarget');
