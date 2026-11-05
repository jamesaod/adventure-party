import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import {extractCombatFunction} from './combat-test-source.mjs';import {packCombatLights} from '../js/combat-light-shader.mjs';
const unit={id:'carl',alive:true,x:4,y:5,inventory:[{equipped:true,appearanceId:'flaming-sword-5'}]};
const ctx=vm.createContext({game:{},performance:{now:()=>1000},firFireLightSources:()=>[],allUnits:()=>[unit],getUnitEffect:()=>null,illuminationAreaEffects:()=>[]});
vm.runInContext(extractCombatFunction(fs.readFileSync('js/combat-lighting-services.js','utf8'),'illuminationSources'),ctx);
const sources=ctx.illuminationSources();assert.equal(sources.length,1);
const packed=packCombatLights(sources.map(s=>({...s,kind:'spell',height:s.heightMetres,range:s.radiusHexes,bounds:[0,0,64,32]})));assert([...packed.color.slice(0,4)].every(Number.isFinite));assert(Math.abs(packed.color[1]-153/255)<1e-6);
unit.inventory[0].equipped=false;assert.equal(ctx.illuminationSources().length,0);unit.inventory[0]={equipped:true,appearanceId:'sword-long'};assert.equal(ctx.illuminationSources().length,0);
console.log('PASS equipping Flaming Sword generates valid GPU light; unequipping and ordinary swords remove it');

const adapter=fs.readFileSync('js/exploration-combat-hooks.js','utf8');const lampContext=vm.createContext({game:{player:{x:0,y:0}},combatSceneTerrain:{cellW:128,cellH:72,torches:[]},combatSceneContext:{origin:{x:0,z:0}},worldPointForHex:()=>({x:0,y:0}),explorationEncounterApi:{SCENE_STYLE:{cellMetres:3},sceneLights:()=>[{kind:'lantern'},{kind:'torch',x:1}]}});vm.runInContext(extractCombatFunction(adapter,'explorationVisualLights'),lampContext);assert.deepEqual(Array.from(lampContext.explorationVisualLights(),l=>l.kind),['torch']);console.log('PASS default combat lantern removed while authored torches remain');

assert.equal(sources[0].heightMetres,1.1,'Sword light uses adapter metre-height contract');
const radiusMetres=sources[0].radiusHexes*1.5,d=sources[0].heightMetres/radiusMetres;
assert(sources[0].intensity*.18*(1-d*d)**2>.2,'Ground under sword receives substantial shader radiance');
unit.inventory[0]={equipped:true,appearanceId:'flaming-sword-5'};ctx.performance.now=()=>1077;assert.notEqual(ctx.illuminationSources()[0].intensity,sources[0].intensity,'Torch-like flicker changes source intensity over time');
console.log('PASS sword height, effective ground falloff and time-varying flicker');

const before=sources[0].visualOffsetMetres,after=ctx.illuminationSources()[0].visualOffsetMetres;assert.notDeepEqual({...before},{...after});
assert(Math.abs(after.x)<=.035&&Math.abs(after.z)<=.035&&Math.abs(after.y)<=.02,'Source sway stays within a few centimetres');
assert.equal(ctx.illuminationSources()[0].x,unit.x,'Visual sway does not move gameplay light hex');
const time=1,oldIntensity=2.2*(.82+.10*Math.sin(time*12+unit.x*1.7)+.05*Math.sin(time*27+unit.y)+.03*Math.sin(time*49));assert(Math.abs(sources[0].intensity/oldIntensity-1.5)<1e-9,'Light output increases exactly 50 percent');
console.log('PASS bounded source sway leaves gameplay location stable and raises light output 50 percent');
