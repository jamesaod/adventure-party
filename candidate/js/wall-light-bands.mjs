// Map continuous wall-light fragments onto one opaque strip. Integer runs
// cover each texel exactly once, avoiding antialiased polygon joins.
export function wallLightBandRuns(face,fragments,width){
 const a=face.points[0],b=face.points[1],dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
 if(!length)return [];
 const at=p=>((p.x-a.x)*dx+(p.y-a.y)*dy)/length;
 const spans=fragments.map((f,index)=>({index,lo:Math.max(0,Math.min(at(f.points[0]),at(f.points[1]))),hi:Math.min(1,Math.max(at(f.points[0]),at(f.points[1])))})).sort((a,b)=>a.lo-b.lo);
 const runs=[];let start=0;
 for(const span of spans){const end=Math.max(start,Math.min(width,Math.round(span.hi*width)));if(end>start){runs.push({start,end,index:span.index});start=end;}}
 if(start<width&&runs.length)runs.at(-1).end=width;
 return runs;
}
