// A spatial index of cached final-pose ground triangles. Built only when a
// corpse footprint changes; grass roots query one bucket during layout rebuild.
export function createCorpseCoverIndex(bodies){
 const buckets=new Map(),size=16;
 for(const {entity,positions:p} of bodies)for(let i=0;i<p.length;i+=9){
  const ax=p[i],ay=p[i+1],bx=p[i+3],by=p[i+4],cx=p[i+6],cy=p[i+7];
  if(![ax,ay,bx,by,cx,cy].every(Number.isFinite))continue;
  if(Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))<1e-8)continue;
  const tri={entity,ax,ay,bx,by,cx,cy};
  for(let x=Math.floor(Math.min(ax,bx,cx)/size);x<=Math.floor(Math.max(ax,bx,cx)/size);x++)for(let y=Math.floor(Math.min(ay,by,cy)/size);y<=Math.floor(Math.max(ay,by,cy)/size);y++){
   const key=x+','+y;let bucket=buckets.get(key);if(!bucket)buckets.set(key,bucket=[]);bucket.push(tri);
  }
 }
 return {sortY(x,y,original,order){let result=original;
  for(const t of buckets.get(Math.floor(x/size)+','+Math.floor(y/size))||[]){
   const depth=order.get(t.entity);if(depth===undefined||t.entity.alive||depth>result)continue;
   const a=(t.bx-t.ax)*(y-t.ay)-(t.by-t.ay)*(x-t.ax),b=(t.cx-t.bx)*(y-t.by)-(t.cy-t.by)*(x-t.bx),c=(t.ax-t.cx)*(y-t.cy)-(t.ay-t.cy)*(x-t.cx);
   if((a>=-1e-7&&b>=-1e-7&&c>=-1e-7)||(a<=1e-7&&b<=1e-7&&c<=1e-7))result=Math.min(result,depth-.001);
  }return result;
 }};
}
