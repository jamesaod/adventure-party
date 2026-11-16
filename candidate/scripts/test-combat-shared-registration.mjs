import assert from 'node:assert/strict';
import {MobAppearanceRuntime} from '../js/mob-appearance-runtime.mjs';
let loads=0,calls=0;const registry=new Map();const runtime=new MobAppearanceRuntime({generateSpriteSet:async recipe=>{loads++;return {key:recipe.equipment?.appearanceId||'base'};}});
const bridge={register(set){calls++;registry.set(set.key,{set});return set.key;},current:id=>registry.get(id)};
for(const count of [10,25]){runtime.registrations=new WeakMap();calls=0;const units=Array.from({length:count},(_,i)=>({id:'orc-'+i,name:'Orc '+i,type:'orc',inventory:[]}));const results=await Promise.all(units.map(u=>runtime.ensure(u,{modelId:'orc'})));for(const r of results)runtime.registerAppearance(r.spriteSet,bridge);assert.equal(calls,1);assert(results.every(r=>r.spriteSet===results[0].spriteSet));assert.equal(loads,1);console.log(count+' matching orcs: one shared asset load, one registration');}
const set={key:'replacement'};runtime.registerAppearance(set,bridge);const old=calls;runtime.registerAppearance(set,bridge);assert.equal(calls,old);registry.set(set.key,{});runtime.registerAppearance(set,bridge);assert.equal(calls,old+1);registry.delete(set.key);runtime.registerAppearance(set,bridge);assert.equal(calls,old+2);runtime.registerAppearance({key:'equipment-change'},bridge);assert.equal(calls,old+3);
assert.throws(()=>runtime.registerAppearance({key:'bad'},{register(){throw Error('invalid');},current:bridge.current}),/invalid/);
console.log('PASS shared registration, replaced/removed records, changed appearance and failed registration');
