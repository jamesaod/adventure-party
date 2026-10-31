// Canonical shared edges: h(x,z) is the north edge of cell x,z;
// v(x,z) is its west edge. Coordinates are independent of any renderer.
export const edgeKey=e=>`${e.axis}:${e.x},${e.z}`;
export const doorKey=d=>d.id||`${d.x},${d.z}`;
export function edgeAtSide(x,z,side){return side==='n'?{axis:'h',x,z}:side==='s'?{axis:'h',x,z:z+1}:side==='e'?{axis:'v',x:x+1,z}:{axis:'v',x,z};}
export function edgeBetween(a,b){return edgeAtSide(a.x,a.z,b.x>a.x?'e':b.x<a.x?'w':b.z>a.z?'s':'n');}
export function edgeCells(e){return e.axis==='h'?[{x:e.x,z:e.z-1},{x:e.x,z:e.z}]:[{x:e.x-1,z:e.z},{x:e.x,z:e.z}];}
export function edgeGeometry(e){
 const a=e.axis==='h'?{x:e.x-.5,z:e.z-.5}:{x:e.x-.5,z:e.z-.5};
 const b=e.axis==='h'?{x:a.x+1,z:a.z}:{x:a.x,z:a.z+1};
 return {a,b,center:{x:(a.x+b.x)/2,z:(a.z+b.z)/2},axis:e.axis==='h'?'z':'x'};
}
const floor=(map,p)=>map.grid[p.z]?.[p.x]==='.';
const edgeCache=new WeakMap(),segmentCache=new WeakMap();
export function effectiveEdges(map){
 const cached=edgeCache.get(map);if(cached?.grid===map.grid&&cached.edges===map.edges)return cached.value;
 const all=new Map();
 for(let z=0;z<map.height;z++)for(let x=0;x<map.width;x++)if(floor(map,{x,z}))for(const side of ['n','e','s','w']){
  const e=edgeAtSide(x,z,side);if(edgeCells(e).some(p=>!floor(map,p)))all.set(edgeKey(e),{...e,id:edgeKey(e),kind:'wall',material:'stone',boundary:true});
 }
 for(const e of map.edges||[])all.set(edgeKey(e),e);
 const value=[...all.values()];edgeCache.set(map,{grid:map.grid,edges:map.edges,value});return value;
}
export function syncEdgeDoors(map){
 if(map.version!==2)return map;
 map.doors=(map.edges||[]).filter(e=>e.kind==='door').map(e=>{const g=edgeGeometry(e);return {...g.center,id:e.id||edgeKey(e),edgeId:edgeKey(e),axis:g.axis,material:e.material||'stone',width:e.width??.84,hinge:e.hinge||'start',initialOpen:!!e.initialOpen};});return map;
}
export function upgradeEdgeMap(input){
 const map=structuredClone(input);if(map.version===2)return syncEdgeDoors(map);
 const oldDoors=map.doors||[];map.version=2;map.grid=map.grid.map(row=>row.replaceAll('D','.'));map.edges=[];
 map.migrationNotes=oldDoors.map(d=>`Door ${d.x+1},${d.z+1} moved to its ${d.axis==='z'?'north':'west'} edge; former door square remains floor. Review its placement.`);
 for(const d of oldDoors)map.edges.push({axis:d.axis==='z'?'h':'v',x:d.x,z:d.z,id:`${d.x},${d.z}`,kind:'door',material:'stone',width:.84,hinge:'start',initialOpen:false});
 return syncEdgeDoors(map);
}
export function validateEdges(map){
 if(!Array.isArray(map.edges)||map.edges.length>2*map.width*map.height+map.width+map.height)throw Error('Invalid edge list.');
 const keys=new Set(),ids=new Set();
 for(const e of map.edges){
  if(!['h','v'].includes(e.axis)||!Number.isInteger(e.x)||!Number.isInteger(e.z)||e.x<0||e.z<0||e.x>(e.axis==='h'?map.width-1:map.width)||e.z>(e.axis==='h'?map.height:map.height-1))throw Error('Wall edge lies outside the map.');
  const key=edgeKey(e);if(keys.has(key)||typeof e.id!=='string'||!e.id||!/^[a-zA-Z0-9_:,.-]{1,120}$/.test(e.id)||ids.has(e.id))throw Error('Duplicate or missing wall edge identity.');keys.add(key);ids.add(e.id);
  if(!['wall','door','window'].includes(e.kind)||!['stone','wood'].includes(e.material||'stone'))throw Error('Invalid wall edge type or material.');
  const cells=edgeCells(e);if(!cells.some(p=>floor(map,p)))throw Error('Place wall edges beside floor.');
  if(e.kind!=='wall'){
   if(!cells.every(p=>floor(map,p)))throw Error('Doors and windows need floor on both sides.');
   if(!Number.isFinite(e.width)||e.width<.4||e.width>1)throw Error('Opening width must be 40–100% of its edge.');
   if(e.hinge!==undefined&&!['start','end'].includes(e.hinge))throw Error('Invalid door hinge.');
   if(e.initialOpen!==undefined&&typeof e.initialOpen!=='boolean')throw Error('Invalid initial door state.');
  }
 }
 // The serialized door list is a derived index; edges are authoritative.

}
export function paintEdge(map,edge,kind,settings={}){
 if(map.version!==2)throw Error('Convert this map to edge walls first.');
 if(kind==='erase'&&edgeCells(edge).some(p=>!floor(map,p)))throw Error('This boundary encloses void. Paint floor on its other side first.');
 const key=edgeKey(edge),old=(map.edges||[]).find(e=>edgeKey(e)===key),next=structuredClone(map);
 next.edges=next.edges.filter(e=>edgeKey(e)!==key);
 if(kind!=='erase')next.edges.push({...edge,id:old?.id||key,kind,material:settings.material||old?.material||'stone',...(kind!=='wall'?{width:settings.width??old?.width??.84,hinge:settings.hinge||old?.hinge||'start',initialOpen:settings.initialOpen??old?.initialOpen??false}:{})});
 syncEdgeDoors(next);validateEdges(next);map.edges=next.edges;map.doors=next.doors;
}
export function blockingEdgeSegments(map,opened,mode='movement'){
 const edges=effectiveEdges(map),key=mode+':'+[...opened].sort().join('|');let cache=segmentCache.get(map);if(cache?.edges!==edges){cache={edges,values:new Map()};segmentCache.set(map,cache);}if(cache.values.has(key))return cache.values.get(key);
 const result=[];
 for(const edge of edges){
  const g=edgeGeometry(edge),canPass=edge.kind==='door'&&opened.has(edge.id)||edge.kind==='window'&&['los','light'].includes(mode);
  const intervals=canPass?[[0,(1-edge.width)/2],[(1+edge.width)/2,1]]:[[0,1]];
  for(const [a,b] of intervals)if(b-a>1e-7)result.push({edge,a:{x:g.a.x+(g.b.x-g.a.x)*a,z:g.a.z+(g.b.z-g.a.z)*a},b:{x:g.a.x+(g.b.x-g.a.x)*b,z:g.a.z+(g.b.z-g.a.z)*b}});
 }
 if(cache.values.size>16)cache.values.clear();cache.values.set(key,result);return result;
}
export function edgeLineBlocked(map,opened,a,b,mode='movement'){
 const cross=(u,v)=>u.x*v.z-u.z*v.x,delta=(u,v)=>({x:v.x-u.x,z:v.z-u.z});
 return blockingEdgeSegments(map,opened,mode).some(s=>{
  const r=delta(a,b),v=delta(s.a,s.b),q=delta(a,s.a),den=cross(r,v);
  if(Math.abs(den)<1e-9){if(Math.abs(cross(q,r))>1e-9)return false;const length=r.x*r.x+r.z*r.z;if(!length)return false;const t=p=>((p.x-a.x)*r.x+(p.z-a.z)*r.z)/length;return Math.max(Math.min(t(s.a),t(s.b)),0)<Math.min(Math.max(t(s.a),t(s.b)),1);}
  const t=cross(q,v)/den,u=cross(q,r)/den;return t>1e-7&&t<1-1e-7&&u>=-1e-7&&u<=1+1e-7;
 });
}
