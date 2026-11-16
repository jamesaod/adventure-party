import {SnowWaterExclusion} from './combat-snow-water.mjs?v=water1';
import {SNOW_MAX_METRES,SNOW_LAYER_METRES} from './combat-snow-depth.mjs?v=shore-snow1';
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
// Inverse material ramp is shared by all manual depth adjustments.
const depthRamp=Uint8Array.from({length:1025},(_,i)=>{const v=i/1024;if(v<=0)return 0;if(v>=1-1e-7)return 255;let best=0,error=Infinity;for(let n=4;n<=87;n++){const e=Math.abs(blendProgress[n]-v);if(e<error){best=n;error=e;}}return best;});
const thresholds=[SNOW_COAT_COMPLETE,SNOW_COAT_COMPLETE,SNOW_COAT_VISIBLE];
import {SNOW_BRUSH_SIZE,SNOW_BRUSHES} from './snow-grain-brushes.mjs';
export {SNOW_BRUSH_SIZE,SNOW_BRUSHES,SNOW_GRAIN_RATE_SCALE} from './snow-grain-brushes.mjs';
export function snowBrushAtlas(){
 const data=new Uint8Array(SNOW_BRUSHES.length*SNOW_BRUSH_SIZE*SNOW_BRUSH_SIZE*4);
 SNOW_BRUSHES.forEach((brush,id)=>{for(const p of brush){const i=((p.y+1)*SNOW_BRUSHES.length*SNOW_BRUSH_SIZE+id*SNOW_BRUSH_SIZE+p.x+1)*4;data[i]=p.dose;data[i+3]=255;}});
 return data;
}
const popcount=n=>{n-=n>>>1&0x55555555;n=(n&0x33333333)+(n>>>2&0x33333333);return ((n+(n>>>4)&0x0f0f0f0f)*0x01010101)>>>24;};

