export const HANDOFF_KEY='adventure-party:exploration-combat:v1';
export const progressKey=scope=>`adventure-party:encounters:${scope}`;
export function readProgress(storage,scope){try{return JSON.parse(storage.getItem(progressKey(scope)))||{encounters:{},player:null};}catch{return {encounters:{},player:null};}}
// Explicit cells support irregular areas; old rectangular records remain readable.
export function encounterCells(event){
  if(Array.isArray(event.cells))return event.cells;
  if(![event.x,event.z,event.width,event.height].every(Number.isInteger)||event.width<1||event.height<1||event.width>128||event.height>128)return [];
  return Array.from({length:event.width*event.height},(_,i)=>({x:event.x+i%event.width,z:event.z+Math.floor(i/event.width)}));
}
export const encounterContains=(event,x,z)=>encounterCells(event).some(p=>p?.x===x&&p?.z===z);
export function encounterAt(map,state,progress){
  return (map.encounters||[]).find(e=>e.enabled!==false&&encounterContains(e,state.x,state.z)&&progress.encounters[e.id]?.outcome!=='victory');
}
export function validateEncounters(map){
  const issues=[],ids=new Set(),occupied=new Map();
  for(const e of map.encounters||[]){
    if(!e||typeof e.id!=='string'||ids.has(e.id)||typeof e.name!=='string'||!e.name.trim()){issues.push('Invalid or duplicate encounter identity.');continue;}ids.add(e.id);
    const cells=encounterCells(e),seen=new Set();
    if(!cells.length||cells.length>map.width*map.height)issues.push(`${e.name}: select at least one encounter square within the map.`);
    for(const p of cells){
      if(!Number.isInteger(p?.x)||!Number.isInteger(p?.z)||p.x<1||p.z<1||p.x>=map.width-1||p.z>=map.height-1){issues.push(`${e.name}: encounter region must stay inside the map.`);continue;}
      const k=`${p.x},${p.z}`;if(seen.has(k))issues.push(`${e.name}: duplicate encounter square.`);seen.add(k);
      if(Array.isArray(e.cells)&&!'.D'.includes(map.grid[p.z][p.x]))issues.push(`${e.name}: encounter squares must be floor or doors.`);
      if('.D'.includes(map.grid[p.z][p.x])){if(occupied.has(k)&&occupied.get(k)!==e.id)issues.push(`${e.name}: encounter areas cannot overlap.`);occupied.set(k,e.id);}
    }
    if(e.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(e.color))issues.push(`${e.name}: invalid encounter color.`);
    if(typeof e.mobId!=='string'||!e.mobId||!Number.isInteger(e.count)||e.count<1||e.count>6)issues.push(`${e.name}: choose a MOB and 1–6 opponents.`);
    if(!Number.isInteger(e.spawnX)||!Number.isInteger(e.spawnZ)||map.grid[e.spawnZ]?.[e.spawnX]!=='.')issues.push(`${e.name}: enemy deployment anchor must be on floor.`);
    if(cells.some(p=>Math.abs(e.spawnX-p?.x)>5||Math.abs(e.spawnZ-p?.z)>5))issues.push(`${e.name}: enemy anchor must be within five squares of every trigger square.`);
  }
  return [...new Set(issues)];
}
export function recordOutcome(progress,id,outcome,player,enemies){
  const next=structuredClone(progress);next.player=player;next.encounters[id]={outcome,player,enemies};return next;
}

// Exploration encounters use two tactical hex widths per exploration square (1:2).
// The engine's projected row scale is applied only at the final coordinate step.
export function terrainForEncounter(map,origin,openDoors,hexWidth=64,hexRow=31.5){
  const scale=2,cellW=hexWidth*scale,cellH=hexRow*scale/(Math.sqrt(3)/2),radius=5;
  const bounds={left:Math.max(0,origin.x-radius),right:Math.min(map.width-1,origin.x+radius),top:Math.max(0,origin.z-radius),bottom:Math.min(map.height-1,origin.z+radius)};
  const project=(x,z)=>({x:(x-origin.x)*cellW,y:(z-origin.z)*cellH});
  const floor=(x,z)=>x>=bounds.left&&x<=bounds.right&&z>=bounds.top&&z<=bounds.bottom&&'.D'.includes(map.grid[z]?.[x]??'#');
  const walls=[],spaces=[];
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
  const cellAt=(q,r)=>({x:Math.floor(origin.x+(q+r/2)/scale+.5),z:Math.floor(origin.z+r*Math.sqrt(3)/(2*scale)+.5)});
  return {walls,spaces,bounds,project,cellAt,cellW,cellH,scale,walkableHex:(q,r)=>{const p=cellAt(q,r);return floor(p.x,p.z)&&!(map.grid[p.z][p.x]==='D'&&!openDoors.has(`${p.x},${p.z}`));}};
}
