// Static channel authored in metres relative to the combat map origin.
// R = bed depression, G = permanent water depth, B = downstream metres,
// A = signed cross-channel distance. Rain accumulation never enters this field.
export const STREAM_DEFAULTS=Object.freeze({enabled:true,width:3.2,depth:.65,level:-.16,speed:.25,ripple:.3});
export const COMBAT_STREAM_PATH=Object.freeze([[-1,-40],[2,-26],[7,-14],[4,-3],[7,9],[3,22],[5,40]].map(([x,y])=>Object.freeze({x,y})));
const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
export function streamBankWear(depth,water=0){return Math.max(smooth(depth/.14),smooth(water/.02));}
export function streamSettings(input={}){
 const s={...STREAM_DEFAULTS,...input};
 for(const [k,lo,hi] of [['width',1,8],['depth',.25,1.2],['level',-.6,-.02],['speed',0,2],['ripple',0,1]])if(!Number.isFinite(s[k])||s[k]<lo||s[k]>hi)throw Error('Invalid stream '+k);
 if(typeof s.enabled!=='boolean')throw Error('Invalid stream enabled');return s;
}
export function traceStream(points,spacing=.5){
 if(!Array.isArray(points)||points.length<2||points.length>64||!Number.isFinite(spacing)||spacing<.1)throw Error('Invalid stream path');
 for(const p of points)if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>64||Math.abs(p.y)>64)throw Error('Invalid stream point');
 const result=[];let distance=0;
 for(let i=0;i<points.length-1;i++){
  const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)],n=Math.max(2,Math.ceil(Math.hypot(p2.x-p1.x,p2.y-p1.y)/spacing));
  for(let j=0;j<n;j++){const t=j/n,t2=t*t,t3=t2*t,at=k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3),p={x:at('x'),y:at('y')},old=result.at(-1);if(old)distance+=Math.hypot(p.x-old.x,p.y-old.y);result.push({...p,distance});}
 }
 const last=points.at(-1),old=result.at(-1);result.push({...last,distance:distance+Math.hypot(last.x-old.x,last.y-old.y)});return result;
}
// Stable, metre-scale variation is baked once. The banks are deliberately
// asymmetric; the inside of a bend grows a shallow gravel shelf.
export function streamBankProfile(along,signedDistance,width,turn=0){
 const side=signedDistance<0?-1:1;
 const widthFactor=1+.13*Math.sin(along*.31+side*1.7)+.075*Math.sin(along*.83+side*.9)+.035*Math.sin(along*2.1+side*2.4);
 const radius=width*.5*widthFactor,r=Math.abs(signedDistance)/radius;
 const inner=Math.max(0,Math.min(1,turn*side*12)),outer=Math.max(0,Math.min(1,-turn*side*12));
 const base=1-smooth((r-.15)/.85);
 const shelf=inner*.55*smooth((r-.15)/.25)*(1-smooth((r-.78)/.22));
 return {radius,depthFactor:Math.max(0,Math.pow(base,1+inner*.7-outer*.2)-shelf)};
}
export function createStreamField({size=512,span=128,fit=false,groundDepth=null}={}){
 const bounds=[-span/2,-span/2,span,span];
 const data=new Float32Array(size*size*4);let settings={...STREAM_DEFAULTS,enabled:false},revision=0,path=[];
 function configure(points,options={}){
  const next=streamSettings(options),trace=next.enabled?traceStream(points):[];
  // Validate before replacing any usable field.
  settings=next;path=points;data.fill(0);revision++;
  if(!next.enabled)return;
  if(fit){const pad=next.width*.65+3,x=trace.map(p=>p.x),y=trace.map(p=>p.y);bounds[0]=Math.min(...x)-pad;bounds[1]=Math.min(...y)-pad;bounds[2]=Math.max(...x)+pad-bounds[0];bounds[3]=Math.max(...y)+pad-bounds[1];}
  const banks=new Float32Array(size*size),closest=new Float32Array(size*size);closest.fill(Infinity);
  for(let i=0;i<trace.length-1;i++){
   const a=trace[i],b=trace[i+1],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<1e-6)continue;
   const prev=trace[Math.max(0,i-1)],pdx=a.x-prev.x,pdy=a.y-prev.y,plen=Math.hypot(pdx,pdy),turn=plen>1e-6?(pdx*dy-pdy*dx)/(plen*len):0;
   const radius=next.width*.65+1.5,ix=(x,axis=0)=>Math.max(0,Math.min(size-1,Math.floor((x-bounds[axis])/bounds[axis+2]*size))),x0=ix(Math.min(a.x,b.x)-radius),x1=ix(Math.max(a.x,b.x)+radius),y0=ix(Math.min(a.y,b.y)-radius,1),y1=ix(Math.max(a.y,b.y)+radius,1);
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const px=bounds[0]+(x+.5)/size*bounds[2],py=bounds[1]+(y+.5)/size*bounds[3],t=Math.max(0,Math.min(1,((px-a.x)*dx+(py-a.y)*dy)/(len*len))),qx=px-a.x-t*dx,qy=py-a.y-t*dy,d=Math.hypot(qx,qy),k=y*size+x;if(d>=radius||d>=closest[k])continue;closest[k]=d;
    const along=a.distance+t*len,lateral=(dx*qy-dy*qx)/len,profile=streamBankProfile(along,(lateral<0?-1:1)*d,next.width,turn),level=next.level-along*.0015,depth=(next.depth+along*.0015)*profile.depthFactor,o=k*4;
    const side=lateral<0?-1:1,bankWidth=.75+.30*Math.sin(along*.19+side*1.9)+.15*Math.sin(along*.43-side*.8);
    banks[k]=Math.min(.075,-level*.45)*(1-smooth((d-profile.radius*.65)/(profile.radius*.35+bankWidth)));
    data[o]=depth;data[o+1]=Math.max(0,depth+level);data[o+2]=along;data[o+3]=(dx*qy-dy*qx)/len;
   }
  }
  if(groundDepth){const base=data.slice();connectStreamBasins(data,size,bounds,next,groundDepth);smoothStreamInlets(data,base,size,bounds,next);}
  // A landward apron of varying width, always above the local water surface.
  for(let k=0;k<banks.length;k++){const o=k*4;data[o]=Math.max(data[o],banks[k]);data[o+1]=Math.max(0,data[o]+next.level-data[o+2]*.0015);}
 }
 function sample(x,y){if(!settings.enabled||x<=bounds[0]||y<=bounds[1]||x>=bounds[0]+bounds[2]||y>=bounds[1]+bounds[3])return {depth:0,water:0,height:0,along:0};const fx=(x-bounds[0])/bounds[2]*size-.5,fy=(y-bounds[1])/bounds[3]*size-.5,ix=Math.floor(fx),iy=Math.floor(fy),u=fx-ix,v=fy-iy,at=(a,b,c)=>data[(Math.max(0,Math.min(size-1,b))*size+Math.max(0,Math.min(size-1,a)))*4+c],value=c=>(at(ix,iy,c)*(1-u)+at(ix+1,iy,c)*u)*(1-v)+(at(ix,iy+1,c)*(1-u)+at(ix+1,iy+1,c)*u)*v,depth=value(0),water=value(1);return {depth,water,height:water-depth,along:value(2)};}
 return {data,size,span,bounds,configure,sample,get settings(){return {...settings};},get revision(){return revision;},get path(){return path;}};
}


