export const HANDOFF_KEY='adventure-party:exploration-combat:v1';
export const progressKey=scope=>`adventure-party:encounters:${scope}`;
export function readProgress(storage,scope){try{return JSON.parse(storage.getItem(progressKey(scope)))||{encounters:{},player:null};}catch{return {encounters:{},player:null};}}
export function encounterAt(map,state,progress){
  return (map.encounters||[]).find(e=>e.enabled!==false&&state.x>=e.x&&state.x<e.x+e.width&&state.z>=e.z&&state.z<e.z+e.height&&progress.encounters[e.id]?.outcome!=='victory');
}
export function validateEncounters(map){
  const issues=[],ids=new Set();
  for(const e of map.encounters||[]){
    if(!e||typeof e.id!=='string'||ids.has(e.id)||typeof e.name!=='string'||!e.name.trim()){issues.push('Invalid or duplicate encounter identity.');continue;}ids.add(e.id);
    if(![e.x,e.z,e.width,e.height].every(Number.isInteger)||e.width<1||e.height<1||e.x<1||e.z<1||e.x+e.width>map.width-1||e.z+e.height>map.height-1)issues.push(`${e.name}: encounter region must stay inside the map.`);
    if(typeof e.mobId!=='string'||!e.mobId||!Number.isInteger(e.count)||e.count<1||e.count>6)issues.push(`${e.name}: choose a MOB and 1–6 opponents.`);
    if(!Number.isInteger(e.spawnX)||!Number.isInteger(e.spawnZ)||map.grid[e.spawnZ]?.[e.spawnX]!=='.')issues.push(`${e.name}: enemy deployment anchor must be on floor.`);
    if(Math.abs(e.spawnX-e.x)>5||Math.abs(e.spawnZ-e.z)>5)issues.push(`${e.name}: deployment anchor must be within five squares of the trigger origin for this bounded test.`);
  }
  return issues;
}
export function recordOutcome(progress,id,outcome,player,enemies){
  const next=structuredClone(progress);next.player=player;next.encounters[id]={outcome,player,enemies};return next;
}

// Exploration encounters use two tactical hex widths per exploration square (2:1 combat expansion).
// The engine's projected row scale is applied only at the final coordinate step.
export function terrainForEncounter(map,origin,openDoors,hexWidth=64,hexRow=31.5){
  const scale=2,cellW=hexWidth*scale,cellH=hexRow*scale/(Math.sqrt(3)/2),radius=5;
  const bounds={left:Math.max(0,origin.x-radius),right:Math.min(map.width-1,origin.x+radius),top:Math.max(0,origin.z-radius),bottom:Math.min(map.height-1,origin.z+radius)};
  const project=(x,z)=>({x:(x-origin.x)*cellW,y:(z-origin.z)*cellH});
  const floor=(x,z)=>x>=bounds.left&&x<=bounds.right&&z>=bounds.top&&z<=bounds.bottom&&'.D'.includes(map.grid[z]?.[x]??'#');
  const walls=[],spaces=[],solidBlocks=[];
  const segment=(a,b,id)=>walls.push({id,a,b,height:35,thickness:3,material:'exploration-stone',blocksMovement:true,blocksLOS:true,blocksVolume:true,openings:[]});
  for(let z=bounds.top;z<=bounds.bottom;z++)for(let x=bounds.left;x<=bounds.right;x++){
    if(!floor(x,z))continue;
    const a=project(x-.5,z-.5),b=project(x+.5,z+.5);
    spaces.push({id:`floor-${x}-${z}`,environment:'indoor',floorColor:'#82745d',polygon:[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}]});
    if(!floor(x,z-1))segment(a,{x:b.x,y:a.y},`n-${x}-${z}`);
    if(!floor(x+1,z))segment({x:b.x,y:a.y},b,`e-${x}-${z}`);
    if(!floor(x,z+1))segment(b,{x:a.x,y:b.y},`s-${x}-${z}`);
    if(!floor(x-1,z))segment({x:a.x,y:b.y},a,`w-${x}-${z}`);
  }
  for(const d of map.doors||[]){if(!floor(d.x,d.z)||openDoors.has(`${d.x},${d.z}`))continue;segment(d.axis==='x'?project(d.x,d.z-.5):project(d.x-.5,d.z),d.axis==='x'?project(d.x,d.z+.5):project(d.x+.5,d.z),`door-${d.x}-${d.z}`);}
  // Solid footprints retain the source map's occupied cells. Shared internal
  // edges never enter walls: only floor-facing boundaries block rays/movement.
  for(let z=bounds.top;z<=bounds.bottom;z++)for(let x=bounds.left;x<=bounds.right;x++){
    if(map.grid[z]?.[x]!=='#')continue;
    const a=project(x-.5,z-.5),b=project(x+.5,z+.5),wallIds=[];
    for(const [dx,dz,side] of [[0,-1,'s'],[1,0,'w'],[0,1,'n'],[-1,0,'e']])if(floor(x+dx,z+dz))wallIds.push(`${side}-${x+dx}-${z+dz}`);
    solidBlocks.push({x,z,height:35,wallIds,polygon:[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}]});
  }
  const cellAt=(q,r)=>({x:Math.floor(origin.x+(q+r/2)/scale+.5),z:Math.floor(origin.z+r*Math.sqrt(3)/(2*scale)+.5)});
  return {walls,spaces,solidBlocks,bounds,project,cellAt,cellW,cellH,scale,walkableHex:(q,r)=>{const p=cellAt(q,r);return floor(p.x,p.z)&&!(map.grid[p.z][p.x]==='D'&&!openDoors.has(`${p.x},${p.z}`));}};
}
