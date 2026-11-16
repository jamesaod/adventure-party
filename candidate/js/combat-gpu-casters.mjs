import {shadowGeometryFor} from './combat-shadow-geometry.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {combatPerformance as perf} from './combat-performance.mjs';

// Snapshot transforms/bone palettes, never evaluated vertices. Shared loadout
// rigs can be posed for another actor before the shadow queue is flushed.
export function snapshotGpuCaster(root,camera){
 root.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 const parts=[],palettes=new Map();
 root.traverseVisible(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
  const materials=[mesh.material].flat();
  if(materials.every(m=>m?.visible===false))return;
  if(mesh.skeleton&&!palettes.has(mesh.skeleton)){mesh.skeleton.update();palettes.set(mesh.skeleton,mesh.skeleton.boneMatrices.slice());}
  const geometry=shadowGeometryFor(mesh.geometry);
  parts.push({geometry,matrix:mesh.matrixWorld.clone(),
   bones:mesh.skeleton?palettes.get(mesh.skeleton):null,
   bind:mesh.bindMatrix?.clone(),unbind:mesh.bindMatrixInverse?.clone(),
   groups:(geometry.groups.length?geometry.groups:[{start:0,count:geometry.index?.count||geometry.attributes.position.count,materialIndex:0}]).filter(g=>materials[g.materialIndex||0]?.visible!==false).map(g=>({...g}))});
 });
 perf.count('shadowPaletteSnapshots');perf.count('shadowVerticesReadOnCpu',0);
 return {gpu:true,parts,camera:new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)};
}

export const gpuCasterDeclarations=`
uniform mat4 casterModel,captureCamera,frameToWorld,bindMatrix,bindMatrixInverse;
uniform bool hasSkin;uniform sampler2D bonePalette;uniform float bonePaletteHeight;
attribute vec4 skinIndex,skinWeight;
mat4 casterBone(float i){float y=(i+.5)/bonePaletteHeight;return mat4(texture2D(bonePalette,vec2(.125,y)),texture2D(bonePalette,vec2(.375,y)),texture2D(bonePalette,vec2(.625,y)),texture2D(bonePalette,vec2(.875,y)));}
vec3 physicalCaster(){
 vec4 p=vec4(position,1.);
 if(hasSkin){vec4 bound=bindMatrix*p;p=bindMatrixInverse*(casterBone(skinIndex.x)*bound*skinWeight.x+casterBone(skinIndex.y)*bound*skinWeight.y+casterBone(skinIndex.z)*bound*skinWeight.z+casterBone(skinIndex.w)*bound*skinWeight.w);}
 vec4 world=casterModel*p;
 vec4 ground=captureCamera*vec4(world.x,0.,world.z,1.),top=captureCamera*world;
 vec3 normalized=vec3((ground.x/ground.w+1.)*.5,(1.-ground.y/ground.w)*.5,(top.y/top.w-ground.y/ground.w)*.5);
 return (frameToWorld*vec4(normalized,1.)).xyz;
}`;

export function gpuCasterVertex(base){
 return base.replace('varying vec3 vGround;','varying vec3 vProjected;').replaceAll('vGround=','vProjected=').replace('attribute vec3 casterPoint; attribute float strength; attribute vec4 silhouetteAnchor;',gpuCasterDeclarations+'\nuniform float strength;\nconst vec4 silhouetteAnchor=vec4(0.);')
  .replace('void main(){','void main(){\n vec3 casterPoint=physicalCaster();')
  .replace('vUv=uv;','vUv=vec2(.5);')
  .replace('gl_Position=projectionMatrix*vec4(screen.xy,0.,1.);',`
 if(light.w>.5&&abs(receiverPlane.y)>.5){
  // Homogeneous projection lets the GPU clip triangles crossing lamp height.
  // No CPU triangle splitting and no folding above-light vertices onto ground.
  float w=light.y-casterPoint.y;
  vec2 numerator=casterPoint.xz*light.y-light.xz*casterPoint.y;
  vec3 projected=combatView*vec3(numerator*worldScale.xz,w);
  vec2 xy=anchor*w+(projected.xy-anchor*w)*zoom;
  gl_Position=projectionMatrix*vec4(xy,0.,w);
  vProjected=vec3(numerator.x,w,numerator.y);
  vStrength=strength;
 }else gl_Position=projectionMatrix*vec4(screen.xy,0.,1.);`);
}

