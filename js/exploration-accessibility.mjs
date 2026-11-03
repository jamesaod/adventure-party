import {quarterAt,quarterFloor,quarterContains} from './quarter-walls.mjs?v=R238C273';
import {quarterOutsidePolygons} from './wall-surfaces.mjs?v=R238C273';
import {effectiveEdges,edgeGeometry} from './exploration-edges.mjs?v=R238C273';
import {quarterSegments} from './quarter-walls.mjs?v=R238C273';
const cache=new WeakMap(),key=p=>`${Math.round(p.x*1e8)},${Math.round(p.z*1e8)}`,edgeKey=(a,b)=>[key(a),key(b)].sort().join('|');
// Presentation connectivity treats every openable door as a passage, even when
// closed. Curves split their cells into actual inside/outside floor regions.
export function accessibleFloor(map,origin=map.start){
 if(map.version!==2)return {at:()=>true};
 const signature=JSON.stringify([origin,map.start,map.entrances,map.exits]),old=cache.get(map);
 if(old&&old.grid===map.grid&&old.edges===map.edges&&old.quarters===map.quarterWalls&&old.environment===map.environment&&old.signature===signature)return old.result;
 const nodes=[],cells=new Map(),edges=new Map(),blocked=new Set([...effectiveEdges(map).filter(e=>e.kind!=='door').map(edgeGeometry),...quarterSegments(map)].map(s=>edgeKey(s.a,s.b)));
 const add=(x,z,polygon,outside=false)=>{const node={x,z,polygon,outside,links:[],reachable:false},id=nodes.push(node)-1;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],k=edgeKey(a,b);if(!edges.has(k))edges.set(k,[]);edges.get(k).push({id,a,b});}return id;};
 for(let z=0;z<map.height;z++)for(let x=0;x<map.width;x++)if(map.grid[z]?.[x]==='.'){
  const q=quarterAt(map,x,z),inside=add(x,z,q?quarterFloor(q):[{x:x-.5,z:z-.5},{x:x+.5,z:z-.5},{x:x+.5,z:z+.5},{x:x-.5,z:z+.5}]),outside=q?quarterOutsidePolygons(q).map(p=>add(x,z,p,true)):[];cells.set(`${x},${z}`,{q,inside,outside});
 }
 for(const [k,list] of edges)if(list.length===2&&!blocked.has(k)&&Math.abs(list[0].a.x-list[0].b.x)>1e-8&&Math.abs(list[0].a.z-list[0].b.z)>1e-8){nodes[list[0].id].links.push(list[1].id);nodes[list[1].id].links.push(list[0].id);}
 // Neighbouring curved cells can divide a straight boundary into shorter
 // spans. Link actual overlaps; never treat an unmatched interior edge as an
 // entrance. This also lets full authored walls block partial boundary spans.
 const axis=p=>Math.abs(p.a.z-p.b.z)<1e-8?{line:'h:'+Math.round(p.a.z*1e8),lo:Math.min(p.a.x,p.b.x),hi:Math.max(p.a.x,p.b.x)}:Math.abs(p.a.x-p.b.x)<1e-8?{line:'v:'+Math.round(p.a.x*1e8),lo:Math.min(p.a.z,p.b.z),hi:Math.max(p.a.z,p.b.z)}:null;
 const barriers=new Map(),spans=new Map();
 for(const s of [...effectiveEdges(map).filter(e=>e.kind!=='door').map(edgeGeometry),...quarterSegments(map)]){const a=axis(s);if(a){if(!barriers.has(a.line))barriers.set(a.line,[]);barriers.get(a.line).push(a);}}
 for(const list of edges.values())for(const s of list){const a=axis(s);if(a){if(!spans.has(a.line))spans.set(a.line,[]);spans.get(a.line).push({...a,...s});}}
 for(const list of barriers.values())list.sort((a,b)=>a.lo-b.lo);
 const hasOpening=(line,lo,hi)=>{let cursor=lo;for(const block of barriers.get(line)||[]){if(block.hi<=cursor)continue;if(block.lo>cursor+1e-8)return true;cursor=Math.max(cursor,block.hi);if(cursor>=hi-1e-8)return false;}return cursor<hi-1e-8;};
 for(const [line,list] of spans){list.sort((a,b)=>a.lo-b.lo);for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length&&list[j].lo<list[i].hi-1e-8;j++){
  const a=list[i],b=list[j],lo=Math.max(a.lo,b.lo),hi=Math.min(a.hi,b.hi);if(a.id===b.id||hi-lo<1e-8)continue;
  if(!hasOpening(line,lo,hi))continue;
  nodes[a.id].links.push(b.id);nodes[b.id].links.push(a.id);
 }}
 const queue=[],seed=id=>{if(id!==undefined&&!nodes[id].reachable){nodes[id].reachable=true;queue.push(id);}};
 const nodeAt=p=>{const c=cells.get(`${Math.floor(p.x+.5)},${Math.floor(p.z+.5)}`);return c?(c.q&&!quarterContains(c.q,p)?c.outside[0]:c.inside):undefined;};
 for(const p of [origin,map.start,...map.entrances||[]])if(p)seed(nodeAt(p));
 // Only a genuinely open floor/void boundary is an exterior entrance. A
 // short curved-cell span beside another floor cell is NOT an entrance.
 for(const [line,list] of spans)for(const edge of list){const n=nodes[edge.id],horizontal=line[0]==='h',coordinate=horizontal?edge.a.z:edge.a.x,center=horizontal?n.z:n.x;if(Math.abs(Math.abs(coordinate-center)-.5)>1e-8)continue;const x=n.x+(horizontal?0:Math.sign(coordinate-center)),z=n.z+(horizontal?Math.sign(coordinate-center):0);if(map.grid[z]?.[x]!=='.'&&hasOpening(line,edge.lo,edge.hi))seed(edge.id);}

 for(let i=0;i<queue.length;i++)for(const next of nodes[queue[i]].links)seed(next);
 const result={at(p){const id=nodeAt(p);return id===undefined||nodes[id].reachable;},nodes};
 cache.set(map,{grid:map.grid,edges:map.edges,quarters:map.quarterWalls,environment:map.environment,signature,result});return result;
}
