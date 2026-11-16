// Bucket only the candidate shoreline texels. Changing rainwater level never
// rescans the whole snow field; each candidate uses its actual flood threshold.
export class SnowWaterExclusion {
 constructor(){this.buckets=[];this.thresholds=new Float64Array();this.previous=null;}
 configure(indices,width,height,bounds,thresholdAt,change){
  this.buckets=[];this.thresholds=new Float64Array(indices.length);this.previous=null;
  const heightScale=bounds[3]/height;
  for(let n=0;n<indices.length;n++){
   const i=indices[n],x=bounds[0]+(i%width+.5)*bounds[2]/width,y=bounds[1]+(Math.floor(i/width)+.5)*heightScale;
   const threshold=thresholdAt(x,y);this.thresholds[n]=threshold;
   if(threshold===-Infinity){change(i,false);continue;}
   if(!Number.isFinite(threshold)||threshold>.1524)continue;
   const bucket=Math.max(0,Math.floor(threshold*4096));(this.buckets[bucket]??=[]).push([i,n]);
  }
 }
 update(level,change){
  const next=Math.max(0,Math.min(.1524,Number(level)||0));if(next===this.previous)return;
  const lo=this.previous===null?0:Math.max(0,Math.floor(Math.min(next,this.previous)*4096));
  const hi=Math.min(this.buckets.length-1,Math.floor(Math.max(next,this.previous??next)*4096));
  for(let b=lo;b<=hi;b++)for(const [i,n] of this.buckets[b]||[])change(i,next<=this.thresholds[n]);
  this.previous=next;
 }
}
