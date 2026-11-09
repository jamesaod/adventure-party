import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {harness} from './test-combat-result-panel.mjs';
const src=readFileSync('js/combat-environment-state.js','utf8');
let now=0,wall=null,redraw=0;
const math=Object.create(Math);math.random=()=>.5;
const c=vm.createContext({game:{},HEX_W:30,Math:math,performance:{now:()=>now},worldPointForHex:(x,y)=>({x:x*30,y:y*20}),environmentSquash:()=>.6,
 environmentHex:p=>({x:Math.round(p.x/30),y:Math.round(p.y/20)}),environmentRayHit:()=>wall,inside:()=>true,combatSceneTerrain:null,combatSceneContext:null,
 ensureTransientUnitFxLoop(){},draw(){redraw++;}});
vm.runInContext(src.slice(src.indexOf('// Encounter-local arrow blood')),c);
const a={x:0,y:0},b={x:3,y:0};c.startArrowBlood(a,b,0);assert.equal(c.game.bloodState,undefined);
c.startArrowBlood(a,b,5);const state=c.game.bloodState,burst=state.bursts[0];assert.equal(burst.drops.length,10);assert(burst.drops.every(d=>Math.hypot(d.end.x-burst.origin.x,(d.end.y-burst.origin.y)/.6)<=45),'Landing radius is bounded by 1.5 hexes');assert.equal(state.stains.length,0,'No stains before droplets land');
now=1200;assert.equal(c.settleCombatBlood(),false);assert.equal(state.stains.length,10);c.settleCombatBlood();assert.equal(state.stains.length,10,'Land each drop once');
wall={t:.25};c.startArrowBlood(a,b,5);assert(c.game.bloodState.bursts[0].drops.every(d=>Math.abs(d.end.x-90)<Math.abs(state.stains[0].point.x-90)),'Wall clips splatter travel');
for(let i=0;i<90;i++){c.startArrowBlood(a,b,2);now+=1200;c.settleCombatBlood();}assert.equal(state.stains.length,768,'Persistent stains have bounded storage');
c.game={};assert.equal(c.settleCombatBlood(),false);assert.equal(c.game.bloodState,undefined,'New battle starts clean');
const h=harness(),events=[];h.s.startArrowBlood=(a,b,n)=>events.push({a,b,n});
await h.s.window.AdventurePartyCombatResults.physical(async(a,b)=>{h.s.window.AdventurePartyCombatResults.physicalHit(a,b,4);h.s.r236ShowDamageText(b,4);return {hit:true,damage:4};},h.a,h.b);
assert.equal(events.length,0,'Blood waits for damage presentation');h.advance(0);assert.equal(events.length,1);h.advance(1000);assert.equal(events.length,1,'No repeated burst');
await h.s.window.AdventurePartyCombatResults.physical(async()=>({hit:false}),h.a,h.b);h.advance(2000);assert.equal(events.length,1,'Miss never emits blood');
const stale=harness();let leaked=0;stale.s.startArrowBlood=()=>leaked++;
await stale.s.window.AdventurePartyCombatResults.physical(async(a,b)=>{stale.s.window.AdventurePartyCombatResults.physicalHit(a,b,3);stale.s.r236ShowDamageText(b,3);return {hit:true};},stale.a,stale.b);stale.s.game={};stale.advance(0);assert.equal(leaked,0,'Old encounter cannot emit into next battle');
const effects=readFileSync('js/combat-effect-animation.js','utf8');assert(effects.includes('function drawArrowBloodBurst'));
const env=readFileSync('js/combat-environment-actions.js','utf8');assert(env.includes('settleCombatBlood();drawCombatBloodStains();'));assert(env.includes('drawArrowBloodBurst(burst)'));
console.log('PASS arrow blood timing, miss suppression, ballistic settlement, walls, persistence caps and encounter isolation');

