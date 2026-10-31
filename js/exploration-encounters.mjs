import {effectiveEdges,edgeGeometry,doorKey} from './exploration-edges.mjs?v=R238C232';
import {SCENE_STYLE,projectSceneObject} from './exploration-scene-style.mjs?v=R238C232';
export * from './exploration-scene-style.mjs?v=R238C232';
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
      if(!Number.isInteger(p?.x)||!Number.isInteger(p?.z)||p.x<(map.version===2?0:1)||p.z<(map.version===2?0:1)||p.x>=map.width-(map.version===2?0:1)||p.z>=map.height-(map.version===2?0:1)){issues.push(`${e.name}: encounter region must stay inside the map.`);continue;}
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
 if(map.version===2)return terrainForEdgeEncounter(map,origin,openDoors,hexWidth,hexRow);

  const scale=SCENE_STYLE.tacticalHexesPerCell,cellW=hexWidth*scale,cellH=hexRow*scale/(Math.sqrt(3)/2),radius=5;
  const bounds={left:Math.max(0,origin.x-radius),right:Math.min(map.width-1,origin.x+radius),top:Math.max(0,origin.z-radius),bottom:Math.min(map.height-1,origin.z+radius)};
  const project=(x,z)=>({x:(x-origin.x)*cellW,y:(z-origin.z)*cellH});
  const floor=(x,z)=>x>=bounds.left&&x<=bounds.right&&z>=bounds.top&&z<=bounds.bottom&&'.D'.includes(map.grid[z]?.[x]??'#');
  const walls=[],spaces=[];
  const segment=(a,b,id)=>walls.push({id,a,b,height:SCENE_STYLE.tacticalWallPixels,thickness:SCENE_STYLE.tacticalWallThickness,material:'exploration-stone',blocksMovement:true,blocksLOS:true,blocksVolume:true,openings:[]});
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
  return {walls,spaces,bounds,project,cellAt,cellW,cellH,scale,hexWidth,hexRow,doors:(map.doors||[]).filter(d=>floor(d.x,d.z)).map(d=>({...d,open:openDoors.has(`${d.x},${d.z}`),center:project(d.x,d.z)})),walkableHex:(q,r)=>{const p=cellAt(q,r);return floor(p.x,p.z);}};
}

// A straight, two-point crossing joins aligned standing hexes across an OPEN
// doorway. The intermediate NW/NE hex corners are not standing destinations.
export function doorwayCrossings(terrain,from,canStand,blocksLine){
  const world=p=>({x:(p.x+p.y/2)*terrain.hexWidth,y:p.y*terrain.hexRow});
  const start=world(from),routes=[];
  for(const door of terrain.doors||[]){
    if(!door.open)continue;
    const horizontal=door.axis==='z',normal=p=>horizontal?p.y-door.center.y:p.x-door.center.x,
      along=p=>horizontal?p.x-door.center.x:p.y-door.center.y;
    const gateWidth=horizontal?terrain.cellW:terrain.cellH;
    if(Math.abs(along(start))>gateWidth/2||Math.abs(normal(start))<.001)continue;
    for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){
      if(Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dx+dy))!==2)continue;
      const target={x:from.x+dx,y:from.y+dy},end=world(target);
      if(normal(start)*normal(end)>=0||Math.abs(along(end)-along(start))>.001)continue;
      if(Math.abs(along(end))>gateWidth/2||!canStand(target)||blocksLine(start,end))continue;
      routes.push({doorId:doorKey(door),from:{x:from.x,y:from.y},to:target,cost:2});
    }
  }
  return routes;
}

