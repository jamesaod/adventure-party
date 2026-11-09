// Numeric snapshots deliberately detect in-place mutations as well as new faces.
const fields={position:[3,(f,j)=>[f.points[j].x,f.points[j].y,f.points[j].elevation||0]],uv:[2,(f,j)=>f.uv?.[j]||[0,0]],surfaceSnow:[1,f=>[f.snowEligible||0]],surfaceSunLoss:[3,f=>f.sunLoss||[0,0,0]],lightPoint:[3,(f,j)=>f.lightPoints?.[j]||[0,0,0]],lightNormal:[3,f=>f.lightNormal||[0,1,0]],lightSampleWorld:[2,(f,j)=>f.lightWorld?.[j]||[f.points[j].x,f.points[j].y]],surfaceVisibility:[1,f=>[f.visibility??1]],surfaceTint:[3,f=>f.tint||[1,1,1]],surfaceMultiply:[3,f=>f.multiply||[1,1,1]],surfaceBoost:[3,f=>f.boost||[0,0,0]],surfaceAdd:[3,f=>f.add||[0,0,0]]};
export function updateSurfaceBuffers(geometry,faces,THREE,count=()=>{}){
 const topology=faces.filter(f=>f.points.length>=3),vertices=topology.reduce((n,f)=>n+(f.points.length-2)*3,0);
 const cache=geometry.userData.surfaceCache||(geometry.userData.surfaceCache={});
 for(const [name,[size,read]] of Object.entries(fields)){
  const snapshot=[];for(const f of topology){snapshot.push(f.points.length);for(let j=0;j<f.points.length;j++)snapshot.push(...read(f,j));}
  const old=cache[name];if(old&&old.length===snapshot.length&&old.every((v,i)=>v===snapshot[i])){count('surfaceAttributesReused');continue;}
  let attribute=geometry.getAttribute(name);
  if(!attribute||attribute.array.length!==vertices*size){attribute=new THREE.BufferAttribute(new Float32Array(vertices*size),size).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute(name,attribute);}
  let offset=0;for(const f of topology)for(let i=1;i<f.points.length-1;i++)for(const j of [0,i,i+1]){attribute.array.set(read(f,j),offset);offset+=size;}
  attribute.needsUpdate=true;cache[name]=snapshot;count('surfaceAttributeUploads');
 }
 return vertices;
}

// Rounded dimensions, true LRU eviction, and a byte budget including MSAA.
export function createTargetPool(create,{limit=16,budget=64*1024*1024}={}){
 const entries=new Map();let bytes=0,hits=0,allocations=0;
 return {get(width,height,samples){width=Math.ceil(width/32)*32;height=Math.ceil(height/32)*32;const key=`${width}x${height}@${samples}`;
  if(entries.has(key)){const item=entries.get(key);entries.delete(key);entries.set(key,item);hits++;return item.target;}
  const cost=width*height*(8+Math.max(0,samples)*8);
  while(entries.size&&(entries.size>=limit||bytes+cost>budget)){const [key,item]=entries.entries().next().value;item.target.dispose();entries.delete(key);bytes-=item.cost;}
  const target=create(width,height,samples);entries.set(key,{target,cost});bytes+=cost;allocations++;return target;
 },stats:()=>({entries:entries.size,bytes,hits,allocations}),dispose(){for(const {target} of entries.values())target.dispose();entries.clear();bytes=0;}};
}
