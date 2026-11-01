import assert from 'node:assert/strict';
import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {blankEdgeMap,paintCell,resizeMap,seedPack,parsePack} from '../js/exploration-authoring.mjs';
import {isOutdoor,validateEnvironment} from '../js/exploration-environment.mjs';
import {SCENE_STYLE,ambientForCell,surfaceLight} from '../js/exploration-scene-style.mjs';
import {explorationDoor} from '../js/exploration-materials.mjs';
const map=blankEdgeMap('environment-test','Environment test');
assert(!isOutdoor(map,3,3));paintCell(map,3,3,'outdoor');paintCell(map,4,3,'outdoor');
assert(isOutdoor(map,3,3));assert.equal(map.grid[3][3],'.');
const roundtrip=parsePack(JSON.stringify(seedPack(map))).maps[0];assert(isOutdoor(roundtrip,3,3));
resizeMap(roundtrip,20,18);assert(isOutdoor(roundtrip,3,3));assert(!isOutdoor(roundtrip,19,17));validateEnvironment(roundtrip);
paintCell(roundtrip,3,3,'indoor');assert(!isOutdoor(roundtrip,3,3));
assert.throws(()=>validateEnvironment({...map,environment:['o']}));
const point={x:0,y:0,z:0},normal={x:0,y:1,z:0};
const indoor=surfaceLight(point,normal,[],()=>true,ambientForCell(map,2,3)),outdoor=surfaceLight(point,normal,[],()=>true,ambientForCell(map,3,3));assert(outdoor.every((n,i)=>n>indoor[i]));
assert.equal(SCENE_STYLE.door.depth,SCENE_STYLE.wallDepthMetres/2);
assert.equal(explorationDoor().hinge.children[0].geometry.parameters.depth,SCENE_STYLE.wallDepthMetres/2);
const source=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
function extract(name){const start=source.indexOf(`function ${name}(`),end=source.indexOf('\n}',start)+2;return source.slice(start,end);}
const state={battlefieldZoom:1,battlefieldRotation:0,BATTLEFIELD_LOGICAL_WIDTH:1050,BATTLEFIELD_LOGICAL_HEIGHT:600,canvas:{getBoundingClientRect:()=>({left:0,top:0,width:1050,height:600})},hoverHex:null,document:{getElementById:()=>null},draw(){}};
vm.createContext(state);vm.runInContext(['battlefieldZoomAnchor','battlefieldViewportBounds','canvasEventPoint','rotateBattlefield'].map(extract).join('\n'),state);
for(const zoom of [.6,1,1.8])for(let step=0;step<6;step++){
 state.battlefieldZoom=zoom;state.battlefieldRotation=step;
 const a=state.battlefieldZoomAnchor(),angle=step*Math.PI/3;
 for(const p of [{x:50,y:-100},{x:900,y:750},a]){
 const dx=(p.x-a.x)*zoom,dy=(p.y-a.y)*zoom;
 const back=state.canvasEventPoint({clientX:a.x+dx*Math.cos(angle)-dy*Math.sin(angle),clientY:a.y+dx*Math.sin(angle)+dy*Math.cos(angle)});
 assert(Math.hypot(back.x-p.x,back.y-p.y)<1e-8,'Rotated clicks select the original world hex');
 }
}
state.battlefieldRotation=0;state.rotateBattlefield(-1);assert.equal(state.battlefieldRotation,5);for(let i=0;i<6;i++)state.rotateBattlefield(1);assert.equal(state.battlefieldRotation,5);
const facing=[];const caster={alive:true,x:0,y:0};
const spellEnv={faceEntityToward:(c,t)=>facing.push(t),speakSpellIncantation(){},getUnitEffect:()=>null,spellBreaksInvisibility:()=>false};vm.createContext(spellEnv);vm.runInContext(extract('commitSpellCast'),spellEnv);
assert(spellEnv.commitSpellCast(caster,{},null,1800,{x:2,y:-1}));assert.equal(facing.length,1);
spellEnv.commitSpellCast(caster,{},null,1800,{x:0,y:0});assert.equal(facing.length,1,'Self cast preserves facing');
spellEnv.commitSpellCast({...caster,alive:false},{},null,1800,{x:1,y:0});assert.equal(facing.length,1,'Rejected cast does not turn');
console.log('PASS environment paint/export/resize/legacy defaults, local ambient, half-wall door thickness, 18 rotated input transforms, rotation wrapping and committed spell facing');