// Exercise cached stain rendering with a lightweight Canvas boundary.
let stamps=0,painted=0;const brush={beginPath(){},ellipse(){},fill(){}};
Object.assign(c,{game:{bloodState:state},HEX_W:30,HEX_ROW:20,document:{createElement:()=>{stamps++;return {getContext:()=>brush};}},
 ctx:{save(){},restore(){},transform(){},drawImage(){painted++;}},screenPointForWorld:p=>p,battlefieldProjectVector:p=>p,
 isHexVisibleToFriendlyParty:()=>true,combatSpriteBrightness:()=>.25});
const surfaces=readFileSync('js/combat-render-surfaces.js','utf8');vm.runInContext(surfaces.slice(surfaces.indexOf('function drawCombatBloodStains')),c);
c.drawCombatBloodStains();assert(painted>0);const built=stamps;c.drawCombatBloodStains();assert.equal(stamps,built,'Settled stains reuse cached per-hex stamps');
c.isHexVisibleToFriendlyParty=()=>false;const before=painted;c.drawCombatBloodStains();assert.equal(painted,before,'Hidden terrain does not reveal stains');
console.log('PASS cached stain rendering and friendly visibility gate');

// Uniform angular sampling covers all four quadrants; radial tails get progressively rarer.
for(const turn of [.125,.375,.625,.875]){let values=[turn,1];math.random=()=>values.shift();const p=c.sampleArrowBloodOffset();assert.equal(Math.sign(p.x),turn<.25||turn>.75?1:-1);assert.equal(Math.sign(p.y),turn<.5?1:-1);assert(Math.abs(Math.hypot(p.x,p.y)-45)<1e-8);}
let zero=[0,0];math.random=()=>zero.shift();assert.equal(Math.hypot(...Object.values(c.sampleArrowBloodOffset())),0,'Zero-distance splashes are allowed');
const bins=[0,0,0];for(let i=0;i<1000;i++){let values=[.2,(i+.5)/1000];math.random=()=>values.shift();const p=c.sampleArrowBloodOffset(),r=Math.hypot(p.x,p.y);assert(r<=45);bins[Math.min(2,Math.floor(r/15))]++;}assert(bins[0]>bins[1]&&bins[1]>bins[2],'Successive distance bands are less likely');
console.log('PASS 360-degree spread, 0–1.5 hex radius and declining radial probability');

const allPhysical=harness(),blood=[];allPhysical.s.startArrowBlood=(_a,_b,n)=>blood.push(n);
for(const type of ['physical','slashing','piercing','bludgeoning']){
 await allPhysical.s.window.AdventurePartyCombatResults.physical(async(a,b)=>{allPhysical.s.window.AdventurePartyCombatResults.physicalHit(a,b,3,type);allPhysical.s.r236ShowDamageText(b,3);return {hit:true};},allPhysical.a,allPhysical.b);
}
allPhysical.advance(4000);assert.equal(blood.length,4,'Physical damage types produce one burst per attack');
for(const type of ['fire','acid','cold','electricity','magic','poison'])allPhysical.s.window.AdventurePartyCombatResults.physicalHit(allPhysical.a,allPhysical.b,5,type);
allPhysical.s.window.AdventurePartyCombatResults.physicalHit(allPhysical.a,allPhysical.b,0);assert.equal(blood.length,4,'Elemental/nonphysical damage and zero damage produce no blood');
const meleeSource=readFileSync('js/combat-melee-actions.js','utf8'),missileSource=readFileSync('js/combat-missile-actions.js','utf8');
assert(meleeSource.indexOf('physicalHit?.(attacker,defender,directDamage)')>meleeSource.indexOf('const directDamage='));
assert.equal((missileSource.match(/physicalHit\?\.\(attacker,defender,damage\)/g)||[]).length,2,'Both bow and sling damaging hits use shared blood hook');
console.log('PASS melee, bow and sling hookup; physical types allowed; elemental damage excluded');
