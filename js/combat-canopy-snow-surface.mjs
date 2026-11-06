// Connect sampled canopy shelves without bridging large vertical gaps.
export function canopySnowSurface(columns,resolution,step){
 const vertices=[],faces=[];
 for(let i=0;i<columns.length;i++)for(const p of columns[i]){p.id=vertices.length;vertices.push(p);}
 const nearest=(column,y)=>column?.reduce((best,p)=>Math.abs(p.y-y)<Math.abs((best?.y??Infinity)-y)?p:best,null);
 for(let x=0;x<resolution-1;x++)for(let z=0;z<resolution-1;z++){
  const a=columns[x*resolution+z],b=columns[(x+1)*resolution+z],c=columns[x*resolution+z+1],d=columns[(x+1)*resolution+z+1];
  for(const p of a){const q=nearest(b,p.y),r=nearest(c,p.y),s=nearest(d,p.y);
   for(const tri of [[p,r,q],[q,r,s]])if(tri.every(Boolean)&&Math.max(...tri.map(v=>v.y))-Math.min(...tri.map(v=>v.y))<step*1.45)faces.push(tri.map(v=>v.id));
  }
 }
 // Relax small surface irregularities without connecting separate canopy tiers.
 const neighbors=vertices.map(()=>new Set());
 for(const f of faces)for(const a of f)for(const b of f)if(a!==b)neighbors[a].add(b);
 for(let pass=0;pass<2;pass++){
  const next=vertices.map((p,i)=>neighbors[i].size?Math.max(p.y-step*.2,Math.min(p.y+step*.2,[...neighbors[i]].reduce((sum,j)=>sum+vertices[j].y,0)/neighbors[i].size)):p.y);
  vertices.forEach((p,i)=>p.y=next[i]);
 }
 const edges=new Map();for(const f of faces)for(let i=0;i<3;i++){const a=f[i],b=f[(i+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}
 const boundary=new Set([...edges.values()].flat());
 return {vertices,faces,edges:[...edges.values()],boundary};
}
