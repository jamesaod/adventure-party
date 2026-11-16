import assert from 'node:assert/strict';
import {CombatPuddleEffects} from '../js/combat-puddle-effects.mjs';
const face={grass:true,snowEligible:1,grassUnit:128/3,grassSquash:.568329,points:[{x:-300,y:-300},{x:300,y:-300},{x:300,y:300},{x:-300,y:300}]};
let wet=true,visible=true;
const fx=new CombatPuddleEffects({water:()=>0,elevation:()=>0,permanent:()=>true,waterAt:()=>({water:wet?.3:0,height:-.16}),visible:()=>visible,random:()=>.5}),unit={alive:true};
const frame=(time,x=0)=>{fx.begin(time,{type:'clear'});fx.collect([face]);fx.trackRig(unit);fx.walk([{entity:unit,x,y:0}]);};
frame(0);frame(100,22);assert.equal(fx.footHits,1,'Tracked rig without planting still splashes when wading');assert.equal(fx.particles.length,7);assert(fx.particles.every(p=>p.height===-.16));
fx.plant(unit,22,0);assert.equal(fx.footHits,1,'Rig and fallback do not double emit');
for(let t=200;t<5000;t+=100)frame(t,22);
assert(fx.idleHits>=1&&fx.idleHits<=2,'Idle rings are occasional');assert.equal(fx.particles.length,0,'Standing ripples have no droplets');assert.equal(fx.footHits,1);assert(fx.active,'Wet standing units keep the shared scheduler active between ripples');
wet=false;for(let t=5000;t<8000;t+=100)frame(t,22);assert(!fx.active,'Dry units stop scheduling after effects expire');
wet=true;visible=false;for(let t=8000;t<12000;t+=100)frame(t,22);assert(!fx.active,'Hidden units produce no wake');
visible=true;fx.scene('new');assert.equal(fx.idleHits,0);assert.equal(fx.wetUnits,0);
console.log('PASS rig fallback, impact deduplication, water elevation, idle cadence, dry/hidden suppression and scene reset');

// Snow on land must not suppress open-water movement or two-leg idle rings.
fx.scene('snow');const winterFrame=(t,x=0)=>{fx.begin(t,{type:'snow',intensity:1},{snow:true});fx.collect([face]);fx.trackRig(unit);fx.walk([{entity:unit,x,y:0}]);};
winterFrame(0);winterFrame(100,22);assert.equal(fx.footHits,1);assert.equal(fx.particles.length,7);
winterFrame(200,22);assert(fx.particles.length>0,'Snow cannot clear a splash next frame');assert(fx.rings.length>0);
for(let t=300;t<=4000;t+=100)winterFrame(t,22);
assert.equal(fx.rings.length,2,'Each idle leg ripples during snow');assert.equal(fx.particles.length,0);assert.equal(fx.rainHits,0);
wet=false;winterFrame(4100,44);assert.equal(fx.footHits,1,'Snowy dry land cannot splash');
console.log('PASS snowy-water footsteps, splash persistence, paired idle ripples and dry exclusion');
