import {GROUND_NEIGHBORS} from './exploration-ground.mjs?v=R238C270';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
// Periodic noise and distances to neighboring grass rectangles agree at shared
// edges, including diagonal-only corners. No transition crosses stone or void.
export function grassCoverage(mask,u,v){
 let distance=Infinity;
 GROUND_NEIGHBORS.forEach(([x,z],i)=>{
  if(!(mask&(1<<i)))return;
  distance=Math.min(distance,Math.hypot(Math.max(x-u,0,u-x-1),Math.max(z-v,0,v-z-1)));
 });
 const tau=Math.PI*2;
 const noise=Math.sin(tau*(u*5+Math.sin(tau*v)*.23))*Math.sin(tau*(v*7+Math.cos(tau*u)*.19));
 const reach=.22+.045*noise;
 return 1-smooth((distance-reach+.035)/.07);
}
export function createGroundTileBank({grass,dirt,fringe},size=256,makeCanvas=()=>document.createElement('canvas')){
 const pixels=image=>{const c=makeCanvas();c.width=c.height=size;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,size,size);return ctx.getImageData(0,0,size,size).data;};
 const g=pixels(grass),d=pixels(dirt),f=pixels(fringe),cache=new Map();
 return {size,cache,get(mask){
  mask&=255;
  if(cache.has(mask))return cache.get(mask);
  const canvas=makeCanvas();canvas.width=canvas.height=size;const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size),out=image.data;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=(y*size+x)*4,a=grassCoverage(mask,(x+.5)/size,(y+.5)/size);
   // A separate transparent tuft layer enriches only the transition band.
   const fringeAlpha=f[i+3]/255*Math.min(1,4*a*(1-a))*.85;
   for(let c=0;c<3;c++)out[i+c]=(d[i+c]*(1-a)+g[i+c]*a)*(1-fringeAlpha)+f[i+c]*fringeAlpha;
   out[i+3]=255;
  }
  ctx.putImageData(image,0,0);cache.set(mask,canvas);return canvas;
 }};
}
