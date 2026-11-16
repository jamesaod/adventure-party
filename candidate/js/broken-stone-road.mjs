import {paintStreetV2} from './city-streets-v2.mjs';
import {sidewalkStones,sidewalkAlongWall,sidewalkSides} from './city-sidewalk.mjs';
import {groundKind,grassNeighborMask} from './exploration-ground.mjs?v=road1';
// Authored-space paving: one continuous staggered slab lattice, independent of
// brush stroke order, camera, tactical subdivision and rendering frame.
export function roadRandom(x,z,salt=0){let n=Math.imul(x+131071,374761393)^Math.imul(z+524287,668265263)^Math.imul(salt+1,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
const roadAt=(map,x,z)=>'.D'.includes(map.grid[z]?.[x]||'#')&&groundKind(map,x,z)==='road';
export function roadSignature(map,x,z){let s='';for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)s+=roadAt(map,x+dx,z+dz)?'r':groundKind(map,x+dx,z+dz)==='grass'?'g':'d';return `${x},${z}:${s}:${groundKind(map,x,z)}:${sidewalkAlongWall(map,x,z)}:${sidewalkSides(map,x,z).join('')}`;}
// Muted paving colors read from the reference; dirt remains the existing material.
export const ROAD_PALETTE=Object.freeze(['#d2bb96','#c7ae88','#bfa984','#b39e7b','#bda589','#aa9275','#b89d79','#c7ac83','#d7c19c']);
function wearNoise(x,z){const ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz,a=u*u*(3-2*u),b=v*v*(3-2*v);return (roadRandom(ix,iz,91)*(1-a)+roadRandom(ix+1,iz,91)*a)*(1-b)+(roadRandom(ix,iz+1,91)*(1-a)+roadRandom(ix+1,iz+1,91)*a)*b;}
// Partition small world-space blocks into mixed rectangles. Blocks are offset
// from authored squares so the same slab can continue over a tile seam.
const blockCache=new Map();
function slabBlock(bx,bz){const key=bx+','+bz;if(blockCache.has(key))return blockCache.get(key);const used=new Set(),out=[],n=12;
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){if(used.has(i+','+j))continue;const col=bx*n+i,row=bz*n+j,r=roadRandom(col,row,17);let w=r<.18?1:r<.68?2:3,h=roadRandom(col,row,18)<.48?2:roadRandom(col,row,19)<.72?1:3;w=Math.min(w,n-i);h=Math.min(h,n-j);while(w>1&&Array.from({length:w},(_,k)=>used.has((i+k)+','+j)).some(Boolean))w--;while(h>1&&Array.from({length:h},(_,v)=>Array.from({length:w},(_,u)=>used.has((i+u)+','+(j+v))).some(Boolean)).some(Boolean))h--;for(let v=0;v<h;v++)for(let u=0;u<w;u++)used.add((i+u)+','+(j+v));out.push({col,row,gx:col/12+.037,gz:row/12+.053,w:w/12,h:h/12});}
 if(blockCache.size>=256)blockCache.delete(blockCache.keys().next().value);blockCache.set(key,out);return out;}
