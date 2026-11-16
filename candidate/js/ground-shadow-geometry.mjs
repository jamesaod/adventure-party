/** Floor projection using the existing renderer and evaluated (skinned) vertices. */
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { sunPosition, DEFAULT_SUN_HOUR } from './unit-sun-shadow.mjs?v=R238C169';

export const SHADOW_FLOOR_Y=0.004;
export function groundShadowProjection(sun=sunPosition(DEFAULT_SUN_HOUR)){
  return new THREE.Matrix4().set(
    1,sun.groundX,0,0,
    0,0,0,SHADOW_FLOOR_Y,
    0,sun.groundZ,1,0,
    0,0,0,1
  );
}
export function createGroundShadowMaterial(){
  const material=new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide,
    depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending});
  material.onBeforeCompile=shader=>{
    shader.uniforms.groundShadowProjection={value:groundShadowProjection()};
    shader.vertexShader='uniform mat4 groundShadowProjection;\n'+shader.vertexShader.replace('#include <project_vertex>',`
      // transformed already includes morph targets and skinning. Project AFTER
      // modelMatrix so the sun stays in world space as the character turns.
      vec4 floorVertex = modelMatrix * vec4(transformed, 1.0);
      floorVertex.y = max(0.0, floorVertex.y);
      vec4 mvPosition = viewMatrix * groundShadowProjection * floorVertex;
      gl_Position = projectionMatrix * mvPosition;
    `);
  };
  material.customProgramCacheKey=()=> 'ground-shadow-world-plane-v1';
  return material;
}
export function renderGroundShadow(renderer,scene,camera,material){
  const previous=scene.overrideMaterial;
  try{scene.overrideMaterial=material;renderer.render(scene,camera);}
  finally{scene.overrideMaterial=previous;}
}
export function shadowPixelsCanvas(raw,width,height){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const rgba=new Uint8ClampedArray(raw.length),stride=width*4;
  for(let y=0;y<height;y++)rgba.set(raw.subarray((height-1-y)*stride,(height-y)*stride),y*stride);
  canvas.getContext('2d').putImageData(new ImageData(rgba,width,height),0,0);
  return canvas;
}
