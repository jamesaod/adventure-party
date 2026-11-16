import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {extractCombatFunction} from './combat-test-source.mjs';
const main=readFileSync('js/adventure-party.js','utf8'),hooks=readFileSync('js/exploration-combat-hooks.js','utf8');
const polygon=[{x:0,y:0},{x:64,y:0},{x:64,y:42},{x:0,y:42}],spaces=[{environment:'outdoor',polygon},{environment:'indoor',polygon:polygon.map(p=>({x:p.x+16,y:p.y+8}))}];
const c=vm.createContext({architecturalSpaces:spaces});
for(const name of ['cross2','pointInConvexPolygon','architecturalSpaceAtWorldPoint'])vm.runInContext(extractCombatFunction(main,name),c);
const real=c.pointInConvexPolygon;let checks=0;c.pointInConvexPolygon=(...args)=>{checks++;return real(...args);};
for(let x=-1;x<90;x+=3)for(let y=-1;y<55;y+=3){const point={x,y},expected=[...spaces].reverse().find(s=>real(point,s.polygon))||null;assert.equal(c.architecturalSpaceAtWorldPoint(point),expected);const before=checks;assert.equal(c.architecturalSpaceAtWorldPoint(point),expected);assert.equal(checks,before,'Repeated exact queries skip polygon scans');}
for(const x of [-.000001,0,64,64.000001])assert.equal(c.architecturalSpaceAtWorldPoint({x,y:0}),[...spaces].reverse().find(s=>real({x,y:0},s.polygon))||null,'Boundary tolerance unchanged');
c.architecturalSpaces=[];assert.equal(c.architecturalSpaceAtWorldPoint({x:20,y:20}),null,'New encounter clears cached indoor hits');
for(let x=0;x<9000;x++)c.architecturalSpaceAtWorldPoint({x,y:99});assert(c.architecturalSpaceAtWorldPoint.cache.points.size<=8192);
let builds=0,clipped;class Path {constructor(){builds++;this.points=[];}moveTo(x,y){this.points.push(['M',x,y]);}lineTo(x,y){this.points.push(['L',x,y]);}closePath(){this.points.push(['Z']);}}
const clip=vm.createContext({Path2D:Path,combatSceneTerrain:{spaces},ctx:{clip:p=>{clipped=p;}}});vm.runInContext(extractCombatFunction(hooks,'clipExplorationFloor'),clip);
for(let angle=0;angle<6;angle++)for(const pan of [0,80]){
 const a=angle*Math.PI/3;clip.screenPointForWorld=p=>({x:p.x*Math.cos(a)-p.y*Math.sin(a)+pan,y:p.x*Math.sin(a)+p.y*Math.cos(a)});
 clip.clipExplorationFloor();const first=clipped,count=builds;clip.clipExplorationFloor();assert.equal(clipped,first);assert.equal(builds,count,'Reuse same-view clip');
 const expected=[];for(const s of spaces){s.polygon.forEach((p,i)=>{const q=clip.screenPointForWorld(p);expected.push([i?'L':'M',q.x,q.y]);});expected.push(['Z']);}assert.deepEqual(clipped.points,expected,'Exact original clipping commands at every view');
}
const old=clipped;clip.combatSceneTerrain={spaces:[spaces[0]]};clip.clipExplorationFloor();assert.notEqual(clipped,old);assert.equal(clipped.points.length,5);
const webgl=readFileSync('js/combat-webgl.mjs','utf8');const snippet=webgl.slice(webgl.indexOf(' const canvasMethods='),webgl.indexOf(' function clearRaster'));
const events=[],raw={globalCompositeOperation:'source-over',fill(){events.push('fill');},clip(path){assert.equal(path,old);events.push('clip');}};
const adapter=vm.runInNewContext(snippet+';context',{raw,drawing:new Set(['fill']),flushUnits:()=>events.push('flush'),prepareBackdrop:()=>events.push('backdrop'),dirty:false});
assert.equal(adapter.fill,adapter.fill);adapter.clip(old);adapter.fill();adapter.globalCompositeOperation='multiply';adapter.fill();assert.deepEqual(events,['clip','flush','fill','flush','backdrop','fill']);
console.log('PASS exact bounded space queries, encounter reset, six-view clip reuse, and unchanged Canvas flush/backdrop behavior');
