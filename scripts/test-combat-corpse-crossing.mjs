import assert from 'node:assert/strict';
import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {extractCombatFunction} from './combat-test-source.mjs';
import {orderSurfaceActors} from '../js/combat-surface-lighting.mjs';
const source=readFileSync('js/adventure-party.js','utf8');
for(let angle=0;angle<6;angle++){
 const a=angle*Math.PI/3,project=p=>({x:p.x*Math.cos(a)-p.y*Math.sin(a),y:(p.x*Math.sin(a)+p.y*Math.cos(a))*.65625});
 const c=vm.createContext({occupiedHexes:u=>[{x:u.x,y:u.y}],hexCenter:(x,y)=>project({x,y}),battlefieldProjectVector:project,corpsePresentationOffset:u=>u.deathWorldOffset});
 vm.runInContext(extractCombatFunction(source,'unitDepthSortPoint'),c);
 const corpse={alive:false,x:0,y:0,deathWorldOffset:{x:3,y:2}};
 for(const t of [.3,.5,.7]){
  const live={alive:true,x:64,y:0,walkPresentation:{from:{x:-64,y:0},to:{x:64,y:0},t}};
  const p=c.unitDepthSortPoint(live),expected=project({x:-64+128*t,y:0});
  assert(Math.hypot(p.x-expected.x,p.y-expected.y)<1e-8,'Sort follows rendered feet during movement');
  const deadPoint=c.unitDepthSortPoint(corpse);
  const dead={id:'corpse',entity:corpse,groundCorpse:true,groundRadius:{x:38.4,y:25.2},sortY:deadPoint.y,sortX:deadPoint.x};
  const living={id:'live',entity:live,sortY:p.y,sortX:p.x};
  const ids=orderSurfaceActors([living,dead],project,u=>u,c.unitDepthSortPoint).map(a=>a.id);
  assert.deepEqual(ids,['corpse','live'],'Crossing feet stay above a settled body at every rotation');
 }
}
const corpse={id:'corpse',groundCorpse:true,groundRadius:{x:40,y:30},entity:{x:0,y:5,alive:false},sortY:5,sortX:0};
const live={id:'live',entity:{x:0,y:-5,alive:true},sortY:-5,sortX:0};
const wall={id:'wall',wall:{a:{x:-100,y:0},b:{x:100,y:0}},sortY:0,sortX:0};
assert.deepEqual(orderSurfaceActors([corpse,wall,live],p=>p,p=>p).map(a=>a.id),['live','wall','corpse'],'Never pull a unit through an intervening wall');
console.log('PASS corpse crossing in six camera directions, interpolated walking, and intervening walls');
