import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
import * as T from '../assets/vendor/three/three.module.min.js';
import {sampleDirectPose} from '../js/combat-direct-units.mjs?v=outline-reuse2';
const source=fs.readFileSync('js/combat-movement.js','utf8').split('/* Combat owner:')[0];
let now=0;const samples=[],u={alive:true,x:0,y:0,facingHex:3};
const c={location:{search:''},URLSearchParams,performance:{now:()=>now},game:{over:false},unitFootprintDefinition:()=>({rotates:false}),facingDirectionIndex:u=>u.facingHex,
 presentCombatFrame:async()=>{samples.push({...u.walkPresentation,time:now,facing:u.facingHex});now+=1000/30;}};
vm.createContext(c);vm.runInContext(source,c);c.combatWalkCurveClear=()=>true;
const path=c.prepareCombatWalkPath(u,[{x:0,y:0},{x:1,y:0},{x:1,y:-1},{x:2,y:-1}]);
assert(Math.hypot(path[1].walkCurve[3].x-1,path[1].walkCurve[3].y)>.25,'Broad corner bypasses intermediate center');
for(const p of path.slice(1)){
 u.walkStartHeading=u.facingHex*Math.PI/3+(u.aimYawOffset||0);
 u.facingHex=((Math.round(c.combatWalkDirection(p.x-u.x,p.y-u.y)/(Math.PI/3))%6)+6)%6;
 assert(await c.presentWalkTestStep(u,p,true));u.x=p.x;u.y=p.y;
}
for(let i=1;i<samples.length;i++)assert(Math.abs(c.combatWalkAngleDifference(samples[i].heading,samples[i-1].heading))<=Math.PI*2.5*(samples[i].time-samples[i-1].time)/1000+1e-7,'No facing jump across frame or hex boundary');
const heading=u.walkPresentation.heading;delete u.walkPresentation;delete u.walkStepClock;
assert(Math.abs(c.combatWalkAngleDifference(u.facingHex*Math.PI/3+u.aimYawOffset,heading))<1e-8,'No snap when returning to idle');
const asset={group:new T.Group(),camera:new T.PerspectiveCamera()};
for(const sample of samples){const e={alive:true,walkPresentation:sample};const pose=sampleDirectPose({asset,yaw:Math.PI/2+sample.facing*Math.PI/3},e);assert(Math.abs(c.combatWalkAngleDifference(pose.yaw,sample.heading+Math.PI/2))<1e-8,'Actual model follows continuous heading');}
const curve=path[1].walkCurve,arc=c.combatWalkArc(curve),distances=[];let previous=c.sampleCombatWalkCurve(curve,0);
for(let i=1;i<=20;i++){const p=c.sampleCombatWalkCurve(curve,arc.parameter(i/20)),dx=p.x-previous.x,dy=p.y-previous.y;distances.push(Math.hypot(dx+dy*.5,dy*Math.sqrt(3)/2));previous=p;}
assert(Math.max(...distances)/Math.min(...distances)<1.03,'Even distance per walking interval');
console.log('PASS broad curved route, smooth turn rate across hexes, model yaw, stable final facing and distance-paced walking');
