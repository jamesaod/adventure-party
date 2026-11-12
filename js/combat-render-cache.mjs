// Reuse numeric snapshots; still detect in-place edits to any face attribute.
const fields={position:[3,(f,j,k)=>k===0?f.points[j].x:k===1?f.points[j].y:(f.points[j].elevation||0)],uv:[2,(f,j,k)=>f.uv?.[j]?.[k]||0],surfaceSnow:[1,f=>f.snowEligible||0],surfaceSunLoss:[3,(f,j,k)=>f.sunLoss?.[k]||0],lightPoint:[3,(f,j,k)=>f.lightPoints?.[j]?.[k]||0],lightNormal:[3,(f,j,k)=>f.lightNormal?.[k]??(k===1?1:0)],lightSampleWorld:[2,(f,j,k)=>f.lightWorld?.[j]?.[k]??(k===0?f.points[j].x:f.points[j].y)],surfaceVisibility:[1,f=>f.visibility??1],surfaceTint:[3,(f,j,k)=>f.tint?.[k]??1],surfaceMultiply:[3,(f,j,k)=>f.multiply?.[k]??1],surfaceBoost:[3,(f,j,k)=>f.boost?.[k]||0],surfaceAdd:[3,(f,j,k)=>f.add?.[k]||0]};
const fieldEntries=Object.entries(fields);
const perVertexFields=new Set(['position','uv','lightPoint','lightSampleWorld']);
const shadowFields=fieldEntries.slice(0,2);
const snowWeights=new Map();
function triangleWeights(divisions){
 if(snowWeights.has(divisions))return snowWeights.get(divisions);
 const weights=[],point=(x,y)=>[1-(x+y)/divisions,x/divisions,y/divisions];
 for(let i=0;i<divisions;i++)for(let j=0;j<divisions-i;j++){
  weights.push(point(i,j),point(i+1,j),point(i,j+1));
  if(i+j<divisions-1)weights.push(point(i+1,j),point(i+1,j+1),point(i,j+1));
 }
 snowWeights.set(divisions,weights);return weights;
}
const faceSnowDivisions=(f,d)=>f.snowEligible>0?d:1;
export function surfaceVertexCount(faces,snowDivisions=1){let vertices=0;for(const f of faces)if(f.points.length>=3)vertices+=(f.points.length-2)*3*(faceSnowDivisions(f,snowDivisions)**2);return vertices;}
export function updateSurfaceBuffers(geometry,faces,THREE,count=()=>{},shadowOnly=false,snowDivisions=1){
 if(shadowOnly)snowDivisions=1;
 const vertices=surfaceVertexCount(faces,snowDivisions);
 const cache=geometry.userData.surfaceCache||(geometry.userData.surfaceCache={});
 let topologyChanged=cache.snowDivisions!==snowDivisions;cache.snowDivisions=snowDivisions;
 const topology=cache.snowTopology||(cache.snowTopology=[]);let faceIndex=0;
 for(const f of faces){const divided=faceSnowDivisions(f,snowDivisions);if(topology[faceIndex]!==divided)topologyChanged=true;topology[faceIndex++]=divided;}
 if(topology.length!==faceIndex)topologyChanged=true;topology.length=faceIndex;
 for(const [name,[size,read]] of (shadowOnly?shadowFields:fieldEntries)){
  const constant=!perVertexFields.has(name);
  const snapshot=cache[name]||(cache[name]=[]);let cursor=0,changed=topologyChanged;
  for(const f of faces){if(f.points.length<3)continue;const n=f.points.length;if(snapshot[cursor]!==n)changed=true;snapshot[cursor++]=n;
   for(let j=0;j<(constant?1:n);j++)for(let k=0;k<size;k++){const value=read(f,j,k);if(snapshot[cursor]!==value)changed=true;snapshot[cursor++]=value;}
  }
  if(snapshot.length!==cursor)changed=true;snapshot.length=cursor;
  let attribute=geometry.getAttribute(name);
  if(!attribute||attribute.array.length!==vertices*size){attribute=new THREE.BufferAttribute(new Float32Array(vertices*size),size).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute(name,attribute);changed=true;}
  if(!changed){count('surfaceAttributesReused');continue;}
  let offset=0,base=0;for(const f of faces){const n=f.points.length;if(n<3)continue;base++;
   const weights=triangleWeights(faceSnowDivisions(f,snowDivisions));
   for(let i=1;i<n-1;i++)for(const w of weights)for(let k=0;k<size;k++)attribute.array[offset++]=constant?snapshot[base+k]:w[0]*snapshot[base+k]+w[1]*snapshot[base+i*size+k]+w[2]*snapshot[base+(i+1)*size+k];
   base+=(constant?1:n)*size;
  }
  attribute.needsUpdate=true;count('surfaceAttributeUploads');
 }
 return vertices;
}

// Rounded dimensions, true LRU eviction, and a byte budget including MSAA.
export function createTargetPool(create,{limit=16,budget=64*1024*1024,bytesPerPixel=8}={}){
 const entries=new Map();let bytes=0,hits=0,allocations=0;
 return {get(width,height,samples){width=Math.ceil(width/32)*32;height=Math.ceil(height/32)*32;const key=`${width}x${height}@${samples}`;
  if(entries.has(key)){const item=entries.get(key);entries.delete(key);entries.set(key,item);hits++;return item.target;}
  const cost=width*height*bytesPerPixel*(1+Math.max(0,samples));
  while(entries.size&&(entries.size>=limit||bytes+cost>budget)){const [key,item]=entries.entries().next().value;item.target.dispose();entries.delete(key);bytes-=item.cost;}
  const target=create(width,height,samples);entries.set(key,{target,cost});bytes+=cost;allocations++;return target;
 },stats:()=>({entries:entries.size,bytes,hits,allocations}),dispose(){for(const {target} of entries.values())target.dispose();entries.clear();bytes=0;}};
}
