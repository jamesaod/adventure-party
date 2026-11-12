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
export function orderSurfaceActors(actors,project,unitPoint,unitScreenPoint=u=>project(unitPoint(u))){
 const base=[...actors].sort((a,b)=>a.sortY-b.sortY||a.sortX-b.sortX),edges=base.map(()=>new Set()),degree=base.map(()=>0);
 const add=(a,b)=>{if(!edges[a].has(b)){edges[a].add(b);degree[b]++;}};
 const buckets=new Map(),size=128;
 for(let j=0;j<base.length;j++)if(base[j].entity){const p=unitScreenPoint(base[j].entity),key=Math.floor(p.x/size)+','+Math.floor(p.y/size);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push({j,p});}
 for(let i=0;i<base.length;i++)if(base[i].wall){
  const wall=base[i].wall,a=project(wall.a),b=project(wall.b);if(Math.abs(b.x-a.x)<.01)continue;
  const left=Math.min(a.x,b.x)-24,right=Math.max(a.x,b.x)+24,top=Math.min(a.y,b.y)-120,bottom=Math.max(a.y,b.y)+120;
  for(let x=Math.floor(left/size);x<=Math.floor(right/size);x++)for(let yCell=Math.floor(top/size);yCell<=Math.floor(bottom/size);yCell++)for(const {j,p} of buckets.get(x+','+yCell)||[]){
   if(p.x<left||p.x>right)continue;const t=Math.max(0,Math.min(1,(p.x-a.x)/(b.x-a.x))),y=a.y+(b.y-a.y)*t;
   if(Math.abs(p.y-y)>120)continue;if(p.y>=y-.01)add(i,j);else add(j,i);
  }
 }
 // A settled body is below feet crossing its ground footprint. Keep wall-side
 // constraints authoritative; distant bodies retain ordinary painter order.
 for(let i=0;i<base.length;i++)if(base[i].groundCorpse){
  const p=unitScreenPoint(base[i].entity),r=base[i].groundRadius;
  for(let x=Math.floor((p.x-r.x)/size);x<=Math.floor((p.x+r.x)/size);x++)for(let y=Math.floor((p.y-r.y)/size);y<=Math.floor((p.y+r.y)/size);y++)for(const {j,p:q} of buckets.get(x+','+y)||[])if(base[j].entity?.alive){
   if(((p.x-q.x)/r.x)**2+((p.y-q.y)/r.y)**2>1)continue;
   if(base.some((a,k)=>a.wall&&((edges[j].has(k)&&edges[k].has(i))||(edges[i].has(k)&&edges[k].has(j)))))continue;
   add(i,j);
  }
 }
 const done=new Uint8Array(base.length),result=[],heap=[];
 const push=v=>{let i=heap.length;heap.push(v);while(i){const p=(i-1)>>1;if(heap[p]<=v)break;heap[i]=heap[p];i=p;}heap[i]=v;};
 const pop=()=>{const value=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1]<heap[c])c++;if(heap[c]>=last)break;heap[i]=heap[c];i=c;}heap[i]=last;}return value;};
 for(let i=0;i<base.length;i++)if(!degree[i])push(i);let first=0;
 while(result.length<base.length){while(heap.length&&done[heap[0]])pop();while(done[first])first++;const i=heap.length?pop():first;done[i]=1;result.push(base[i]);for(const j of edges[i])if(--degree[j]===0&&!done[j])push(j);}
 return result;
}
