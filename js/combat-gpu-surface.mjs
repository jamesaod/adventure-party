import * as THREE from '../assets/vendor/three/three.module.min.js';
// One shared barycentric patch, instanced per source triangle. The GPU expands
// source attributes, then the existing terrain shader performs snow/water displacement.
export const GPU_SURFACE_DECLARATIONS='uniform sampler2D surfaceSource;';
export const GPU_SURFACE_SETUP=`
 vec3 bary=position;
 ivec2 sourceSlot=ivec2((gl_InstanceID%16)*16,gl_InstanceID/16);
 vec4 pa=texelFetch(surfaceSource,sourceSlot,0),pb=texelFetch(surfaceSource,sourceSlot+ivec2(3,0),0),pc=texelFetch(surfaceSource,sourceSlot+ivec2(6,0),0);
 vec4 ta=texelFetch(surfaceSource,sourceSlot+ivec2(1,0),0),tb=texelFetch(surfaceSource,sourceSlot+ivec2(4,0),0),tc=texelFetch(surfaceSource,sourceSlot+ivec2(7,0),0);
 vec4 la=texelFetch(surfaceSource,sourceSlot+ivec2(2,0),0),lb=texelFetch(surfaceSource,sourceSlot+ivec2(5,0),0),lc=texelFetch(surfaceSource,sourceSlot+ivec2(8,0),0);
 vec3 position=pa.xyz*bary.x+pb.xyz*bary.y+pc.xyz*bary.z;
 vec4 tex=ta*bary.x+tb*bary.y+tc*bary.z;
 vec2 uv=tex.xy,lightSampleWorld=tex.zw;
 vec3 lightPoint=la.xyz*bary.x+lb.xyz*bary.y+lc.xyz*bary.z;
 float surfaceSnow=pa.w,surfaceVisibility=la.w;
 vec3 lightNormal=texelFetch(surfaceSource,sourceSlot+ivec2(9,0),0).xyz;
 vec3 surfaceTint=texelFetch(surfaceSource,sourceSlot+ivec2(10,0),0).xyz;
 vec3 surfaceSunLoss=texelFetch(surfaceSource,sourceSlot+ivec2(11,0),0).xyz;
 vec3 surfaceMultiply=texelFetch(surfaceSource,sourceSlot+ivec2(12,0),0).xyz;
 vec3 surfaceBoost=texelFetch(surfaceSource,sourceSlot+ivec2(13,0),0).xyz;
 vec3 surfaceAdd=texelFetch(surfaceSource,sourceSlot+ivec2(14,0),0).xyz;
`;
export function createGpuSurface(){
 let lastFaces=null,lastRevision=null,lastTriangles=0;
 let geometry=null,divisions=0,data=new Float32Array(256*4),height=1;
 const texture=new THREE.DataTexture(data,256,height,THREE.RGBAFormat,THREE.FloatType);texture.needsUpdate=true;
 function template(d){
  const points=[],indices=[],ids=new Map();
  const point=(x,y)=>{const key=x+','+y;if(!ids.has(key)){ids.set(key,points.length/3);points.push(1-(x+y)/d,x/d,y/d);}return ids.get(key);};
  for(let x=0;x<d;x++)for(let y=0;y<d-x;y++){indices.push(point(x,y),point(x+1,y),point(x,y+1));if(x+y<d-1)indices.push(point(x+1,y),point(x+1,y+1),point(x,y+1));}
  const g=new THREE.InstancedBufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(indices);return g;
 }
 return {texture,get geometry(){return geometry;},update(faces,d,count=()=>{}){
  if(faces._surfaceRevision!==undefined&&faces===lastFaces&&faces._surfaceRevision===lastRevision&&d===divisions){count('surfaceRevisionReuses');count('surfaceSourceReused');count('surfaceSourceTriangles',lastTriangles);return lastTriangles*d*d;}
  let triangles=0;for(const f of faces)triangles+=Math.max(0,f.points.length-2);
  if(d!==divisions){geometry?.dispose();geometry=template(d);divisions=d;}
  const required=Math.max(1,2**Math.ceil(Math.log2(Math.ceil(triangles/16))));let changed=false;
  if(required>height){height=required;data=new Float32Array(256*height*4);texture.dispose();texture.image={data,width:256,height};changed=true;}
  let offset=0;const write=v=>{v=Math.fround(v);if(data[offset]!==v){data[offset]=v;changed=true;}offset++;};
  for(const f of faces)for(let i=1;i<f.points.length-1;i++){
   for(const j of [0,i,i+1]){const p=f.points[j];write(p.x);write(p.y);write(p.elevation||0);write(f.snowEligible||0);write(f.uv?.[j]?.[0]||0);write(f.uv?.[j]?.[1]||0);write(f.lightWorld?.[j]?.[0]??p.x);write(f.lightWorld?.[j]?.[1]??p.y);for(let k=0;k<3;k++)write(f.lightPoints?.[j]?.[k]||0);write(f.visibility??1);}
   for(const [name,defaults] of [['lightNormal',[0,1,0]],['tint',[1,1,1]],['sunLoss',[0,0,0]],['multiply',[1,1,1]],['boost',[0,0,0]],['add',[0,0,0]]]){for(let k=0;k<3;k++)write(f[name]?.[k]??defaults[k]);write(0);}offset+=4;
  }
  lastFaces=faces;lastRevision=faces._surfaceRevision;lastTriangles=triangles;geometry.instanceCount=triangles;if(changed){texture.needsUpdate=true;count('surfaceSourceUploads');}else count('surfaceSourceReused');count('surfaceSourceTriangles',triangles);return triangles*d*d;
 },dispose(){geometry?.dispose();texture.dispose();}};
}
