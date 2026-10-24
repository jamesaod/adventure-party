import assert from 'node:assert/strict';
import { MobAppearanceRuntime } from '../js/mob-appearance-runtime.mjs';

const unit={id:'player',type:'fighter',name:'Dungeon Crawler Carl',inventory:[
  {name:'Flaming Sword +5',slot:'weapon',equipped:true,appearanceId:'flaming-sword-5'},
  {name:'Battle Axe',slot:'weapon',equipped:false,appearanceId:'battle-axe'}
]};

let calls=0,resolvers=[];
const runtime=new MobAppearanceRuntime({
  generateSpriteSet:recipe=>{
    calls++;
    return new Promise(resolve=>resolvers.push(()=>resolve({id:recipe.equipment?.appearanceId||'unarmed'})));
  }
});
const a=runtime.ensure(unit,{modelId:'carl'});
const duplicate=runtime.ensure(unit,{modelId:'carl'});
assert.equal(calls,0,'generation begins on the promise microtask');
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(calls,1,'same visual key shares one in-flight render');
resolvers[0]();
const [ar,dr]=await Promise.all([a,duplicate]);
assert.equal(ar.applied,false,'older same-key request cannot become current');
assert.equal(dr.applied,true);
assert.equal(dr.inFlight,true);

const cached=await runtime.ensure(unit,{modelId:'carl'});
assert.equal(cached.cached,true);
assert.equal(cached.applied,true);
assert.equal(calls,1);

let raceCalls=0,raceResolvers=[];
const race=new MobAppearanceRuntime({
  generateSpriteSet:recipe=>{
    raceCalls++;
    return new Promise(resolve=>raceResolvers.push(()=>resolve({id:recipe.equipment?.appearanceId||'unarmed'})));
  }
});
const sword=race.ensure(unit,{modelId:'carl'});
unit.inventory[0].equipped=false;unit.inventory[1].equipped=true;
const axe=race.ensure(unit,{modelId:'carl'});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(raceCalls,2,'different appearance keys render independently');
raceResolvers[0]();
await new Promise(resolve=>setTimeout(resolve,0));
raceResolvers[1]();
const swordResult=await sword,axeResult=await axe;
assert.equal(swordResult.applied,false);
assert.equal(axeResult.applied,true);
assert.equal(axeResult.spriteSet.id,'battle-axe');
console.log('PASS mob appearance runtime cache recheck, in-flight dedupe and stale-result guard');
