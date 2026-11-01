import {validateEnvironment} from './exploration-environment.mjs?v=R238C238';
import {validateEdges,syncEdgeDoors,normalizeDoorWidths,doorKey,edgeBetween,edgeKey,edgeLineBlocked} from './exploration-edges.mjs?v=R238C232';
export const FACINGS=['North','East','South','West'];
const vectors=[[0,-1],[1,0],[0,1],[-1,0]];
export const cellKey=(x,z)=>`${x},${z}`;
export function validateMap(map){
 if(map)validateEnvironment(map);
 if(map?.version===2){
  if(![map.width,map.height].every(n=>Number.isInteger(n)&&n>=8&&n<=128)||!Array.isArray(map.grid)||map.grid.length!==map.height||map.grid.some(row=>typeof row!=='string'||row.length!==map.width||/[^#.]/.test(row)))throw Error('Expected an edge map with floor/void grid and width/height 8–128.');
  const s=map.start;if(!Number.isInteger(s?.x)||!Number.isInteger(s?.z)||map.grid[s.z]?.[s.x]!=='.'||!Number.isInteger(s.facing)||s.facing<0||s.facing>3)throw Error('Invalid start.');
  normalizeDoorWidths(map);validateEdges(map);syncEdgeDoors(map);return map;
 }

 if(map?.version!==1||![map.width,map.height].every(n=>Number.isInteger(n)&&n>=8&&n<=128)||!Array.isArray(map.grid)||map.grid.length!==map.height||map.grid.some(r=>typeof r!=='string'||r.length!==map.width||/[^#.D]/.test(r)))throw Error('Expected an exploration map with width and height from 8 to 128.');
 if([...map.grid[0],...map.grid[map.height-1]].some(c=>c!=='#')||map.grid.some(row=>row[0]!=='#'||row[map.width-1]!=='#'))throw Error('Map boundary must be enclosed.');
 const s=map.start;
 if(!Number.isInteger(s?.x)||!Number.isInteger(s?.z)||map.grid[s.z]?.[s.x]!=='.'||!Number.isInteger(s.facing)||s.facing<0||s.facing>3)throw Error('Invalid start.');
 const seen=new Set();for(const d of map.doors||[]){const k=cellKey(d.x,d.z);if(!Number.isInteger(d.x)||!Number.isInteger(d.z)||map.grid[d.z]?.[d.x]!=='D'||!['x','z'].includes(d.axis)||seen.has(k))throw Error('Invalid door.');seen.add(k);}
 for(let z=0;z<map.height;z++)for(let x=0;x<map.width;x++)if(map.grid[z][x]==='D'&&!seen.has(cellKey(x,z)))throw Error('Door metadata missing.');
 return map;
}
export function createExplorationState(map){validateMap(map);return {...map.start,steps:0,openDoors:new Set(map.version===2?map.doors.filter(d=>d.initialOpen).map(doorKey):[]),visited:new Set([cellKey(map.start.x,map.start.z)])};}
export function walkable(map,state,x,z){const cell=map.grid[z]?.[x];return cell==='.'||cell==='D'&&state.openDoors.has(cellKey(x,z));}
export function act(map,state,action){
 if(action==='left'||action==='right'){state.facing=(state.facing+(action==='right'?1:3))%4;return {changed:true,message:`Facing ${FACINGS[state.facing]}.`};}
 const [dx,dz]=vectors[state.facing];
 if(action==='door'&&map.version===2){
  const key=edgeKey(edgeBetween(state,{x:state.x+dx,z:state.z+dz})),door=map.doors.find(d=>d.edgeId===key);
  if(!door)return {changed:false,message:'There is no door directly ahead.'};
  const id=doorKey(door),open=!state.openDoors.has(id);if(open)state.openDoors.add(id);else state.openDoors.delete(id);
  return {changed:true,door:id,open,message:open?'The door swings open.':'You close the door.'};
 }
 if(action==='door'){
  const x=state.x+dx,z=state.z+dz,k=cellKey(x,z);
  if(map.grid[z]?.[x]!=='D')return {changed:false,message:'There is no door directly ahead.'};
  const open=!state.openDoors.has(k);if(open)state.openDoors.add(k);else state.openDoors.delete(k);
  return {changed:true,door:k,open,message:open?'The old door swings open.':'You close the door.'};
 }
 const direction=({forward:[dx,dz],back:[-dx,-dz],strafeLeft:[dz,-dx],strafeRight:[-dz,dx]})[action];
 if(!direction)return {changed:false,message:'Unknown command.'};
 const x=state.x+direction[0],z=state.z+direction[1];
 if(map.version===2&&edgeLineBlocked(map,state.openDoors,state,{x,z}))return {changed:false,message:'A wall, window or closed door blocks the way. Use F beside a door.'};
 if(!walkable(map,state,x,z))return {changed:false,message:map.grid[z]?.[x]==='D'?'A closed door blocks the way. Press F or Open / Close.':'A stone wall blocks the way.'};
 state.x=x;state.z=z;state.steps++;state.visited.add(cellKey(x,z));
 return {changed:true,moved:true,message:map.landmarks?.find(l=>l.x===x&&l.z===z)?.text||null};
}