export function createSnowCoatCoverage(){
 let width=0,height=0,bounds=[0,0,1,1],first=new Uint8Array(),second=new Uint8Array(),depth=new Uint8Array(),eligible=new Uint8Array(),missing=[new Uint32Array(),new Uint32Array()],rows=[new Int32Array(),new Int32Array()],stride=0;
 let waterIndices=[],waterKey=null,shoreKey=null,limits=new Uint8Array(),shoreLimited=false;const waterExclusion=new SnowWaterExclusion();
 let manualHeights=null,extra=new Uint8Array(),exposure=null,exposureRevision=null;
 let total=0,counts=[0,0,0],progress=[0,0,0],regions=new Map();
 const limit=(layer,i)=>limits[i*4+layer]??255;
 const threshold=(layer,i)=>layer===2?thresholds[layer]:exposure?.[i]===0?0:Math.min(thresholds[layer],limit(layer,i));
 const valueProgress=(layer,value,i)=>{const cap=limit(layer,i);return cap===0||exposure?.[i]===0?1:layer===2?value/cap:Math.min(1,blendProgress[value]/blendProgress[cap]);};
 function encodeLimit(layers,i){limits[i*4]=depthRamp[Math.round(Math.min(1,layers)*1024)];limits[i*4+1]=depthRamp[Math.round(Math.max(0,Math.min(1,layers-1))*1024)];limits[i*4+2]=Math.round(Math.max(0,Math.min(1,layers-2))*255);limits[i*4+3]=0;}
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
  let c0=0,c1=0,c2=0,p0=0,p1=0,p2=0;
  for(let y=0;y<height;y++){
   let h0=0,h1=0;const base=y*width,wordBase=y*stride;
   for(let x=0;x<width;x++){const i=base+x;if(!eligible[i])continue;total++;
    const a=first[i],b=second[i],c=depth[i];p0+=valueProgress(0,a,i);p1+=valueProgress(1,b,i);p2+=valueProgress(2,c,i);
    if(a>=threshold(0,i))c0++;else{missing[0][wordBase+(x>>>5)]|=1<<(x&31);h0++;}
    if(b>=threshold(1,i))c1++;else{missing[1][wordBase+(x>>>5)]|=1<<(x&31);h1++;}
    if(c>=thresholds[2])c2++;
   }rows[0][y+1]=h0;rows[1][y+1]=h1;
  }
  // Build Fenwick row sums in linear time after a full field change.
  for(let i=1;i<=height;i++){const parent=i+(i&-i);if(parent<=height){rows[0][parent]+=rows[0][i];rows[1][parent]+=rows[1][i];}}
  counts=[c0,c1,c2];progress=[p0,p1,p2];
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
 function setEligible(i,allowed){
  const on=!!allowed;if(!!eligible[i]===on)return false;
  const fields=[first,second,depth],y=Math.floor(i/width),x=i%width,k=y*stride+(x>>>5),bit=1<<(x&31);
  if(!on){total--;for(let layer=0;layer<3;layer++){const v=fields[layer][i];progress[layer]-=valueProgress(layer,v,i);if(v>=threshold(layer,i))counts[layer]--;else if(layer<2){missing[layer][k]&=~bit;addRow(layer,y,-1);}fields[layer][i]=0;}extra[i]=0;if(manualHeights)manualHeights[i]=0;}
  else{total++;for(let layer=0;layer<3;layer++){progress[layer]+=valueProgress(layer,0,i);if(0>=threshold(layer,i))counts[layer]++;else if(layer<2){missing[layer][k]|=bit;addRow(layer,y,1);}}}
  eligible[i]=on?1:0;return true;
 }
 return {
  setExposureField(revision,sample){
   if(exposureRevision===revision)return false;exposureRevision=revision;exposure=new Float32Array(width*height);
   for(let i=0;i<exposure.length;i++)exposure[i]=Math.max(0,Math.min(1,sample(bounds[0]+(i%width+.5)*bounds[2]/width,bounds[1]+(Math.floor(i/width)+.5)*bounds[3]/height)));
   // Interception changes future deposits only. Never reveal hidden snow or erase retained coats.
   recount();return true;
  },
  get eligibility(){return {data:eligible,width,height};},
  get shoreLimited(){return shoreLimited;},
  get accumulationLimits(){const data=limits.slice();for(let i=0;i<eligible.length;i++)if(!eligible[i])data.fill(0,i*4,i*4+4);return {data,width,height};},
  restrictWater(source){if(!source||!width)return false;let changed=false;
   if(waterKey!==source.revision){waterKey=source.revision;for(const i of waterIndices)changed=setEligible(i,true)||changed;waterExclusion.configure(waterIndices,width,height,bounds,source.threshold,(i,on)=>{changed=setEligible(i,on)||changed;});}
   waterExclusion.update(source.level,(i,on)=>{changed=setEligible(i,on)||changed;});
   if(shoreKey!==source.revision){shoreKey=source.revision;limits.fill(255);manualHeights=null;shoreLimited=false;
    if(source.snowLimit)for(let i=0;i<eligible.length;i++){
     const x=bounds[0]+(i%width+.5)*bounds[2]/width,y=bounds[1]+(Math.floor(i/width)+.5)*bounds[3]/height;
     const fraction=source.snowLimit(x,y);if(fraction>=1)continue;if(eligible[i])shoreLimited=true;encodeLimit(Math.max(0,fraction)*SNOW_MAX_METRES/SNOW_LAYER_METRES,i);
     first[i]=Math.min(first[i],limit(0,i));second[i]=Math.min(second[i],limit(1,i));depth[i]=Math.min(depth[i],limit(2,i));extra[i]=0;
    }recount();changed=true;
   }return changed;
  },
  configure(extent,w,h,cells){manualHeights=null;exposure=null;exposureRevision=null;
   if(width!==w||height!==h||bounds.some((v,i)=>v!==extent[i])){width=w;height=h;bounds=Array.from(extent);first=new Uint8Array(w*h);second=new Uint8Array(w*h);depth=new Uint8Array(w*h);extra=new Uint8Array(w*h);eligible=new Uint8Array(w*h);stride=Math.ceil(w/32);missing=[new Uint32Array(stride*h),new Uint32Array(stride*h)];rows=[new Int32Array(h+1),new Int32Array(h+1)];}
   limits=new Uint8Array(w*h*4).fill(255);shoreKey=null;eligible.fill(0);waterKey=null;waterIndices=[];regions=new Map();for(const [key,cell] of cells){const spans=spansFor(cell.triangles);regions.set(key,spans);for(const [a,b] of spans)eligible.fill(1,a,b);for(const [a,b] of spansFor(cell.waterTriangles||[]))for(let i=a;i<b;i++)waterIndices.push(i);}waterIndices=[...new Set(waterIndices)];recount();
  },
  fill(){manualHeights=null;extra.fill(0);for(let i=0;i<eligible.length;i++){first[i]=eligible[i]?limit(0,i):0;second[i]=eligible[i]?limit(1,i):0;depth[i]=eligible[i]?limit(2,i):0;}recount();},
  clear(){manualHeights=null;extra.fill(0);first.fill(0);second.fill(0);depth.fill(0);recount();},
  adjustDepth(layers){
   const data=new Uint8Array(width*height*4),initialize=!manualHeights,ramp=depthRamp;if(initialize)manualHeights=new Float32Array(width*height);
   for(let i=0;i<eligible.length;i++){if(!eligible[i])continue;if(initialize)manualHeights[i]=blendProgress[first[i]]+blendProgress[second[i]]+depth[i]/255+extra[i]/255*3;let h=Math.max(0,Math.min(SNOW_MAX_METRES/SNOW_LAYER_METRES,Math.min(SNOW_MAX_METRES/SNOW_LAYER_METRES,manualHeights[i])+layers));if(Math.abs(h-Math.round(h))<.00001)h=Math.round(h);manualHeights[i]=h;
    first[i]=ramp[Math.round(Math.min(1,h)*1024)];second[i]=ramp[Math.round(Math.max(0,Math.min(1,h-1))*1024)];depth[i]=Math.round(Math.max(0,Math.min(1,h-2))*255);extra[i]=Math.round(Math.max(0,h-3)/3*255);
    first[i]=Math.min(first[i],limit(0,i));second[i]=Math.min(second[i],limit(1,i));depth[i]=Math.min(depth[i],limit(2,i));extra[i]=Math.min(extra[i],limit(3,i));manualHeights[i]=Math.min(h,blendProgress[limit(0,i)]+blendProgress[limit(1,i)]+limit(2,i)/255+limit(3,i)/255*3);
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
   // Thin the arriving grain population, not the opacity of stored snow.
   // Rejected grains consume their snowfall budget without moving elsewhere.
   if(exposure&&random()>=exposure[y*width+x])return {x:bounds[0]+(x+.5)*bounds[2]/width,y:bounds[1]+(y+.5)*bounds[3]/height,size:SNOW_BRUSH_SIZE,brush:brushId,layer:-1};
   const field=layer===0?first:layer===1?second:depth;
   let completed=0,delta=0,row=-1,rowHoles=0;
   for(const p of brush){const px=x+p.x,py=y+p.y;if(px<0||py<0||px>=width||py>=height)continue;const i=py*width+px;if(!eligible[i]||exposure?.[i]===0)continue;
    const previous=field[i];if(previous>=limit(layer,i))continue;const next=Math.min(limit(layer,i),previous+p.dose);field[i]=next;
    delta+=valueProgress(layer,next,i)-valueProgress(layer,previous,i);
    if(previous<threshold(layer,i)&&next>=threshold(layer,i)){completed++;if(layer<2){missing[layer][py*stride+(px>>>5)]&=~(1<<(px&31));if(row!==py){if(rowHoles)addRow(layer,row,-rowHoles);row=py;rowHoles=0;}rowHoles++;}}
   }
   if(rowHoles)addRow(layer,row,-rowHoles);counts[layer]+=completed;progress[layer]+=delta;
   return {x:bounds[0]+(x+.5)*bounds[2]/width,y:bounds[1]+(y+.5)*bounds[3]/height,size:SNOW_BRUSH_SIZE,brush:brushId,layer};
  },
  featherMelt(keys,radius,squash=1){
   manualHeights=null;const core=new Set(keys),neighbors=new Set(),triangles=[];
   for(const key of core){const [x,y]=key.split(',').map(Number);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]]){const k=`${x+dx},${y+dy}`;if(!core.has(k))neighbors.add(k);}}
   // Distance to the real affected floor triangles, in uncompressed ground space.
   for(const key of core)for(const [a,b] of regions.get(key)||[]) {
    const y=Math.floor(a/width),x=a-y*width,end=b-y*width;
    triangles.push([bounds[0]+x*bounds[2]/width,(bounds[1]+y*bounds[3]/height)/squash,bounds[0]+end*bounds[2]/width,(bounds[1]+(y+1)*bounds[3]/height)/squash]);
   }
   const buckets=new Map(),step=radius;
   for(const box of triangles)for(let x=Math.floor((box[0]-radius)/step);x<=Math.floor((box[2]+radius)/step);x++)for(let y=Math.floor((box[1]-radius)/step);y<=Math.floor((box[3]+radius)/step);y++){const k=x+','+y;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(box);}
   for(const key of neighbors)for(const [a,b] of regions.get(key)||[])for(let i=a;i<b;i++){
    const x=bounds[0]+(i%width+.5)*bounds[2]/width,y=(bounds[1]+(Math.floor(i/width)+.5)*bounds[3]/height)/squash;
    let distanceSquared=radius*radius;
    for(const box of buckets.get(Math.floor(x/step)+','+Math.floor(y/step))||[]){
     const dx=Math.max(box[0]-x,0,x-box[2]);if(dx*dx>=distanceSquared)continue;
     const dy=Math.max(box[1]-y,0,y-box[3]);distanceSquared=Math.min(distanceSquared,dx*dx+dy*dy);
    }
    const t=Math.min(1,Math.sqrt(distanceSquared)/radius),remaining=t*t*(3-2*t);
    first[i]=Math.round(first[i]*remaining);second[i]=Math.round(second[i]*remaining);depth[i]=Math.round(depth[i]*remaining);extra[i]=Math.round(extra[i]*remaining);
   }
   recount();const data=new Uint8Array(width*height*4);for(let i=0;i<first.length;i++){data[i*4]=first[i];data[i*4+1]=second[i];data[i*4+2]=depth[i];data[i*4+3]=extra[i];}return {data,width,height};
  },
  melt(keys,amount){manualHeights=null;
   const remaining=1-Math.max(0,Math.min(1,amount)),fields=[first,second,depth];
   for(const key of new Set(keys))for(const [a,b] of regions.get(key)||[])for(let i=a;i<b;i++){
    extra[i]=Math.round(extra[i]*remaining);for(let layer=0;layer<3;layer++){const field=fields[layer],previous=field[i],before=previous>=threshold(layer,i);field[i]=Math.round(previous*remaining);if(eligible[i]){progress[layer]+=valueProgress(layer,field[i],i)-valueProgress(layer,previous,i);changeCoverage(layer,i,before,field[i]>=threshold(layer,i));}}
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
