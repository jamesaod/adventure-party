import * as THREE from '../assets/vendor/three/three.module.min.js';
// A small depth-only proxy pass; the production painter compositor stays intact.
export const MAX_SHADOW_LIGHTS=2;
export function selectShadowLights(lights){
 return lights.map((light,index)=>({light,index})).filter(({light})=>light.kind!=='torch'&&light.intensity>0)
 .sort((a,b)=>(a.light.kind==='lantern'?-1:0)-(b.light.kind==='lantern'?-1:0)||b.light.intensity-b.light.intensity).slice(0,MAX_SHADOW_LIGHTS);
}
export function shadowSceneTriangles(faces,toPoint){
 const vertices=[];
 for(const face of faces)for(let i=1;i<face.points.length-1;i++)for(const p of [face.points[0],face.points[i],face.points[i+1]])vertices.push(...toPoint(p));
 return vertices;
}
export function createCombatShadowMaps(renderer){
 const scene=new THREE.Scene(),geometry=new THREE.BufferGeometry();
 const material=new THREE.ShaderMaterial({uniforms:{source:{value:new THREE.Vector3()},farPlane:{value:1}},side:THREE.DoubleSide,
 vertexShader:'varying vec3 vPosition;void main(){vPosition=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'#include <packing>\nuniform vec3 source;uniform float farPlane;varying vec3 vPosition;void main(){gl_FragColor=packDepthToRGBA(clamp(length(vPosition-source)/farPlane,0.,.999999));}'});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
 const records=Array.from({length:MAX_SHADOW_LIGHTS},()=>{
  const target=new THREE.WebGLCubeRenderTarget(256,{format:THREE.RGBAFormat,type:THREE.UnsignedByteType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,generateMipmaps:false});
  target.texture.colorSpace=THREE.NoColorSpace;
  return {target,camera:new THREE.CubeCamera(.05,32,target),key:null};
 });
 let sceneOwner,sceneKey,revision=0,renders=0;
 return {
  update(lights,description){
   renders=0;
   if(sceneOwner!==description.owner||sceneKey!==description.key){
    sceneOwner=description.owner;sceneKey=description.key;revision++;
    const data=description.triangles();geometry.dispose();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data,3));
   }
   lights.forEach(l=>{l.shadowSlot=-1;});
   const selected=selectShadowLights(lights),origins=new Float32Array(8);
   const oldTarget=renderer.getRenderTarget(),oldFace=renderer.getActiveCubeFace(),oldMip=renderer.getActiveMipmapLevel(),oldColor=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha(),oldAuto=renderer.autoClear;
   const viewport=renderer.getViewport(new THREE.Vector4());
   try{
    renderer.autoClear=true;renderer.setClearColor(0xffffff,1);
    selected.forEach(({light,index},slot)=>{
     const record=records[slot],position=light.shadowPosition||[light.x,light.y,light.z],far=light.shadowRange||light.range;
     lights[index].shadowSlot=slot;origins.set([...position,far],slot*4);
     const key=JSON.stringify([revision,position,far]);
     if(record.key===key)return;
     material.uniforms.source.value.fromArray(position);material.uniforms.farPlane.value=far;
     record.camera.position.fromArray(position);
     for(const camera of record.camera.children){camera.far=far;camera.updateProjectionMatrix();}
     record.camera.update(renderer,scene);record.key=key;renders+=6;
    });
   }finally{renderer.setRenderTarget(oldTarget,oldFace,oldMip);renderer.setViewport(viewport);renderer.setClearColor(oldColor,oldAlpha);renderer.autoClear=oldAuto;}
   return {textures:records.map(r=>r.target.texture),origins,count:selected.length,renders};
  },
  invalidate(){records.forEach(r=>{r.key=null;});},
  dispose(){geometry.dispose();material.dispose();records.forEach(r=>r.target.dispose());}
 };
}
export const combatShadowGLSL=`
 uniform samplerCube shadowDepth0,shadowDepth1;
 uniform vec4 shadowOrigins[2];
 float shadowDepth(int slot,vec3 direction){return unpackRGBAToDepth(slot==0?textureCube(shadowDepth0,direction):textureCube(shadowDepth1,direction));}
 float combatShadow(int slot,vec3 point,vec3 normal){
  vec4 source=shadowOrigins[slot];vec3 delta=point+normal*.025-source.xyz;
  float distance=length(delta),bias=.045/source.w;
  if(distance>=source.w)return 1.;
  vec3 direction=delta/max(.001,distance),axis=abs(direction.y)<.9?vec3(0.,1.,0.):vec3(1.,0.,0.);
  vec3 u=normalize(cross(direction,axis))*.004,v=normalize(cross(direction,u))*.004;
  float depth=distance/source.w-bias;
  return .25*(step(depth,shadowDepth(slot,direction+u))+step(depth,shadowDepth(slot,direction-u))+step(depth,shadowDepth(slot,direction+v))+step(depth,shadowDepth(slot,direction-v)));
 }
`;
