// Decorative, world-anchored geometry. Never changes movement, targeting or LOS.
const cache=new Map();
function randomFor(x,y){
 let seed=Math.imul(x,374761393)^Math.imul(y,668265263)^72419;
 return()=>{seed=Math.imul(seed^seed>>>16,2246822507);seed=Math.imul(seed^seed>>>13,3266489909);seed^=seed>>>16;return(seed>>>0)/4294967296;};
}
function weightsAt(points,x,y){
 for(let i=1;i<points.length-1;i++){
  const a=points[0],b=points[i],c=points[i+1],d=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  if(Math.abs(d)<1e-8)continue;
  const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/d,v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/d,w=1-u-v;
  if(u>=0&&v>=0&&w>=0)return {indices:[0,i,i+1],weights:[u,v,w]};
 }
 return null;
}
function placements(face){
 const p=face.points,unit=face.grassUnit||128/3,squash=face.grassSquash||.568329;
 const key=unit+':'+squash+':'+p.map(p=>p.x+','+p.y).join(';');
 if(cache.has(key))return cache.get(key);
 const items=[],step=unit*.95,stepY=step*squash;
 const minX=Math.floor(Math.min(...p.map(p=>p.x))/step),maxX=Math.floor(Math.max(...p.map(p=>p.x))/step);
 const minY=Math.floor(Math.min(...p.map(p=>p.y))/stepY),maxY=Math.floor(Math.max(...p.map(p=>p.y))/stepY);
 for(let gx=minX;gx<=maxX;gx++)for(let gy=minY;gy<=maxY;gy++){
  const random=randomFor(gx,gy),x=(gx+.15+random()*.7)*step,y=(gy+.15+random()*.7)*stepY;
  const patch=.5+.5*Math.sin(x/unit*.7+Math.cos(y/(unit*squash)*.6));
  if(random()>.45+.5*patch)continue;
  const sample=weightsAt(p,x,y);if(!sample)continue;
  const stone=random()<.10,shade=.8+random()*.35,polygons=[];
  const point=(dx,dy,h=0)=>({x:x+dx,y:y+dy*squash,elevation:h});
  if(stone){
   const radius=unit*(.055+random()*.045),height=radius*.65,ring=[];
   for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ring.push(point(Math.cos(a)*radius,Math.sin(a)*radius));}
   for(let i=0;i<5;i++)polygons.push({points:[ring[i],ring[(i+1)%5],point(-radius*.2,0,height)],tint:[.48,.46,.40].map(v=>v*shade*(.78+i*.08))});
  }else{
   for(let blade=0;blade<4;blade++){
    const angle=random()*Math.PI*2,h=unit*(.18+random()*.16),w=unit*.026;
    const dx=Math.cos(angle),dy=Math.sin(angle),ox=dx*unit*.035,oy=dy*unit*.035,bend=unit*(.04+random()*.06);
    polygons.push({points:[point(ox-dx*w,oy-dy*w),point(ox+dx*w,oy+dy*w),point(ox+dx*(w*.5+bend*.35),oy+dy*(w*.5+bend*.35),h*.55),point(ox+dx*bend,oy+dy*bend,h),point(ox+dx*(-w*.5+bend*.35),oy+dy*(-w*.5+bend*.35),h*.55)],tint:[.32,.43,.16].map(v=>v*shade*(.85+blade*.1))});
   }
  }
  items.push({...sample,stone,x,y,polygons});
 }
 if(cache.size>=12000)cache.clear();cache.set(key,items);return items;
}
export function grassScatter(faces){
 const result=[];
 for(const face of faces){
  if(!face.grass||!(face.snowEligible>0)||face.points.length<3)continue;
  for(const item of placements(face)){
   const blend=(values,n)=>Array.from({length:n},(_,k)=>item.indices.reduce((sum,index,j)=>sum+(values?.[index]?.[k]||0)*item.weights[j],0));
   const uv=blend(face.uv,2),light=blend(face.lightPoints,3);
   for(const polygon of item.polygons){
    const n=polygon.points.length;
    result.push({...face,grass:false,snowEligible:item.stone?-2:-1,points:polygon.points,uv:Array(n).fill(uv),lightPoints:Array(n).fill(light),lightWorld:Array(n).fill([item.x,item.y]),tint:polygon.tint});
   }
  }
 }
 return result;
}