export function roadStones(map,x,z){
 if(groundKind(map,x,z)==='sidewalk')return sidewalkStones(map,x,z);
 const stones=[];
 for(let bz=z-1;bz<=z;bz++)for(let bx=x-1;bx<=x;bx++)for(const slab of slabBlock(bx,bz)){
  const {col,row,gx,gz,w,h}=slab,cx=gx+w/2,cz=gz+h/2;
  if(gx-.012>=x+1||gz-.012>=z+1||gx+w+.012<=x||gz+h+.012<=z)continue;
  if(!roadAt(map,Math.floor(cx),Math.floor(cz)))continue;
  let edge=1;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const nx=Math.floor(cx)+dx,nz=Math.floor(cz)+dz;if(!roadAt(map,nx,nz))edge=Math.min(edge,Math.hypot(Math.max(nx-cx,0,cx-nx-1),Math.max(nz-cz,0,cz-nz-1)));}
  // Coherent erosion removes groups of slabs rather than evenly scattered holes.
  const wear=wearNoise(cx*3.8,cz*3.8)*.8+wearNoise(cx*8.2,cz*8.2)*.2;
  if(wear>.73||roadRandom(col,row,1)<.012+Math.max(0,.08-edge)*.8)continue;
  // Slight raised overlaps coexist with occasional recessed joints.
  const overlap=roadRandom(col,row,120)<.22;
  const gap=overlap?-(.004+roadRandom(col,row,121)*.006):roadRandom(col,row,122)<.09?.008:.0018;
  const chip=.007+roadRandom(col,row,2)*.009;
  stones.push({col,row,x:gx-x+gap,z:gz-z+gap,w:w-gap*2,h:h-gap*2,chip,tone:roadRandom(col,row,3),crack:roadRandom(col,row,4)<.14});
 }
 return stones.sort((a,b)=>a.row-b.row||a.col-b.col);
}
export function createRoadTileBank({base=null,size=256,makeCanvas=()=>document.createElement('canvas')}={}){
 const cache=new Map();
 return {cache,normal(map,x,z){const tile=this.get(map,x,z);if(!tile.roadNormal){const c=makeCanvas();c.width=c.height=size;const ctx=c.getContext('2d');if(groundKind(map,x,z)==='road2')paintStreetV2(ctx,x,z,size,{normal:true});else{const data=ctx.createImageData(size,size);data.data.set(roadRelief(map,x,z,size));ctx.putImageData(data,0,0);}tile.roadNormal=c;}return tile.roadNormal;},get(map,x,z){const key=roadSignature(map,x,z);if(cache.has(key))return cache.get(key);const c=makeCanvas();c.width=c.height=size;const ctx=c.getContext('2d');
 if(groundKind(map,x,z)==='road2'){paintStreetV2(ctx,x,z,size);if(cache.size>=512)cache.delete(cache.keys().next().value);cache.set(key,c);return c;}
 if(base)ctx.drawImage(base.get(grassNeighborMask(map,x,z)),0,0,size,size);else{ctx.fillStyle='#88765c';ctx.fillRect(0,0,size,size);}
 // Recessed substrate retains the original dirt detail beneath ambient occlusion.
 ctx.fillStyle='rgba(37,26,15,.10)';ctx.fillRect(0,0,size,size);
 const shade=makeCanvas();shade.width=shade.height=size;const shadeCtx=shade.getContext('2d'),shadeData=shadeCtx.createImageData(size,size);shadeData.data.set(roadDirtShade(map,x,z,size));shadeCtx.putImageData(shadeData,0,0);ctx.drawImage(shade,0,0);
 for(const s of roadStones(map,x,z)){
  const a=s.x*size,b=s.z*size,w=s.w*size,h=s.h*size,k=s.chip*size;
  ctx.beginPath();ctx.moveTo(a+k,b);ctx.lineTo(a+w-k,b);ctx.quadraticCurveTo(a+w,b,a+w,b+k);ctx.lineTo(a+w,b+h-k);ctx.quadraticCurveTo(a+w,b+h,a+w-k,b+h);ctx.lineTo(a+k,b+h);ctx.quadraticCurveTo(a,b+h,a,b+h-k);ctx.lineTo(a,b+k);ctx.quadraticCurveTo(a,b,a+k,b);ctx.closePath();
  // Cached relief only: no new geometry or per-frame lighting work.
  ctx.save();ctx.shadowColor='rgba(25,17,9,.65)';ctx.shadowBlur=size*.009;ctx.shadowOffsetX=size*.003;ctx.shadowOffsetY=size*.005;
  ctx.fillStyle=ROAD_PALETTE[Math.floor(s.tone*ROAD_PALETTE.length)];ctx.fill();ctx.restore();
  ctx.strokeStyle='rgba(50,37,23,.72)';ctx.lineWidth=size*.0035;ctx.stroke();
  ctx.save();ctx.clip();
  const bevel=Math.min(w,h)*.11;
  const top=ctx.createLinearGradient(0,b,0,b+bevel);top.addColorStop(0,'rgba(255,244,206,.48)');top.addColorStop(1,'rgba(255,244,206,0)');ctx.fillStyle=top;ctx.fillRect(a,b,w,bevel);
  const left=ctx.createLinearGradient(a,0,a+bevel,0);left.addColorStop(0,'rgba(255,241,200,.23)');left.addColorStop(1,'rgba(255,241,200,0)');ctx.fillStyle=left;ctx.fillRect(a,b,bevel,h);
  const bottom=ctx.createLinearGradient(0,b+h-bevel,0,b+h);bottom.addColorStop(0,'rgba(48,32,17,0)');bottom.addColorStop(1,'rgba(48,32,17,.48)');ctx.fillStyle=bottom;ctx.fillRect(a,b+h-bevel,w,bevel);
  const right=ctx.createLinearGradient(a+w-bevel,0,a+w,0);right.addColorStop(0,'rgba(48,32,17,0)');right.addColorStop(1,'rgba(48,32,17,.30)');ctx.fillStyle=right;ctx.fillRect(a+w-bevel,b,bevel,h);
  ctx.restore();
  ctx.save();ctx.clip();for(let i=0;i<35;i++){const r=roadRandom(s.col,s.row,10+i),t=roadRandom(s.col,s.row,60+i);ctx.fillStyle=i%2?'rgba(50,43,29,.08)':'rgba(245,239,207,.12)';ctx.fillRect(a+r*w,b+t*h,1+r*3,1+t*2);}ctx.restore();
  if(s.crack){ctx.strokeStyle='rgba(48,34,21,.72)';ctx.lineWidth=size*.0032;ctx.beginPath();ctx.moveTo(a+w*.3,b);ctx.lineTo(a+w*.47,b+h*.35);ctx.lineTo(a+w*.38,b+h*.6);ctx.lineTo(a+w*.62,b+h);ctx.stroke();}
 }
 // Separate road exposure from the brighter raised sidewalk; normals stay unchanged.
 if(groundKind(map,x,z)==='road'){ctx.save();ctx.globalCompositeOperation='multiply';ctx.fillStyle='#dddddd';ctx.fillRect(0,0,size,size);ctx.restore();}
 // Canvas pixels are cached, never generated during an unchanged redraw.
 if(cache.size>=512)cache.delete(cache.keys().next().value);cache.set(key,c);return c;}};
}

