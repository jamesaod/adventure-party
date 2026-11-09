import fs from 'node:fs';
import vm from 'node:vm';
import {extractCombatFunction} from './combat-test-source.mjs';
import assert from 'node:assert/strict';
import {humanoidShadowProxy,placeHumanoidShadow} from '../js/combat-unit-shadow-proxy.mjs';
import {solarState} from '../js/solar-clock.mjs';
const ready=humanoidShadowProxy({shield:true,weapon:'axe'}),attack=humanoidShadowProxy({shield:true,weapon:'axe',pose:'attack'});
assert.equal(ready,humanoidShadowProxy({shield:true,weapon:'axe'}),'Reuse cached anatomical geometry');assert(ready.triangles<1000);assert.notDeepEqual(ready.points,attack.points);
assert(ready.points.every(p=>p.length===3&&p.every(Number.isFinite)));assert(ready.indices.every(i=>i>=0&&i<ready.points.length));
const span=(points,axis)=>Math.max(...points.map(p=>p[axis]))-Math.min(...points.map(p=>p[axis]));
assert(span(ready.points,0)>.5&&span(ready.points,2)>.25,'Proxy has real width and depth');
assert(humanoidShadowProxy({shield:true}).triangles>humanoidShadowProxy({shield:false}).triangles);
assert(humanoidShadowProxy({ranged:true,weapon:'bow',pose:'attack'}).points.length>0);
const prone=humanoidShadowProxy({pose:'prone',weapon:'unarmed'});assert(span(prone.points,1)<.8,'Prone body lies along the floor');
const placed=placeHumanoidShadow(ready,{origin:[10,0,20],height:3.6,yaw:Math.PI/2});assert(Math.abs(span(placed.points,0)-span(ready.points,2)*2)<1e-9);
function projectedArea(proxy,direction){
 const den=Math.max(direction.y,Math.hypot(direction.x,direction.z)/6),p=proxy.points.map(([x,y,z])=>[x-y*direction.x/den,z-y*direction.z/den]);let area=0;
 for(let i=0;i<proxy.indices.length;i+=3){const [a,b,c]=proxy.indices.slice(i,i+3).map(j=>p[j]);area+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;}
 return area;
}
for(const proxy of [ready,attack])for(let hour=6.1;hour<18;hour+=.2){const sun=solarState(hour);assert(projectedArea(proxy,sun.direction)>.1,'Anatomical shadow retains area throughout daylight');}
for(let angle=0;angle<Math.PI*2;angle+=.1)assert(projectedArea(attack,{x:Math.cos(angle),y:1,z:Math.sin(angle)})>.1,'Side light never collapses an attack pose');
console.log('PASS cached 3D anatomical volumes, equipment/pose/facing/scale, prone stance and nonzero shadow area across light angles');

// Fit actual rendered boot contacts through camera rotation, sprite anchors,
// mirroring and Enlarge. Placed proxy sole centres must meet those same points.
const adapter=fs.readFileSync('js/combat-lighting-services.js','utf8');
for(const rotation of [0,1,2,3,4,5])for(const flip of [false,true])for(const enlarge of [1,2]){
 const angle=rotation*Math.PI/3,c=Math.cos(angle),s=Math.sin(angle),pixelScale=30,squash=.55;
 const sandbox=vm.createContext({combatShadowWorld:(p)=>[(p.x*c+p.y/squash*s)/pixelScale,0,(-p.x*s+p.y/squash*c)/pixelScale]});
 vm.runInContext(extractCombatFunction(adapter,'fitCombatShadowFeet'),sandbox);
 const options={x:123,y:86,width:40*enlarge,height:52*enlarge,anchorX:.4,anchorY:.78,flip,
  footLine:{contacts:[{x:22,y:83},{x:67,y:94}]}};
 const yaw=.71,height=1.8*enlarge,fit=sandbox.fitCombatShadowFeet({width:100,height:100},options,yaw,height);
 const proxy=humanoidShadowProxy({feet:fit.feet.map(p=>Array.from(p)),pose:'attack',shield:true});
 const placed=placeHumanoidShadow(proxy,{origin:Array.from(fit.origin),height,yaw});
 for(const target of fit.world)assert(placed.feet.some(p=>Math.hypot(p[0]-target[0],p[2]-target[2])<.0015),'Proxy feet meet sprite contacts for each view/facing/scale');
}
console.log('PASS exact boot-to-proxy contact fitting for 6 camera rotations, both mirrors and Enlarge');