// Reach the near side of a doorway; stop short of its own blocking plane.
// Other architectural walls still prevent reaching around a corner.
export function closedDoorsInReach(terrain,from,blocksLine){
 const start={x:(from.x+from.y/2)*terrain.hexWidth,y:from.y*terrain.hexRow};
 return (terrain.doors||[]).filter(door=>{
  if(door.open)return false;
  const horizontal=door.axis==='z',dx=start.x-door.center.x,dy=start.y-door.center.y;
  const normal=horizontal?dy:dx,along=horizontal?dx:dy;
  const reach=horizontal?terrain.hexRow*(door.edgeId?1.8:1.1):terrain.hexWidth*(door.edgeId?1.6:1.1),span=horizontal?terrain.cellW:terrain.cellH;
  if(Math.abs(normal)<.001||Math.abs(normal)>reach||Math.abs(along)>span/2-3)return false;
  const near=horizontal?{x:start.x,y:door.center.y+Math.sign(normal)*.1}:{x:door.center.x+Math.sign(normal)*.1,y:start.y};
  return !blocksLine(start,near);
 });
}
// Door art uses the same leaf in both orientations. Edge-on leaves are folded
// into an oblique cutaway elevation; this is presentation, never collision.
export function combatDoorPresentation(door,terrain){
 const size=projectSceneObject('door',terrain).artwork,width=door.edgeId?(door.axis==='x'?terrain.cellH:terrain.cellW)*door.width:size.width*SCENE_STYLE.door.tacticalArtworkWidth;
 const oblique=door.axis==='x'?!door.open:door.open;
 const vx=door.edgeId?(door.axis==='x'?(door.open?width*.8:width*.6):(door.open?width*.42:width)):width*(oblique?.72:1),vy=door.edgeId?(door.axis==='x'?(door.open?width*.4:width):(door.open?width*.65:0)):(oblique?width*.34:0);
 const closedVx=door.edgeId?(door.axis==='x'?0:width):width*(door.axis==='x'?.72:1),closedVy=door.edgeId?(door.axis==='x'?width:0):(door.axis==='x'?width*.34:0);
 // Opening changes the leaf direction, never its grounded hinge position.
 const sign=door.hinge==='end'?-1:1;
 const hinge={x:door.center.x-sign*closedVx/2,y:door.center.y-sign*closedVy/2};
 return {base:hinge,vx:vx*sign,vy:vy*sign,width,height:size.height,open:door.open,oblique};
}
export function combatDoorFrame(door,terrain){
 const frame=combatDoorPresentation({...door,open:false},terrain),c=door.center;
 const a=door.axis==='x'?{x:c.x,y:c.y-terrain.cellH/2}:{x:c.x-terrain.cellW/2,y:c.y};
 const b=door.axis==='x'?{x:c.x,y:c.y+terrain.cellH/2}:{x:c.x+terrain.cellW/2,y:c.y};
 const start=frame.base,end=door.edgeId?{x:door.center.x+(door.hinge==='end'?-1:1)*(door.axis==='x'?0:frame.width/2),y:door.center.y+(door.hinge==='end'?-1:1)*(door.axis==='x'?frame.width/2:0)}:{x:start.x+frame.vx,y:start.y+frame.vy},left=door.hinge==='end'?end:start,right=door.hinge==='end'?start:end,height=SCENE_STYLE.tacticalWallPixels;
 const up=(p,h)=>({x:p.x,y:p.y-h});
 // Solid masonry piers and lintel leave only the actual doorway aperture clear.
 return {a,b,hinge:frame.base,polygons:[
  [a,left,up(left,height),up(a,height)],
  [right,b,up(b,height),up(right,height)],
  [up(left,frame.height),up(right,frame.height),up(right,height),up(left,height)]
 ]};
}