// Height in authored-square units; border samples preserve normals across seams.
export function roadRelief(map,x,z,size=256){
 const n=size+2,height=new Float32Array(n*n);
 for(const s of roadStones(map,x,z)){
  const radius=s.chip;
  for(let py=Math.max(0,Math.floor(s.z*size));py<Math.min(n,Math.ceil((s.z+s.h)*size)+2);py++)
  for(let px=Math.max(0,Math.floor(s.x*size));px<Math.min(n,Math.ceil((s.x+s.w)*size)+2);px++){
   const u=(px-.5)/size-s.x,v=(py-.5)/size-s.z;
   const qx=Math.abs(u-s.w/2)-(s.w/2-radius),qz=Math.abs(v-s.h/2)-(s.h/2-radius);
   const inside=radius-Math.hypot(Math.max(qx,0),Math.max(qz,0))-Math.min(Math.max(qx,qz),0);
   if(inside<=0)continue;
   const wx=x+(px-.5)/size,wz=z+(py-.5)/size;
   const bevel=Math.min(1,inside/(.009*(s.reliefScale||1))),bowl=Math.sin(Math.PI*u/s.w)*Math.sin(Math.PI*v/s.h);
   const rough=wearNoise(wx*95,wz*95),pits=Math.max(0,wearNoise(wx*43,wz*43)-.57);
   height[py*n+px]=(.013+roadRandom(s.col,s.row,140)*.004-.003*bowl+.0025*(rough-.5)-.012*pits)*bevel;
  }
 }
 const pixels=new Uint8ClampedArray(size*size*4);
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
  const k=(j+1)*n+i+1,dx=(height[k+1]-height[k-1])*size/2,dz=(height[k+n]-height[k-n])*size/2;
  const len=Math.hypot(dx,dz,1),o=(j*size+i)*4;
  pixels[o]=127.5*(1-dx/len);pixels[o+1]=127.5*(1+dz/len);pixels[o+2]=127.5*(1+1/len);pixels[o+3]=255;
 }
 return pixels;
}

// Nearest-edge occlusion: never accumulate darkness where several stones meet.
// Include neighboring tiles so the fading dirt shade continues across seams.
export function roadDirtShade(map,x,z,size=256){
 const alpha=new Float32Array(size*size),seen=new Set(),reach=.075;
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const stone of roadStones(map,x+dx,z+dz)){
  const id=stone.col+','+stone.row;if(seen.has(id))continue;seen.add(id);
  const s={...stone,x:stone.x+dx,z:stone.z+dz};
  for(let j=Math.max(0,Math.floor((s.z-reach)*size));j<Math.min(size,Math.ceil((s.z+s.h+reach)*size));j++)
  for(let i=Math.max(0,Math.floor((s.x-reach)*size));i<Math.min(size,Math.ceil((s.x+s.w+reach)*size));i++){
   const qx=Math.abs((i+.5)/size-s.x-s.w/2)-(s.w/2-s.chip),qz=Math.abs((j+.5)/size-s.z-s.h/2)-(s.h/2-s.chip);
   const distance=Math.max(0,Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0)-s.chip);
   const t=Math.max(0,1-distance/reach),a=.60*t*t*(3-2*t),k=j*size+i;alpha[k]=Math.max(alpha[k],a);
  }
 }
 const rgba=new Uint8ClampedArray(size*size*4);for(let i=0;i<alpha.length;i++){rgba[i*4]=31;rgba[i*4+1]=22;rgba[i*4+2]=13;rgba[i*4+3]=Math.round(alpha[i]*255);}return rgba;
}
