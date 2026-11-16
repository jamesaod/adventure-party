// Cached distance inside the visible shoreline, including connected depressions.
export function createStreamShoreDistance(){
 let revision=null,size=0,bounds=[],distances=null,enabled=false;
 function configure(stream){
  if(revision===stream.revision)return false;revision=stream.revision;enabled=stream.settings.enabled;
  if(!enabled){distances=null;return true;}
  size=stream.size;bounds=Array.from(stream.bounds);const dx=bounds[2]/size,dy=bounds[3]/size;
  const field=new Float64Array(size*size);for(let i=0;i<field.length;i++)field[i]=stream.data[i*4+1]>.0065?1e20:0;
  const f=new Float64Array(size),out=new Float64Array(size),sites=new Int32Array(size),cuts=new Float64Array(size+1);
  // Exact squared Euclidean distance transform, separable in anisotropic metres.
  function transform(step){let k=0;sites[0]=0;cuts[0]=-Infinity;cuts[1]=Infinity;const w=step*step;
   for(let q=1;q<size;q++){let s;do{const p=sites[k];s=((f[q]+w*q*q)-(f[p]+w*p*p))/(2*w*(q-p));if(s<=cuts[k])k--;else break;}while(k>=0);k++;sites[k]=q;cuts[k]=s;cuts[k+1]=Infinity;}
   k=0;for(let q=0;q<size;q++){while(cuts[k+1]<q)k++;out[q]=w*(q-sites[k])**2+f[sites[k]];}
  }
  for(let y=0;y<size;y++){f.set(field.subarray(y*size,(y+1)*size));transform(dx);field.set(out,y*size);}
  distances=new Float32Array(size*size);
  for(let x=0;x<size;x++){for(let y=0;y<size;y++)f[y]=field[y*size+x];transform(dy);for(let y=0;y<size;y++)distances[y*size+x]=Math.max(0,Math.sqrt(out[y])-.5*Math.min(dx,dy));}
  return true;
 }
 function distance(x,y){
  if(!enabled||!distances||x<bounds[0]||y<bounds[1]||x>bounds[0]+bounds[2]||y>bounds[1]+bounds[3])return Infinity;
  const fx=(x-bounds[0])/bounds[2]*size-.5,fy=(y-bounds[1])/bounds[3]*size-.5,ix=Math.floor(fx),iy=Math.floor(fy),u=fx-ix,v=fy-iy;
  const at=(a,b)=>distances[Math.max(0,Math.min(size-1,b))*size+Math.max(0,Math.min(size-1,a))];
  return (at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v;
 }
 return {configure,distance,get data(){return distances;}};
}
