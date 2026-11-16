import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {extractCombatFunction as fn} from './combat-test-source.mjs';
const old=fs.readFileSync('js/r220-mob-hazard-awareness.js','utf8'),modern=fs.readFileSync('js/r222-perception-darkness-volume.js','utf8');
const dist=(a,b)=>(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.x+a.y-b.x-b.y))/2;
const tree=new Set(),hazards=new Set(),blocked=(a,b)=>((a.x<2&&b.x>=2)||(b.x<2&&a.x>=2))&&Math.min(a.y,b.y)<4;
let sight=true;const c=vm.createContext({console,Math,Map,Set,Infinity,game:{round:1,turnIndex:0},HEX_DIRS:[{x:1,y:0},{x:0,y:1},{x:-1,y:1},{x:-1,y:0},{x:0,y:-1},{x:1,y:-1}],key:(x,y)=>x+','+y,inside:(x,y)=>x>=0&&x<=6&&y>=0&&y<=6,isWall:()=>false,isFirBlockedHex:(x,y)=>tree.has(x+','+y),allUnits:()=>[],occupiedHexesAt:(_m,x,y)=>[{x,y}],facingDirectionIndex:()=>0,architecturalWallBlocksStep:blocked,r220MobHazardCostAt:(_m,x,y)=>hazards.has(x+','+y)?30:0,hexDistance:dist,canMeleeReach:(a,b)=>dist(a,b)===1&&!blocked(a,b),r220MobCanSeeUnit:()=>sight,r220MobMemory:m=>m.memory||(m.memory={targets:{}}),r220TargetMemoryLifetime:()=>4,r220Clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),approachDistanceAt:(m,x,y,t)=>dist({x,y},t)});
for(const name of ['r220RememberVisibleTarget','r220TargetMemoryRecord','r220PursuitPointForTarget','r220MobStepCost','r220ReconstructPath','r220WeightedPathToAdjacent'])vm.runInContext(fn(old,name),c);
for(const name of ['r222PlanningCellBlocked','r222PlanningCanStandAt','r222PlanningTransitionBlocked'])vm.runInContext(fn(modern,name),c);
c.AdventurePartyCombatServices={register:(name,_stage,f)=>c[name]=f};
for(const name of ['r220WeightedPathSearch','r220WeightedClosestReachable']){const start=modern.indexOf("AdventurePartyCombatServices.register('"+name+"'");const end=modern.indexOf('\n});',start)+4;vm.runInContext(modern.slice(start,end),c);}
for(const type of ['orc','kobold','future-mob']){
 const mob={id:type,type,controller:'mob',x:1,y:1,move:1},target={id:'carl',x:3,y:1};sight=true;
 const path=c.r220WeightedPathToAdjacent(mob,target);assert(path.length>3,'Window barrier requires detour');for(let i=1;i<path.length;i++)assert(!blocked(path[i-1],path[i]));
 const step=c.r220WeightedClosestReachable(mob,target,1);assert.equal(step.length,2,'Must begin a detour even if target distance initially increases');
 const remembered=c.r220PursuitPointForTarget(mob,target);sight=false;target.x=6;const pursuit=c.r220PursuitPointForTarget(mob,target);assert.equal(pursuit.x,remembered.x,'Hidden movement must not update remembered target location');
}
tree.add('1,2');assert(c.r222PlanningCellBlocked({id:'orc'},{x:1,y:2}),'Fir blocker applies to planning');assert(c.r222PlanningTransitionBlocked({id:'orc'},{x:1,y:1},{x:1,y:2}));tree.clear();
hazards.add('1,2');assert(c.r220MobStepCost({}, {x:1,y:2})>c.r220MobStepCost({}, {x:0,y:2}),'Generic planner retains hazard risk');
console.log('PASS shared multi-species window detours, turn budget, fir blockers, last-seen memory and hazard costs');