// Cached connectivity bake. Only low terrain reachable from existing water can
// become an inlet; high banks and remote depressions remain independent.
export function connectStreamBasins(data,size,bounds,settings,groundDepth){
 const count=size*size,queue=new Int32Array(count),parent=new Int32Array(count),distance=new Float32Array(count),natural=new Float32Array(count);
 parent.fill(-2);distance.fill(Infinity);let head=0,tail=0;
 const sx=bounds[2]/size,sy=bounds[3]/size,maxReach=2.2;
 for(let k=0;k<count;k++){const x=k%size,y=Math.floor(k/size);natural[k]=Math.max(0,groundDepth(bounds[0]+(x+.5)*sx,bounds[1]+(y+.5)*sy));if(data[k*4+1]>.015){parent[k]=-1;distance[k]=0;queue[tail++]=k;}}
 while(head<tail){const k=queue[head++],x=k%size,y=Math.floor(k/size);
  for(const [n,step,valid] of [[k-1,sx,x>0],[k+1,sx,x<size-1],[k-size,sy,y>0],[k+size,sy,y<size-1]]){
   if(!valid||parent[n]!==-2)continue;const d=distance[k]+step;if(d>maxReach)continue;
   if(data[n*4]<.001&&natural[n]<.012)continue;
   parent[n]=k;distance[n]=d;queue[tail++]=n;
   if(data[n*4]<.001){data[n*4+2]=data[k*4+2];data[n*4+3]=data[k*4+3];}
  }
 }
 // Reverse traversal deepens the outlet whenever an inlet needs it, avoiding
 // disconnected water behind a tiny raster ridge. No work is done per frame.
 for(let j=tail-1;j>=0;j--){const k=queue[j],o=k*4;if(parent[k]<0)continue;
  const level=settings.level-data[o+2]*.0015;
  const strength=smooth((natural[k]-.012)/.07)*smooth((maxReach-distance[k])/.8);
  const target=natural[k]+Math.max(0,-level+.045-natural[k])*strength;
  data[o]=Math.max(data[o],target);data[o+1]=Math.max(0,data[o]+level);
  if(data[o+1]>.002){const p=parent[k]*4,pl=settings.level-data[p+2]*.0015;data[p]=Math.max(data[p],-pl+Math.min(.045,data[o+1]));data[p+1]=Math.max(0,data[p]+pl);}
 }
}

// Three separable box passes approximate a Gaussian in metres, independent of
// rectangular texture resolution. Smooth only the added inlet excavation so
// the authored main channel and its water width remain unchanged.
export function smoothStreamInlets(data,base,size,bounds,settings){
 let field=new Float32Array(size*size),scratch=new Float32Array(field.length);
 for(let k=0;k<field.length;k++)field[k]=Math.max(0,data[k*4]-base[k*4]);
 const rx=Math.max(1,Math.round(.16*size/bounds[2])),ry=Math.max(1,Math.round(.16*size/bounds[3]));
 function pass(radius,vertical){const stride=vertical?size:1;
  for(let line=0;line<size;line++){const start=vertical?line:line*size;let sum=0;
   for(let t=-radius;t<=radius;t++)sum+=field[start+Math.max(0,Math.min(size-1,t))*stride];
   for(let t=0;t<size;t++){scratch[start+t*stride]=sum/(radius*2+1);sum+=field[start+Math.min(size-1,t+radius+1)*stride]-field[start+Math.max(0,t-radius)*stride];}
  }[field,scratch]=[scratch,field];
 }
 for(let i=0;i<3;i++){pass(rx,false);pass(ry,true);}
 for(let k=0;k<field.length;k++){const o=k*4;data[o]=base[o]+field[k];data[o+1]=Math.max(0,data[o]+settings.level-data[o+2]*.0015);}
}
