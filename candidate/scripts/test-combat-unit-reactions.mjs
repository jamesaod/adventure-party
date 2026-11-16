import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
import {extractCombatFunction} from './combat-test-source.mjs';
import {harness} from './test-combat-result-panel.mjs';
const source=fs.readFileSync('js/adventure-party.js','utf8'),render=fs.readFileSync('js/combat-render-units.js','utf8');
let now=0;const timers=[],texts=[];
const blue={alive:true,hp:30,maxHp:30,x:5,y:5,faction:'player'},red={alive:true,hp:30,maxHp:30,x:5,y:5,faction:'enemy'},game={};
const ctx={save(){},restore(){},setTransform(){},measureText:t=>({width:t.length*16}),strokeText(){},fillText(text,x,y){texts.push({text,x,y,color:this.fillStyle,font:this.font});}};
const c=vm.createContext({game,performance:{now:()=>now},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){},unitBarkClearTimer:null,allUnits:()=>[blue,red],draw(){},ctx,battlefieldZoom:1,battlefieldZoomAnchor:()=>({x:300,y:200}),BATTLEFIELD_RENDER_DENSITY:1,BATTLEFIELD_LOGICAL_WIDTH:600,BATTLEFIELD_LOGICAL_HEIGHT:400,unitFootprintScreenCenter:()=>({x:300,y:200}),hexCenter:()=>({x:300,y:200}),shouldRenderUnitUnderPartyVisibility:()=>true,isKoboldUnit:()=>false,isPlayerControlledUnit:u=>u.faction==='player'});
vm.runInContext(source.slice(source.indexOf('const unitReactionDeaths='),source.indexOf('function drawWhiteBattlefieldText')),c);
vm.runInContext(extractCombatFunction(render,'combatUnitTextAnchor'),c);
vm.runInContext(extractCombatFunction(render,'drawUnitBarks'),c);
assert.equal(c.unitReactionKind(blue,0),null);assert.equal(c.unitReactionKind(blue,5),'light');assert.equal(c.unitReactionKind(blue,6),'heavy');
c.showUnitReaction(blue,0);assert.equal(blue.barkText,undefined);
for(const damage of [1,6]){let last;for(let i=0;i<40;i++){c.showUnitReaction(blue,damage);assert.notEqual(blue.barkText,last);last=blue.barkText;assert.equal(blue.barkKind,damage===1?'light':'heavy');}}
c.showUnitReaction(red,2);c.drawUnitBarks();assert.equal(texts[0].color,'#59aaff');assert.equal(texts[1].color,'#ff5757');assert.notEqual(texts[0].y,texts[1].y,'Nearby lines stack');
for(const zoom of [.25,1,3]){c.battlefieldZoom=zoom;texts.length=0;c.drawUnitBarks();assert(texts.every(t=>t.font.includes('14px')),'Zoom cannot enlarge speech');}
red.alive=false;red.hp=0;c.showUnitReaction(red,30);assert.equal(red.barkKind,'death');const death=red.barkText;c.showUnitReaction(red,0,'death');assert.equal(red.barkText,death,'Repeated death hooks do not reroll');texts.length=0;c.drawUnitBarks();assert(texts.some(t=>t.text===death),'Fallen units retain their death cry');
assert.doesNotThrow(()=>JSON.stringify([blue,red]),'Speech cannot add circular game references');
now=2300;texts.length=0;c.drawUnitBarks();assert.equal(texts.length,0,'Speech expires');
const h=harness(),reactions=[];h.s.showUnitReaction=(u,damage)=>reactions.push({u,damage});h.b.alive=true;h.b.hp=20;h.b.maxHp=30;
h.s.r236ShowDamageText(h.b,6);h.s.candidateWithDamageBeatContext({category:'secondary-damage',damageType:'fire'},()=>h.s.r236ShowDamageText(h.b,2));
h.advance(0);assert.equal(reactions.length,0,'Primary damage precedes speech');h.advance(1000);assert.equal(reactions.length,0,'Secondary damage precedes speech');h.advance(2000);assert.equal(reactions[0].damage,6);h.advance(3000);assert.equal(reactions[1].damage,2);
const audio=fs.readFileSync('js/combat-selected-audio.js','utf8');assert(!audio.includes('male-injury'));assert(!audio.includes('female-death'));assert(audio.includes('step-grass'));assert(extractCombatFunction(source,'playDeathSound').includes('queueSfx'));assert(extractCombatFunction(source,'playAgonySound').includes('queueSfx'));
console.log('PASS injury threshold, damage-before-speech timing, nonrepeat text, death priority/visibility, faction colors, zoom size, stacking, expiry and restored generic cues without selected voices');

// Clearance is three feet beyond model height, with a zoom-invariant font.
blue.heightInches=72;c.battlefieldZoom=1;const anchor=c.combatUnitTextAnchor(blue);assert(Math.abs(anchor.y-(200-(72*.0254+.9144)*10))<1e-8);
const floats=fs.readFileSync('js/r236-floating-combat-text.js','utf8');
Object.assign(c,{getUnitById:()=>blue,r236FloatingTextUnitVisible:()=>true,r236FloatingTextStyle:()=>({fill:'#fff',stroke:'#000'}),r236FloatingCombatText:[{unitId:'u',text:'-6 dmg',kind:'damage',started:2300,duration:1000}],r236FloatingTextAnchor:()=>({x:0,y:0})});
vm.runInContext(extractCombatFunction(floats,'r236DrawFloatingCombatText'),c);texts.length=0;now=2350;c.r236DrawFloatingCombatText();const first=texts.at(-1);now=3200;c.r236DrawFloatingCombatText();assert.equal(texts.at(-1).y,first.y);assert.equal(ctx.globalAlpha,1);assert(first.font.includes('14px'));
