import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateMap,createExplorationState,act,walkable,cellKey} from '../js/exploration-core.mjs';
const map=JSON.parse(readFileSync(new URL('../data/exploration/old-tollhouse.json',import.meta.url)));
const original=JSON.stringify(map),s=createExplorationState(map);
for(let i=0;i<3;i++)assert.equal(act(map,s,'forward').moved,true);
assert.equal(s.z,10);assert.equal(act(map,s,'forward').changed,false);assert.equal(s.steps,3);
assert.equal(act(map,s,'door').open,true);assert.equal(act(map,s,'forward').moved,true);assert.equal(s.z,9);
assert.equal(act(map,s,'forward').moved,true);act(map,s,'right');act(map,s,'right');assert.equal(act(map,s,'door').open,false);
assert.equal(act(map,s,'forward').changed,false);assert.equal(act(map,s,'door').open,true);assert.equal(act(map,s,'forward').moved,true);
const turn=createExplorationState(map);act(map,turn,'left');assert.equal(turn.facing,3);act(map,turn,'right');assert.equal(turn.facing,0);act(map,turn,'strafeLeft');assert.equal(turn.x,2);act(map,turn,'strafeRight');assert.equal(turn.x,3);act(map,turn,'back');assert.equal(turn.z,14);assert.equal(act(map,turn,'back').changed,false);
assert.equal(walkable(map,turn,-1,0),false);assert.equal(act(map,turn,'door').changed,false);
const all=createExplorationState(map);map.doors.forEach(d=>all.openDoors.add(cellKey(d.x,d.z)));const queue=[[all.x,all.z]],seen=new Set([cellKey(all.x,all.z)]);
for(let i=0;i<queue.length;i++){const [x,z]=queue[i];for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){const nx=x+dx,nz=z+dz,key=cellKey(nx,nz);if(!seen.has(key)&&walkable(map,all,nx,nz)){seen.add(key);queue.push([nx,nz]);}}}
assert.equal(seen.size,map.grid.join('').replaceAll('#','').length,'Every traversable square must be reachable');
assert.equal(createExplorationState(map).openDoors.size,0);assert.equal(JSON.stringify(map),original);
const broken=structuredClone(map);broken.grid[0]='................';assert.throws(()=>validateMap(broken));
const missing=structuredClone(map);missing.doors.pop();assert.throws(()=>validateMap(missing));
console.log(`Exploration: collision, doors from both sides, relative movement, reset, map validation and ${seen.size} reachable squares passed.`);
