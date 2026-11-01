import {paintEnvironment,paintAmbientLight} from './exploration-environment.mjs?v=R238C238';
import {upgradeEdgeMap,paintEdge,syncEdgeDoors,edgeCells,edgeKey,edgeBetween} from './exploration-edges.mjs?v=R238C232';
export {upgradeEdgeMap,paintEdge};
import {validateMap,cellKey} from './exploration-core.mjs?v=R238C238';

import {validateEncounters,encounterCells} from './exploration-encounters.mjs?v=R238C240';
export const DRAFT_KEY='adventure-party:exploration-draft:v1';
export const TEST_KEY='adventure-party:exploration-test:v1';
export const copy=value=>structuredClone(value);
export const newId=prefix=>`${prefix}-${crypto.randomUUID()}`;
const onFloor=(map,p)=>Number.isInteger(p?.x)&&Number.isInteger(p?.z)&&map.grid[p.z]?.[p.x]==='.';
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);

export function seedPack(map){
  const first=copy(map);first.entrances=[{id:'entry',name:'Main entrance',...first.start}];first.exits=[];
  return {format:'adventure-party-exploration',version:1,id:'tollhouse-adventure',name:'My adventure',maps:[first]};
}
export function blankMap(id,name){
  return {version:1,id,name,width:16,height:16,cellFeet:10,grid:Array.from({length:16},(_,z)=>z===0||z===15?'################':'#..............#'),start:{x:2,z:13,facing:0},doors:[],torches:[],landmarks:[],party:[],entrances:[{id:'entry',name:'Main entrance',x:2,z:13,facing:0}],exits:[]};
}

export function blankEdgeMap(id,name){const map=upgradeEdgeMap(blankMap(id,name));map.grid=Array.from({length:map.height},()=>'.'.repeat(map.width));return map;}

