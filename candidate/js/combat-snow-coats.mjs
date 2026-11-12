// Coverage is measured from retained grain texels on eligible outdoor ground.
// R: thin coat. G: powder, only after R covers 100%. B: displacement,
// only after G also covers 100%. Completion means the full material blend
// at every eligible texel, not merely a nonzero trace. Fine snowfall fills gaps.
export const SNOW_GAP_FILL=.90;
// Share the material ramp with the renderer. A trace is visible but incomplete.
export const SNOW_COAT_BLEND_START=.015,SNOW_COAT_BLEND_END=.34;
export const SNOW_COAT_VISIBLE=Math.ceil(SNOW_COAT_BLEND_START*255);
export const SNOW_COAT_COMPLETE=Math.ceil(SNOW_COAT_BLEND_END*255);
// Match the ground shader blend, not elapsed snowfall or barely-visible texels.
const blendProgress=Float64Array.from({length:256},(_,i)=>{const t=Math.max(0,Math.min(1,(i/255-SNOW_COAT_BLEND_START)/(SNOW_COAT_BLEND_END-SNOW_COAT_BLEND_START)));return t*t*(3-2*t);});
const thresholds=[SNOW_COAT_COMPLETE,SNOW_COAT_COMPLETE,SNOW_COAT_VISIBLE];
export const SNOW_BRUSH_SIZE=7;
export const SNOW_BRUSHES=Array.from({length:16},(_,id)=>{
 const diameter=id<8?5:7,angle=(id%8)*Math.PI/8,c=Math.cos(angle),s=Math.sin(angle),pixels=[];
 for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++){
  const u=(c*x-s*y)/diameter,v=(s*x+c*y)/diameter;
  const t=Math.max(0,Math.min(1,(Math.hypot(u,v*1.35)-.30)/.20));
  const dose=Math.round(255*.18*(1-t*t*(3-2*t)));
  if(dose)pixels.push({x,y,dose});
 }
 return pixels;
});
export function snowBrushAtlas(){
 const data=new Uint8Array(SNOW_BRUSHES.length*7*7*4);
 SNOW_BRUSHES.forEach((brush,id)=>{for(const p of brush){const i=((p.y+3)*SNOW_BRUSHES.length*7+id*7+p.x+3)*4;data[i]=p.dose;data[i+3]=255;}});
 return data;
}
const popcount=n=>{n-=n>>>1&0x55555555;n=(n&0x33333333)+(n>>>2&0x33333333);return ((n+(n>>>4)&0x0f0f0f0f)*0x01010101)>>>24;};