export function terrainForEdgeEncounter(map,origin,openDoors,hexWidth=64,hexRow=31.5){
 const scale=SCENE_STYLE.tacticalHexesPerCell,cellW=hexWidth*scale,cellH=hexRow*scale/(Math.sqrt(3)/2);
 const bounds={left:0,right:map.width-1,top:0,bottom:map.height-1};
 const project=(x,z)=>({x:(x-origin.x)*cellW,y:(z-origin.z)*cellH}),floor=(x,z)=>x>=bounds.left&&x<=bounds.right&&z>=bounds.top&&z<=bounds.bottom&&map.grid[z]?.[x]==='.';
 const walls=[],spaces=[],doors=[],windows=[];
 const segment=(a,b,id,extra={})=>walls.push({id,a,b,height:35,thickness:3,material:'exploration-stone',blocksMovement:true,blocksLOS:true,blocksVolume:true,openings:[],...extra});
 for(let z=bounds.top;z<=bounds.bottom;z++)for(let x=bounds.left;x<=bounds.right;x++)if(floor(x,z)){
  const a=project(x-.5,z-.5),b=project(x+.5,z+.5);spaces.push({id:`floor-${x}-${z}`,environment:'indoor',floorColor:'#82745d',polygon:[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}]});

 }
 for(const edge of effectiveEdges(map)){
  const g=edgeGeometry(edge);if(g.center.x<bounds.left-.5||g.center.x>bounds.right+.5||g.center.z<bounds.top-.5||g.center.z>bounds.bottom+.5)continue;
  const a=project(g.a.x,g.a.z),b=project(g.b.x,g.b.z),point=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}),id=`edge-${edge.id}`,width=edge.width??1;
  if(edge.kind==='wall'){segment(a,b,id,{edgeMaterial:edge.material});continue;}
  const record={...g.center,id:edge.id,edgeId:edge.id,axis:g.axis,width,material:edge.material,hinge:edge.hinge,center:project(g.center.x,g.center.z),open:openDoors.has(edge.id),wallId:id};
  if(edge.kind==='window'){
   windows.push(record);segment(a,b,id,{openings:[{id:id+'-glass',type:'window',edgeWindow:true,visualHeight:SCENE_STYLE.window.height/SCENE_STYLE.wallMetres*35,visualSill:SCENE_STYLE.window.sill/SCENE_STYLE.wallMetres*35,centerT:.5,widthWorld:Math.hypot(b.x-a.x,b.y-a.y)*width,glassWidthWorld:Math.hypot(b.x-a.x,b.y-a.y)*width}]});continue;
  }
  doors.push(record);const low=(1-width)/2,high=(1+width)/2;
  if(low>1e-6){segment(a,point(low),id+'-jamb-a',{edgeMaterial:edge.material});segment(point(high),b,id+'-jamb-b',{edgeMaterial:edge.material});}
  if(!record.open)segment(point(low),point(high),id,{doorLeaf:true});
 }
 const cellAt=(q,r)=>({x:Math.floor(origin.x+(q+r/2)/scale+.5),z:Math.floor(origin.z+r*Math.sqrt(3)/(2*scale)+.5)});
 return {walls,spaces,doors,windows,bounds,hexBounds:tacticalHexBounds(bounds,project,hexWidth,hexRow),project,cellAt,cellW,cellH,scale,hexWidth,hexRow,edgeBased:true,walkableHex:(q,r)=>{const p=cellAt(q,r);return floor(p.x,p.z);}};
}

// Cover the projected square map in axial coordinates, including its skew.
export function tacticalHexBounds(bounds,project,hexWidth,hexRow){
 const corners=[project(bounds.left-.5,bounds.top-.5),project(bounds.right+.5,bounds.top-.5),project(bounds.right+.5,bounds.bottom+.5),project(bounds.left-.5,bounds.bottom+.5)];
 const axial=corners.map(p=>({x:p.x/hexWidth-p.y/(2*hexRow),y:p.y/hexRow}));
 return {minX:Math.floor(Math.min(...axial.map(p=>p.x)))-2,maxX:Math.ceil(Math.max(...axial.map(p=>p.x)))+2,minY:Math.floor(Math.min(...axial.map(p=>p.y)))-2,maxY:Math.ceil(Math.max(...axial.map(p=>p.y)))+2};
}
