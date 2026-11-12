import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const source=fs.readFileSync('js/adventure-party.js','utf8');const start=source.indexOf('function combatEquipmentVisualSignature('),end=source.indexOf('async function refreshCombatMobAppearance',start);let calls=0;
const ctx=vm.createContext({humanoidRuntimeModel:()=>true,markMobAppearanceDirty:async u=>{calls++;u.appliedEquipmentVisualSignature=ctx.combatEquipmentVisualSignature(u);u.spriteSetId=u.dynamicAppearanceSpriteSetId='correct';}});
vm.runInContext(source.slice(start,end),ctx);
const a={type:'fighter',inventory:[{id:'sword',equipped:true}]},b={type:'fighter',inventory:[{id:'bow',equipped:true}]};
await ctx.reconcileCombatEquipmentVisual(a);await ctx.reconcileCombatEquipmentVisual(a);assert.equal(calls,1);
a.inventory[0].equipped=false;await ctx.reconcileCombatEquipmentVisual(a);assert.equal(calls,2);assert.equal(b.inventory[0].equipped,true);
a.spriteSetId='stale';await ctx.reconcileCombatEquipmentVisual(a);assert.equal(calls,3);
console.log('PASS unchanged turns skip refresh; unequip and stale visuals repair independently');
