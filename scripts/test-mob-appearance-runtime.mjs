import assert from 'node:assert/strict';
import { MobAppearanceRuntime } from '../js/mob-appearance-runtime.mjs';
const unit = { id:'player', type:'fighter', name:'Dungeon Crawler Carl', inventory:[
  {name:'Flaming Sword +5',slot:'weapon',equipped:true,appearanceId:'flaming-sword-5'},
  {name:'Battle Axe',slot:'weapon',equipped:false,appearanceId:'battle-axe'}
]};
let calls=0, resolvers=[];
const runtime=new MobAppearanceRuntime({generateSpriteSet: recipe => { calls++; return new Promise(resolve=>resolvers.push(()=>resolve({id:recipe.equipment?.appearanceId||'unarmed'}))); }});
const a=runtime.refresh(unit,{modelId:'carl'});
unit.inventory[0].equipped=false; unit.inventory[1].equipped=true;
const b=runtime.refresh(unit,{modelId:'carl'});
resolvers[0](); await new Promise(r=>setTimeout(r,0));
resolvers[1]();
const ar=await a, br=await b;
assert.equal(ar.applied,false); assert.equal(br.applied,true); assert.equal(br.spriteSet.id,'battle-axe');
const cPromise=runtime.refresh(unit,{modelId:'carl'}); const cr=await cPromise;
assert.equal(cr.cached,true); assert.equal(calls,2);
console.log('PASS mob appearance runtime');