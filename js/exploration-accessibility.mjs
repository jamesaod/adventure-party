import {quarterAt,quarterFloor,quarterContains} from './quarter-walls.mjs?v=R238C267';
import {quarterOutsidePolygons} from './wall-surfaces.mjs?v=R238C267';
import {effectiveEdges,edgeGeometry} from './exploration-edges.mjs?v=R238C267';
import {quarterSegments} from './quarter-walls.mjs?v=R238C267';
import {isOutdoor} from './exploration-environment.mjs?v=R238C262';
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
 for(const [k,list] of edges)if(list.length===2&&!blocked.has(k)){nodes[list[0].id].links.push(list[1].id);nodes[list[1].id].links.push(list[0].id);}
 const queue=[],seed=id=>{if(id!==undefined&&!nodes[id].reachable){nodes[id].reachable=true;queue.push(id);}};
 const nodeAt=p=>{const c=cells.get(`${Math.floor(p.x+.5)},${Math.floor(p.z+.5)}`);return c?(c.q&&!quarterContains(c.q,p)?c.outside[0]:c.inside):undefined;};
 for(const p of [origin,map.start,...map.entrances||[],...map.exits||[]])if(p)seed(nodeAt(p));
 for(const [k,list] of edges)if(list.length===1&&!blocked.has(k))seed(list[0].id);
 for(const [id,n] of nodes.entries())if((n.x===0||n.z===0||n.x===map.width-1||n.z===map.height-1)&&isOutdoor(map,n.x,n.z))seed(id);
 for(let i=0;i<queue.length;i++)for(const next of nodes[queue[i]].links)seed(next);
 const result={at(p){const id=nodeAt(p);return id===undefined||nodes[id].reachable;},nodes};
 cache.set(map,{grid:map.grid,edges:map.edges,quarters:map.quarterWalls,environment:map.environment,signature,result});return result;
}
