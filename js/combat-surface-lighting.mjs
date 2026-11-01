// Continuous surface fragments retain tactical hex ownership without moving walls.
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function polygonArea(p){return p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.y-a.y*b.x;},0)/2;}
export function polygonCenter(p){return p.reduce((s,a)=>({x:s.x+a.x/p.length,y:s.y+a.y/p.length}),{x:0,y:0});}
export function clipPolygon(subject,clip){
 let out=subject,sign=polygonArea(clip)>=0?1:-1;
 for(let i=0;i<clip.length&&out.length;i++){
  const a=clip[i],b=clip[(i+1)%clip.length],input=out;out=[];
  let prev=input.at(-1),dp=sign*cross(a,b,prev);
  for(const next of input){const dn=sign*cross(a,b,next);
   if((dn>=-1e-8)!==(dp>=-1e-8)){const t=dp/(dp-dn);out.push({x:prev.x+(next.x-prev.x)*t,y:prev.y+(next.y-prev.y)*t});}
   if(dn>=-1e-8)out.push(next);prev=next;dp=dn;
  }
 }
 return out.length>=3&&Math.abs(polygonArea(out))>1e-7?out:[];
}
export function hexPolygon(q,r,w=64,row=31.5){const x=(q+r/2)*w,y=r*row,h=row*4/3;return [[0,-h/2],[w/2,-h/4],[w/2,h/4],[0,h/2],[-w/2,h/4],[-w/2,-h/4]].map(([dx,dy])=>({x:x+dx,y:y+dy}));}
export function worldHex(p,w=64,row=31.5){return {x:p.x/w-p.y/(2*row),y:p.y/row};}
function bounds(p){return {left:Math.min(...p.map(v=>v.x)),right:Math.max(...p.map(v=>v.x)),top:Math.min(...p.map(v=>v.y)),bottom:Math.max(...p.map(v=>v.y))};}
// Spatial buckets make this proportional to the visible floor, not total map size.
export function floorFragmentIndex(spaces,w=64,row=31.5){
 const buckets=new Map(),cache=new Map(),size=w*2;
 for(const space of spaces){const p=space.polygon,b=bounds(p);for(let x=Math.floor(b.left/size);x<=Math.floor(b.right/size);x++)for(let y=Math.floor(b.top/size);y<=Math.floor(b.bottom/size);y++){const k=x+','+y;if(!buckets.has(k))buckets.set(k,new Set());buckets.get(k).add(p);}}
 return tile=>{const key=tile.x+','+tile.y;if(cache.has(key))return cache.get(key);
  const hex=hexPolygon(tile.x,tile.y,w,row),b=bounds(hex),candidates=new Set();
  for(let x=Math.floor(b.left/size);x<=Math.floor(b.right/size);x++)for(let y=Math.floor(b.top/size);y<=Math.floor(b.bottom/size);y++)for(const p of buckets.get(x+','+y)||[])candidates.add(p);
  const result=[];for(const p of candidates){const polygon=clipPolygon(hex,p);if(polygon.length)result.push({polygon,point:worldHex(polygonCenter(polygon),w,row),hex:tile});}cache.set(key,result);return result;
 };
}
export function faceLightFragments(face,w=64,row=31.5){
 const faceBounds=bounds(face.points),out=[];const low=Math.min(...face.points.map(p=>p.elevation||0)),high=Math.max(...face.points.map(p=>p.elevation||0));
 for(let r=Math.floor(faceBounds.top/row)-1;r<=Math.ceil(faceBounds.bottom/row)+1;r++)for(let q=Math.floor(faceBounds.left/w-r/2)-1;q<=Math.ceil(faceBounds.right/w-r/2)+1;q++){
  const hex=hexPolygon(q,r,w,row);
  if(face.cap){const p=clipPolygon(face.points,hex);if(p.length)out.push({...face,points:p.map(v=>({...v,elevation:high})),point:worldHex(polygonCenter(p),w,row),hex:{x:q,y:r}});continue;}
  const a=face.points[0],b=face.points[1],sign=polygonArea(hex)>=0?1:-1;let lo=0,hi=1;
  for(let i=0;i<hex.length;i++){const v=hex[i],u=hex[(i+1)%hex.length],c=sign*cross(v,u,a),d=sign*(cross(v,u,b)-cross(v,u,a));if(Math.abs(d)<1e-9){if(c<0){hi=-1;break;}}else if(d>0)lo=Math.max(lo,-c/d);else hi=Math.min(hi,-c/d);}
  if(hi-lo<1e-7)continue;const at=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});const s=at(lo),e=at(hi),mid=at((lo+hi)/2);
  out.push({...face,lo,hi,points:[{...s,elevation:low},{...e,elevation:low},{...e,elevation:high},{...s,elevation:high}],point:worldHex(mid,w,row),hex:{x:q,y:r}});
 }
 if(face.cap)return out;
 // A vertical face exactly on a shared hex edge belongs to both closed
 // polygons. Partition its parameter once so exposure never doubles there.
 const cuts=[...new Set(out.flatMap(p=>[p.lo,p.hi]))].sort((a,b)=>a-b),unique=[],a=face.points[0],b=face.points[1];
 const at=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
 for(let i=1;i<cuts.length;i++){const lo=cuts[i-1],hi=cuts[i];if(hi-lo<1e-7)continue;const mid=(lo+hi)/2,owner=out.find(p=>mid>=p.lo-1e-8&&mid<=p.hi+1e-8);if(!owner)continue;
  const s=at(lo),e=at(hi);unique.push({...face,points:[{...s,elevation:low},{...e,elevation:low},{...e,elevation:high},{...s,elevation:high}],point:worldHex(at(mid),w,row),hex:owner.hex});
 }
 return unique;
}
// Stable topological order: use wall side at the actor's foot, never a long
// diagonal wall's far endpoint. Unrelated scenery retains its painter order.
export function orderSurfaceActors(actors,project,unitPoint){
 const base=[...actors].sort((a,b)=>a.sortY-b.sortY||a.sortX-b.sortX),edges=base.map(()=>new Set()),degree=base.map(()=>0);
 const add=(a,b)=>{if(!edges[a].has(b)){edges[a].add(b);degree[b]++;}};
 for(let i=0;i<base.length;i++)if(base[i].wall)for(let j=0;j<base.length;j++)if(base[j].entity){
  const wall=base[i].wall,a=project(wall.a),b=project(wall.b),p=project(unitPoint(base[j].entity));
  if(p.x<Math.min(a.x,b.x)-24||p.x>Math.max(a.x,b.x)+24)continue;
  if(Math.abs(b.x-a.x)<.01)continue;
  const t=Math.max(0,Math.min(1,(p.x-a.x)/(b.x-a.x))),y=a.y+(b.y-a.y)*t;
  if(Math.abs(p.y-y)>120)continue;
  if(p.y>=y-.01)add(i,j);else add(j,i);
 }
 const done=new Set(),result=[];
 while(result.length<base.length){let i=base.findIndex((_,j)=>!done.has(j)&&degree[j]===0);if(i<0)i=base.findIndex((_,j)=>!done.has(j));done.add(i);result.push(base[i]);for(const j of edges[i])degree[j]--;}
 return result;
}
