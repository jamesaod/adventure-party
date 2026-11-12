import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const source=fs.readFileSync('js/combat-movement.js','utf8');
const u={id:'player',x:0,y:0,alive:true,move:4,turnMoves:0,facingHex:0};let blocked=new Set(),wall=false,moves=0,halt=false;
const c={isQuickCommandUnit:()=>false,quickCommandRunning:false,game:{active:'player',round:1,over:false},hoverHex:{x:1,y:0},aimMode:false,pendingAimAction:null,
 activePlayerControlledUnit:()=>u,isCombatActionPauseActive:()=>false,allUnits:()=>[u],architecturalWalls:[],
 key:(x,y)=>x+','+y,HEX_DIRS:[{x:1,y:0},{x:0,y:1},{x:-1,y:1},{x:-1,y:0},{x:0,y:-1},{x:1,y:-1}],
 facingDirectionIndex:()=>0,unitFootprintDefinition:()=>({rotates:false}),footprintOffsetsForFacing:()=>[{x:0,y:0}],
 inside:(x,y)=>Math.abs(x)<=5&&Math.abs(y)<=5,isWall:(x,y)=>blocked.has(x+','+y),isFirBlockedHex:()=>false,occupiedByAnyUnit:()=>false,
 unitTransitionBlocked:(u,a,b)=>blocked.has(b.x+','+b.y),worldPointForHex:(x,y)=>({x:x+y/2,y:y*.8660254}),architecturalWallBlocksWorldLine:()=>wall,
 enemyAtHex:()=>null,log(){},draw(){},tryPlayerMove:async(dx,dy)=>{moves++;if(halt)return;u.x+=dx;u.y+=dy;u.turnMoves++;}};
vm.createContext(c);vm.runInContext(source.slice(0,source.indexOf('// Reversible walk experiment:')),c);
const a=source.indexOf('async function clickPathStep('),b=source.indexOf('function fleeStep(',a);vm.runInContext(source.slice(a,b),c);
assert(c.combatTacticalGridVisible());c.hoverHex=null;assert(!c.combatTacticalGridVisible());c.aimMode=true;assert(c.combatTacticalGridVisible());c.aimMode=false;
blocked.add('1,0');let cells=c.combatReachableMovement(u);assert(!cells.has('1,0'));assert.equal(cells.get('2,0').steps,3);assert(!cells.has('5,0'));
await c.clickPathStep({x:2,y:0});assert.equal(u.x,2);assert.equal(u.turnMoves,3);assert.equal(moves,3);
await c.clickPathStep({x:5,y:0});assert.equal(moves,3,'out of budget does not start');
u.x=0;u.y=0;u.turnMoves=0;halt=true;await c.clickPathStep({x:2,y:0});assert.equal(moves,4,'interrupted movement stops route');assert.equal(u.walkPresentation,undefined);
blocked.clear();const path=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:2,y:1}],smooth=c.prepareCombatWalkPath(u,path);
assert.notEqual(smooth[1].walkCurve[3].y,0,'intermediate turn does not pass through hex center');
for(let i=1;i<smooth.length;i++){assert(c.combatWalkCurveClear(u,smooth[i].walkCurve,0));if(i>1)assert.deepEqual(smooth[i].walkCurve[0],smooth[i-1].walkCurve[3]);}
assert.deepEqual(JSON.parse(JSON.stringify(smooth.at(-1).walkCurve[3])),path.at(-1));
c.isFirBlockedHex=(x,y)=>x===1&&y===0;assert(!c.combatWalkCurveClear(u,smooth[1].walkCurve,0),'tree rejects curve');c.isFirBlockedHex=()=>false;
c.occupiedByAnyUnit=(x,y)=>x===1&&y===0;assert(!c.combatWalkCurveClear(u,smooth[1].walkCurve,0),'unit rejects curve');c.occupiedByAnyUnit=()=>false;
wall=true;const tight=c.prepareCombatWalkPath(u,path);assert.deepEqual(JSON.parse(JSON.stringify(tight[1].walkCurve[3])),path[1],'wall rejects rounded shortcut');
console.log('PASS contextual grid, bounded legal destinations, detours, full routes, interruption, continuous rounded joins and wall clearance fallback');
