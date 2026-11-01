import {edgeLineBlocked,doorKey,edgeCells} from './exploration-edges.mjs?v=R238C232';
import {cellKey} from './exploration-core.mjs?v=R238C238';

export const discoveryKey = map => `adventure-party:explored:${map.id}:${JSON.stringify([map.version,map.grid,map.doors,map.edges])}`;
const opaque = (map,state,x,z) => !map.grid[z]?.[x] || map.grid[z][x]==='#' || (map.grid[z][x]==='D'&&!state.openDoors.has(cellKey(x,z)));

// Supercover grid ray: see the first blocking cell, never through it or a corner.
export function hasSight(map,state,tx,tz) {
  if(map.version===2&&edgeLineBlocked(map,state.openDoors,state,{x:tx,z:tz},'los'))return false;
  let x=state.x,z=state.z;
  const dx=tx-x,dz=tz-z,nx=Math.abs(dx),nz=Math.abs(dz),sx=Math.sign(dx),sz=Math.sign(dz);
  let ix=0,iz=0;
  while(ix<nx||iz<nz){
    const cross=(1+2*ix)*nz-(1+2*iz)*nx;
    if(cross===0){
      if(opaque(map,state,x+sx,z)||opaque(map,state,x,z+sz))return false;
      x+=sx;z+=sz;ix++;iz++;
    }else if(cross<0){x+=sx;ix++;}else{z+=sz;iz++;}
    if(x===tx&&z===tz)return true;
    if(opaque(map,state,x,z))return false;
  }
  return true;
}

export function restoreDiscovery(map,raw) {
  const result={discovered:new Set(),visible:new Set(),knownDoors:new Map()};
  try{
    const saved=JSON.parse(raw);
    if(saved?.version!==1||!Array.isArray(saved.cells))return result;
    for(const key of saved.cells){
      if(typeof key!=='string'||!/^\d+,\d+$/.test(key))continue;
      const [x,z]=key.split(',').map(Number);
      if(x<map.width&&z<map.height)result.discovered.add(cellKey(x,z));
    }
    for(const d of map.doors){const key=doorKey(d);if((map.version===2?edgeCells(map.edges.find(e=>e.id===d.id)).some(p=>result.discovered.has(cellKey(p.x,p.z))):result.discovered.has(key))&&typeof saved.doors?.[key]==='boolean')result.knownDoors.set(key,saved.doors[key]);}
  }catch{/* Missing or malformed browser saves start with blank parchment. */}
  return result;
}

export function revealDiscovery(map,state,discovery) {
  discovery.visible.clear();
  for(let z=0;z<map.height;z++)for(let x=0;x<map.width;x++){
    if(hasSight(map,state,x,z)){const key=cellKey(x,z);discovery.visible.add(key);discovery.discovered.add(key);}
  }
  for(const d of map.doors){const key=doorKey(d);if(map.version===2?edgeCells(map.edges.find(e=>e.id===d.id)).some(p=>discovery.visible.has(cellKey(p.x,p.z))):discovery.visible.has(key))discovery.knownDoors.set(key,state.openDoors.has(key));}
  return discovery;
}

export function saveDiscovery(discovery) {
  return JSON.stringify({version:1,cells:[...discovery.discovered],doors:Object.fromEntries(discovery.knownDoors)});
}