// Invalid drafts may be edited, but only complete, linked packs can be tested/exported.
export function packIssues(pack){
  const issues=[];
  if(pack?.format!=='adventure-party-exploration'||pack.version!==1||!Array.isArray(pack.maps)||!pack.maps.length||pack.maps.length>100)return ['Expected an Adventure Pack with 1–100 maps.'];
  const ids=new Set();
  for(const map of pack.maps){
    const label=typeof map?.name==='string'?map.name:'Unnamed map';
    if(!map||typeof map!=='object'){issues.push('Invalid map record.');continue;}
    if(!validId(map.id)||ids.has(map.id))issues.push(`${label}: map ID is missing, invalid or duplicated.`);ids.add(map.id);
    if(typeof map.name!=='string'||!map.name.trim()||map.name.length>100)issues.push(`${label}: give the map a name (100 characters maximum).`);
    if(map.cellFeet!==10)issues.push(`${label}: map squares must represent ten feet.`);
    if(!Array.isArray(map.party)||map.party.some(p=>!p||typeof p.name!=='string'||typeof p.role!=='string'||![p.ac,p.hp,p.maxHp].every(Number.isFinite)))issues.push(`${label}: invalid example party roster.`);
    try{validateMap(map);}catch(e){issues.push(`${label}: ${e.message}`);continue;}
    if(!Array.isArray(map.entrances)||!Array.isArray(map.exits)||!Array.isArray(map.torches)){issues.push(`${label}: entrances, exits and torches must be lists.`);continue;}
    issues.push(...validateEncounters(map).map(issue=>`${label}: ${issue}`));
    const entranceIds=new Set(),exitIds=new Set(),exitCells=new Set();
    for(const e of map.entrances){
      if(!validId(e?.id)||entranceIds.has(e.id)||typeof e.name!=='string'||!e.name.trim()||!onFloor(map,e)||!Number.isInteger(e.facing)||e.facing<0||e.facing>3)issues.push(`${label}: invalid or duplicated entrance.`);
      entranceIds.add(e?.id);
    }
    for(const e of map.exits){
      if(!validId(e?.id)||exitIds.has(e.id)||!onFloor(map,e)||exitCells.has(cellKey(e.x,e.z)))issues.push(`${label}: invalid or overlapping exit.`);
      exitIds.add(e?.id);exitCells.add(cellKey(e?.x,e?.z));
      const target=pack.maps.find(m=>m?.id===e?.targetMapId);
      if(!target?.entrances?.some(a=>a.id===e.targetEntranceId))issues.push(`${label}: exit destination is missing.`);
    }
    for(const t of map.torches)if(!onFloor(map,t))issues.push(`${label}: torch must be on a floor square.`);
    // Flood fill considers doors open, checking that authored connections can be reached.
    const seen=new Set([cellKey(map.start.x,map.start.z)]),queue=[map.start];
    for(let i=0;i<queue.length;i++)for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){
      const x=queue[i].x+dx,z=queue[i].z+dz,key=cellKey(x,z);
      if('.D'.includes(map.grid[z]?.[x]??'#')&&!seen.has(key)&&!(map.version===2&&map.edges.some(e=>e.kind!=='door'&&edgeKey(e)===edgeKey(edgeBetween(queue[i],{x,z})))) ){seen.add(key);queue.push({x,z});}
    }
    for(const e of [...map.entrances,...map.exits])if(!seen.has(cellKey(e.x,e.z)))issues.push(`${label}: entrance/exit at ${e.x+1}, ${e.z+1} cannot be reached from the start.`);
  }
  return [...new Set(issues)];
}
export function parsePack(text){
  if(text.length>2_000_000)throw Error('Adventure Pack is too large (2 MB maximum).');
  const pack=JSON.parse(text),issues=packIssues(pack);if(issues.length)throw Error(issues.join('\n'));return pack;
}
export function paintCell(map,x,z,tool,ambientPercent=0){
 if(map.version===2&&['wall','door-x','door-z'].includes(tool))throw Error('Choose an edge to place a wall or opening.');
 if(map.version===2&&tool==='void')tool='wall';

  if(map.version===2?(x<0||x>=map.width||z<0||z>=map.height):(x<1||x>map.width-2||z<1||z>map.height-2))throw Error('Keep the outer wall intact. Place exits on an interior floor square.');
  if(tool==='ambient'||tool==='ambient-default'){paintAmbientLight(map,x,z,tool==='ambient-default'?null:ambientPercent);return;}
  if(tool==='indoor'||tool==='outdoor'){paintEnvironment(map,x,z,tool==='outdoor');return;}
  if(tool==='start'){if(map.grid[z][x]!=='.')throw Error('The start must be on floor.');map.start={x,z,facing:map.start.facing};return;}
  if(tool==='torch'){if(map.grid[z][x]!=='.')throw Error('Place torches on floor.');const i=map.torches.findIndex(p=>p.x===x&&p.z===z);if(i<0)map.torches.push({x,z});else map.torches.splice(i,1);return;}
  const cell=tool==='wall'?'#':tool.startsWith('door-')?'D':'.';
  if(cell==='#'&&(map.encounters||[]).some(e=>Array.isArray(e.cells)&&encounterCells(e).some(p=>p.x===x&&p.z===z)))throw Error('Remove this square from its encounter area before painting a wall.');
  if(cell!=='.'&&[map.start,...map.entrances,...map.exits].some(p=>p.x===x&&p.z===z))throw Error('Move or remove the start, entrance or exit before blocking this square.');
  if(map.version===2)map.grid=[...map.grid];
  map.grid[z]=map.grid[z].slice(0,x)+cell+map.grid[z].slice(x+1);
  map.doors=map.doors.filter(d=>d.x!==x||d.z!==z);if(cell==='D')map.doors.push({x,z,axis:tool==='door-x'?'x':'z'});
  if(cell!=='.')map.torches=map.torches.filter(t=>t.x!==x||t.z!==z);
  if(map.version===2){map.edges=map.edges.filter(e=>edgeCells(e).every(p=>map.grid[p.z]?.[p.x]==='.')||e.kind==='wall'&&edgeCells(e).some(p=>map.grid[p.z]?.[p.x]==='.'));syncEdgeDoors(map);}
}
export function linkMaps(pack,sourceId,point,targetId,entranceId,returnLink=false){
  const source=pack.maps.find(m=>m.id===sourceId),target=pack.maps.find(m=>m.id===targetId),arrival=target?.entrances.find(e=>e.id===entranceId);
  if(!source||!target||!arrival||!onFloor(source,point))throw Error('Choose a floor square and a valid destination entrance.');
  if(returnLink&&target.exits.some(e=>e.x===arrival.x&&e.z===arrival.z))throw Error('The destination entrance already has an exit. Leave return connection unchecked or remove that exit first.');
  const exit={id:newId('exit'),x:point.x,z:point.z,targetMapId:targetId,targetEntranceId:entranceId};
  if(returnLink){
    let back=source.entrances.find(e=>e.x===point.x&&e.z===point.z);
    if(!back){back={id:newId('entrance'),name:'Return entrance',...point};source.entrances.push(back);}
    target.exits.push({id:newId('exit'),x:arrival.x,z:arrival.z,targetMapId:sourceId,targetEntranceId:back.id});
  }
  source.exits=source.exits.filter(e=>e.x!==point.x||e.z!==point.z);source.exits.push(exit);
  return exit;
}
export function destination(pack,mapId,x,z){
  const exit=pack.maps.find(m=>m.id===mapId)?.exits.find(e=>e.x===x&&e.z===z);
  if(!exit)return null;
  const map=pack.maps.find(m=>m.id===exit.targetMapId),entrance=map?.entrances.find(e=>e.id===exit.targetEntranceId);
  if(!map||!entrance)throw Error('Exit destination no longer exists. Return to the editor to repair it.');
  return {map,entrance};
}