export function createSnowCoatCoverage(){
 let width=0,height=0,bounds=[0,0,1,1],first=new Uint8Array(),second=new Uint8Array(),depth=new Uint8Array(),eligible=new Uint8Array(),missing=[new Uint32Array(),new Uint32Array()],rows=[new Int32Array(),new Int32Array()],stride=0;
 let manualHeights=null,extra=new Uint8Array();
 let total=0,counts=[0,0,0],progress=[0,0,0],regions=new Map();
 const valueProgress=(layer,value)=>layer===2?value/255:blendProgress[value];
 function addRow(layer,y,delta){for(let i=y+1;i<=height;i+=i&-i)rows[layer][i]+=delta;}
 function changeCoverage(layer,i,before,after){
  if(before===after)return;
  counts[layer]+=after?1:-1;if(layer===2)return;
  const y=Math.floor(i/width),x=i-y*width,k=y*stride+(x>>>5),bit=1<<(x&31);
  if(after)missing[layer][k]&=~bit;else missing[layer][k]|=bit;
  addRow(layer,y,after?-1:1);
 }
 function recount(){
  total=0;counts=[0,0,0];progress=[0,0,0];for(const m of missing)m.fill(0);for(const row of rows)row.fill(0);
  const fields=[first,second,depth];
  for(let y=0;y<height;y++){
   const holes=[0,0];
   for(let x=0;x<width;x++){const i=y*width+x;if(!eligible[i])continue;total++;for(let layer=0;layer<3;layer++)progress[layer]+=valueProgress(layer,fields[layer][i]);
    for(let layer=0;layer<3;layer++)if(fields[layer][i]>=thresholds[layer])counts[layer]++;else if(layer<2){missing[layer][y*stride+(x>>>5)]|=1<<(x&31);holes[layer]++;}
   }
   for(let layer=0;layer<2;layer++)addRow(layer,y,holes[layer]);
  }
 }
 // Merge triangle scan lines once per terrain change. Melting reuses these spans.
 function spansFor(triangles){
  const lines=new Map();
  for(const triangle of triangles){
   const points=[triangle.a,triangle.b,triangle.c].map(p=>({x:(p.x-bounds[0])*width/bounds[2],y:(p.y-bounds[1])*height/bounds[3]}));
   const lo=Math.max(0,Math.ceil(Math.min(...points.map(p=>p.y))-.5)),hi=Math.min(height-1,Math.floor(Math.max(...points.map(p=>p.y))-.5));
   for(let y=lo;y<=hi;y++){
    const scan=y+.5,crossings=[];
    for(let j=0;j<3;j++){const a=points[j],b=points[(j+1)%3];if((a.y<=scan&&b.y>scan)||(b.y<=scan&&a.y>scan))crossings.push(a.x+(scan-a.y)*(b.x-a.x)/(b.y-a.y));}
    if(crossings.length<2)continue;
    const start=Math.max(0,Math.ceil(Math.min(...crossings)-.5)),end=Math.min(width,Math.floor(Math.max(...crossings)-.5)+1);
    if(start>=end)continue;let line=lines.get(y);if(!line)lines.set(y,line=[]);line.push([start,end]);
   }
  }
  const spans=[];
  for(const [y,line] of lines){line.sort((a,b)=>a[0]-b[0]);let [start,end]=line[0];for(let j=1;j<line.length;j++){if(line[j][0]<=end)end=Math.max(end,line[j][1]);else{spans.push([y*width+start,y*width+end]);[start,end]=line[j];}}spans.push([y*width+start,y*width+end]);}
  return spans;
 }
 function pickMissing(layer,random){
  let rank=Math.min(total-counts[layer]-1,Math.floor(random()*(total-counts[layer]))),y=0;
  for(let bit=2**Math.floor(Math.log2(height));bit;bit>>=1){const next=y+bit;if(next<=height&&rows[layer][next]<=rank){rank-=rows[layer][next];y=next;}}
  for(let word=0;word<stride;word++){
   let bits=missing[layer][y*stride+word]>>>0,n=popcount(bits);if(rank>=n){rank-=n;continue;}
   while(rank-->0)bits=(bits&(bits-1))>>>0;
   return {x:word*32+31-Math.clz32(bits&-bits),y};
  }
  throw Error('Snow coverage index is inconsistent');
 }
 return {
  configure(extent,w,h,cells){manualHeights=null;
   if(width!==w||height!==h||bounds.some((v,i)=>v!==extent[i])){width=w;height=h;bounds=Array.from(extent);first=new Uint8Array(w*h);second=new Uint8Array(w*h);depth=new Uint8Array(w*h);extra=new Uint8Array(w*h);eligible=new Uint8Array(w*h);stride=Math.ceil(w/32);missing=[new Uint32Array(stride*h),new Uint32Array(stride*h)];rows=[new Int32Array(h+1),new Int32Array(h+1)];}
   eligible.fill(0);regions=new Map();for(const [key,cell] of cells){const spans=spansFor(cell.triangles);regions.set(key,spans);for(const [a,b] of spans)eligible.fill(1,a,b);}recount();
  },
  fill(){manualHeights=null;extra.fill(0);for(let i=0;i<eligible.length;i++)first[i]=second[i]=depth[i]=eligible[i]?255:0;recount();},
  clear(){manualHeights=null;extra.fill(0);first.fill(0);second.fill(0);depth.fill(0);recount();},
  adjustDepth(layers){
   const data=new Uint8Array(width*height*4);if(!manualHeights)manualHeights=Float32Array.from(first,(v,i)=>blendProgress[v]+blendProgress[second[i]]+depth[i]/255+extra[i]/255*3);
   const encode=v=>{if(v<=0)return 0;if(v>=1-1e-7)return 255;let best=0,error=Infinity;for(let n=4;n<=87;n++){const e=Math.abs(blendProgress[n]-v);if(e<error){best=n;error=e;}}return best;};
   // Lookup once per click, not a transcendental solve for every texel.
   const ramp=Uint8Array.from({length:1025},(_,i)=>encode(i/1024));
   for(let i=0;i<eligible.length;i++){if(!eligible[i])continue;let h=Math.max(0,Math.min(6,manualHeights[i]+layers));if(Math.abs(h-Math.round(h))<.00001)h=Math.round(h);manualHeights[i]=h;
    first[i]=ramp[Math.round(Math.min(1,h)*1024)];second[i]=ramp[Math.round(Math.max(0,Math.min(1,h-1))*1024)];depth[i]=Math.round(Math.max(0,Math.min(1,h-2))*255);extra[i]=Math.round(Math.max(0,h-3)/3*255);
    data[i*4]=first[i];data[i*4+1]=second[i];data[i*4+2]=depth[i];data[i*4+3]=extra[i];
   }recount();return {data,width,height};
  },
  get coverage(){return {first:total?counts[0]/total:0,second:total?counts[1]/total:0,depth:total?counts[2]/total:0,texels:total};},
  get progress(){return total?progress.reduce((sum,v,i)=>sum+(i<2&&counts[i]===total?1:Math.max(0,Math.min(1,v/total))),0):0;},
  get hasDepth(){return counts[2]>0;},
  sampleDepthWorld(x,y){const p=this.sampleWorld(x,y),px=Math.floor((x-bounds[0])*width/bounds[2]),py=Math.floor((y-bounds[1])*height/bounds[3]);return [...p,px>=0&&py>=0&&px<width&&py<height?extra[py*width+px]/255:0];},
  sampleWorld(x,y){const px=Math.floor((x-bounds[0])*width/bounds[2]),py=Math.floor((y-bounds[1])*height/bounds[3]);if(px<0||py<0||px>=width||py>=height)return [0,0,0];const i=py*width+px;return eligible[i]?[first[i]/255,second[i]/255,depth[i]/255]:[0,0,0];},
  // Read-only CPU sample for regression checks against the rendered field.
  sample(x,y){const i=y*width+x;return {first:first[i],second:second[i],depth:depth[i],eligible:!!eligible[i]};},
  deposit(point,random=Math.random){manualHeights=null;
   if(!total)return null;
   const brushId=Math.min(15,Math.floor(random()*16)),brush=SNOW_BRUSHES[brushId];
   let x=Math.max(0,Math.min(width-1,Math.floor((point.x-bounds[0])*width/bounds[2]))),y=Math.max(0,Math.min(height-1,Math.floor((point.y-bounds[1])*height/bounds[3]))),layer=0;
   layer=counts[0]<total?0:counts[1]<total?1:2;
   // Retain the exact landing texel for visible flakes; the additional fine
   // snowfall fills the last holes, so neither 100% gate can stall forever.
   if(layer<2&&!point.landed&&counts[layer]>=Math.ceil(total*SNOW_GAP_FILL))({x,y}=pickMissing(layer,random));
   const field=layer===0?first:layer===1?second:depth;
   for(const p of brush){const px=x+p.x,py=y+p.y;if(px<0||py<0||px>=width||py>=height)continue;const i=py*width+px,previous=field[i],before=previous>=thresholds[layer];field[i]=Math.min(255,previous+p.dose);if(eligible[i]){progress[layer]+=valueProgress(layer,field[i])-valueProgress(layer,previous);changeCoverage(layer,i,before,field[i]>=thresholds[layer]);}}
   return {x:bounds[0]+(x+.5)*bounds[2]/width,y:bounds[1]+(y+.5)*bounds[3]/height,size:7,brush:brushId,layer};
  },
  melt(keys,amount){manualHeights=null;
   const remaining=1-Math.max(0,Math.min(1,amount)),fields=[first,second,depth];
   for(const key of new Set(keys))for(const [a,b] of regions.get(key)||[])for(let i=a;i<b;i++){
    extra[i]=Math.round(extra[i]*remaining);for(let layer=0;layer<3;layer++){const field=fields[layer],previous=field[i],before=previous>=thresholds[layer];field[i]=Math.round(previous*remaining);if(eligible[i])progress[layer]+=valueProgress(layer,field[i])-valueProgress(layer,previous);changeCoverage(layer,i,before,field[i]>=thresholds[layer]);}
   }
  }
 };
}

// Learn deposition speed from actual coverage. Once the ground is fully capped,
// continuing particles can still coat a newly fallen body at the measured rate.
export function createSnowDepositionClock(){
 let measured=0,grains=0;
 return {prime(texels){if(!grains&&texels>0){const mass=SNOW_BRUSHES.reduce((sum,brush)=>sum+brush.reduce((v,p)=>v+p.dose/255,0),0)/SNOW_BRUSHES.length;measured=3;grains=3*texels/mass;}},clear(){measured=0;grains=0;},advance(before,after,count){
  if(!count)return 0;
  if(before>=3-1e-9)return grains?count*measured/grains:0;
  const delta=Math.max(0,after-before);measured+=delta;grains+=count;return delta;
 }};
}
