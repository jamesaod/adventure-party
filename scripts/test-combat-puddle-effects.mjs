import assert from 'node:assert/strict';
import {CombatPuddleEffects,PUDDLE_RING_LIMIT,PUDDLE_PARTICLE_LIMIT,puddleRainRate} from '../js/combat-puddle-effects.mjs';
const face={grass:true,snowEligible:1,grassUnit:128/3,grassSquash:.568329,points:[{x:-200,y:-200},{x:200,y:-200},{x:200,y:200},{x:-200,y:200}]};
let water=.12,visible=true;const fx=new CombatPuddleEffects({elevation:()=>-.1524,water:()=>water,visible:()=>visible,random:()=>.5});
fx.collect([face]);const entity={alive:true};fx.walk([{entity,x:0,y:0}]);fx.walk([{entity,x:0,y:0}]);assert.equal(fx.footHits,0,'Stationary units do not splash');fx.walk([{entity,x:22,y:0}]);assert.equal(fx.footHits,1);assert.equal(fx.particles.length,7);
fx.walk([{entity,x:190,y:0}]);assert.equal(fx.footHits,1,'Teleports do not emit walking splashes');
water=0;fx.walk([{entity,x:168,y:0}]);assert.equal(fx.footHits,1,'Dry dirt cannot splash');water=.12;
visible=false;assert.equal(fx.sample(0,0),null);visible=true;
fx.reset();fx.collect([{...face,grass:false},{...face,snowEligible:0}]);assert.equal(fx.sample(0,0),null,'Stone and indoors excluded');
assert(puddleRainRate({type:'rain',intensity:1})>puddleRainRate({type:'rain',intensity:.55}));assert.equal(puddleRainRate({type:'clear',intensity:1}),0);
for(let t=0;t<10000;t+=100){fx.collect([face]);fx.begin(t,{type:'rain',intensity:1});assert(fx.rings.length<=PUDDLE_RING_LIMIT);assert(fx.particles.length<=PUDDLE_PARTICLE_LIMIT);}
assert.equal(fx.rainHits,792,'Eight impacts per 100 ms tick: 8x the previous heavy-rain rate');const hits=fx.rainHits;
for(let t=10000;t<13000;t+=100){fx.collect([face]);fx.begin(t,{type:'clear'});}assert.equal(fx.rainHits,hits);assert.equal(fx.active,false,'Effects expire after rain stops');
fx.collect([face]);for(let i=0;i<200;i++)fx.emit(fx.sample(0,0),true);assert.equal(fx.rings.length,PUDDLE_RING_LIMIT);assert.equal(fx.particles.length,PUDDLE_PARTICLE_LIMIT);
fx.begin(14000,{type:'rain',intensity:1},{snow:true});assert.equal(fx.active,true,'Ground snow must not erase existing open-water splashes');assert.equal(fx.rainHits,hits,'Snow still suppresses rain-generated impacts');fx.scene({});assert.equal(fx.footHits,0);assert.equal(fx.faces.length,0);
console.log('PASS puddle stride triggering, eligibility, rain scaling, bounded budgets, expiry, snow and scene reset');

assert.equal(puddleRainRate({type:'rain',intensity:1}),80);
assert.equal(puddleRainRate({type:'rain',intensity:.55}),80*.55**2);
const wet=new CombatPuddleEffects({elevation:()=>-.1524,water:()=>.12,random:()=>.5});wet.collect([face]);wet.emit(wet.sample(0,0));
const drop=wet.particles[0],peak=drop.vz**2/(4*1.8);
assert(peak>.2&&drop.life>=.6,'Rain impacts rise visibly instead of less than one display pixel');

let steps=0;const fallback=new CombatPuddleEffects({elevation:()=>-.1524,water:()=>.12,step:()=>steps++});fallback.collect([face]);fallback.trackRig(entity);fallback.walk([{entity,x:0,y:0}]);fallback.walk([{entity,x:22,y:0}]);assert.equal(steps,1,'Rig water fallback plays a footstep when foot planting is unavailable');fallback.walk([{entity,x:44,y:0}]);assert.equal(steps,1,'Recent water contact suppresses duplicate sound');

const impactFx=new CombatPuddleEffects({elevation:()=>-.1524,water:()=>.12,random:()=>.5});impactFx.collect([face]);assert.equal(impactFx.impact(0,0),true);assert.equal(impactFx.particles.filter(p=>!p.mist).length,120);assert.equal(impactFx.particles.filter(p=>p.mist).length,20);assert.equal(impactFx.rings.length,3);assert(impactFx.particles.filter(p=>!p.mist).every(p=>p.vz>=2.6&&p.size===1.75));for(let i=0;i<20;i++)impactFx.impact(0,0);assert(impactFx.particles.length<=PUDDLE_PARTICLE_LIMIT);assert(impactFx.rings.length<=PUDDLE_RING_LIMIT);assert.equal(impactFx.impact(1000,1000),false);const dryImpact=new CombatPuddleEffects({elevation:()=>0,water:()=>0});dryImpact.collect([face]);assert.equal(dryImpact.impact(0,0),false);
console.log('PASS club splash burst, three rings, water-only placement and repeated-impact budgets');