export function resizeMap(map,width,height){
  if(![width,height].every(n=>Number.isInteger(n)&&n>=8&&n<=128))throw Error('Width and height must be whole numbers from 8 to 128.');
  const inside=p=>map.version===2?p.x>=0&&p.z>=0&&p.x<width&&p.z<height:p.x>0&&p.z>0&&p.x<width-1&&p.z<height-1;
  if(![map.start,...map.entrances,...map.exits,...map.doors,...map.torches,...(map.landmarks||[])].every(inside))throw Error('Move or remove starts, entrances, exits, doors, torches and landmarks outside the new boundary before shrinking.');
  if((map.encounters||[]).some(e=>!inside({x:e.spawnX,z:e.spawnZ})||encounterCells(e).some(p=>!inside(p))))throw Error('Move or remove encounters outside the new boundary before shrinking.');
  if(map.version===2&&(map.edges||[]).some(e=>e.x>=(e.axis==='h'?width:width+1)||e.z>=(e.axis==='h'?height+1:height)))throw Error('Move or remove wall edges outside the new boundary before shrinking.');
  const grid=Array.from({length:height},(_,z)=>Array.from({length:width},(_,x)=>map.version===2?(map.grid[z]?.[x]||'.'):(x===0||z===0||x===width-1||z===height-1?'#':map.grid[z]?.[x]||'.')).join(''));
  const environment=map.environment?Array.from({length:height},(_,z)=>Array.from({length:width},(_,x)=>map.environment[z]?.[x]||'i').join('')):undefined;
  const ambientLight=map.ambientLight?Array.from({length:height},(_,z)=>Array.from({length:width},(_,x)=>map.ambientLight[z]?.[x]??null)):undefined;
  validateMap({...map,width,height,grid,environment,ambientLight});Object.assign(map,{width,height,grid,...(environment?{environment}:{}),...(ambientLight?{ambientLight}:{})});return map;
}

// Selection itself is transient; these helpers mutate only explicit author actions.
export function rectangleSelection(a,b,base=[],mode='replace'){
  const keys=new Set(mode==='replace'?[]:base);
  for(let z=Math.min(a.z,b.z);z<=Math.max(a.z,b.z);z++)for(let x=Math.min(a.x,b.x);x<=Math.max(a.x,b.x);x++){
    const key=`${x},${z}`;if(mode==='subtract')keys.delete(key);else keys.add(key);
  }
  return [...keys];
}
export function setEncounterArea(map,record,cells){
  const unique=new Map();for(const p of cells)if(p.x>=(map.version===2?0:1)&&p.z>=(map.version===2?0:1)&&p.x<map.width-(map.version===2?0:1)&&p.z<map.height-(map.version===2?0:1)&&'.D'.includes(map.grid[p.z]?.[p.x]??'#'))unique.set(`${p.x},${p.z}`,{x:p.x,z:p.z});
  const area=[...unique.values()].sort((a,b)=>a.z-b.z||a.x-b.x);if(!area.length)throw Error('Select floor or door squares for this encounter area.');
  const next={...record,cells:area};delete next.x;delete next.z;delete next.width;delete next.height;
  const events=(map.encounters||[]).filter(e=>e.id!==record.id);events.push(next);
  const issues=validateEncounters({...map,encounters:events});if(issues.length)throw Error(issues.join('\n'));
  map.encounters=events;return next;
}
export function removeEncounterSquares(map,keys){
  const selected=new Set(keys),remaining=[];
  for(const event of map.encounters||[]){
    const old=encounterCells(event),cells=old.filter(p=>!selected.has(`${p.x},${p.z}`));
    if(cells.length===old.length){remaining.push(event);continue;}
    if(cells.length){const next={...event,cells:cells.filter(p=>'.D'.includes(map.grid[p.z]?.[p.x]??'#'))};delete next.x;delete next.z;delete next.width;delete next.height;if(next.cells.length)remaining.push(next);}
  }
  map.encounters=remaining;
}
export function deleteSelectedEncounters(map,keys){
  const selected=new Set(keys);map.encounters=(map.encounters||[]).filter(e=>!encounterCells(e).some(p=>selected.has(`${p.x},${p.z}`)));
}
