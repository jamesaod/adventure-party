import * as THREE from '../assets/vendor/three/three.module.min.js';
import {canopySnowSurface} from './combat-canopy-snow-surface.mjs';
// One-time, alpha-aware multilayer canopy sampling. No snow particle collisions.
export function createFirSnowCaps(model){
 const started=performance.now();model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),foliage=[];
 model.traverse(m=>{if(m.isMesh&&m.material.alphaTest>0)foliage.push(m);});
 const pixels=new Map();
 function opaque(hit){const map=hit.object.material.map;if(!map||!hit.uv)return true;
  if(!pixels.has(map)){const im=map.image,c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);pixels.set(map,{data:ctx.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height});}
  const p=pixels.get(map),uv=hit.uv.clone();map.transformUv(uv);const x=Math.min(p.w-1,Math.max(0,Math.floor(uv.x*p.w))),y=Math.min(p.h-1,Math.max(0,Math.floor(uv.y*p.h)));return p.data[(y*p.w+x)*4+3]>32;
 }
 const resolution=48,step=Math.max(size.x,size.z)/(resolution-1),columns=[],ray=new THREE.Raycaster();
 for(let x=0;x<resolution;x++)for(let z=0;z<resolution;z++){
  ray.set(new THREE.Vector3(box.min.x+x*step,box.max.y+1,box.min.z+z*step),new THREE.Vector3(0,-1,0));
  const samples=[];
  for(const hit of ray.intersectObjects(foliage,false)){
   if(hit.point.y<box.min.y+size.y*.08||!opaque(hit))continue;
   if(samples.some(p=>Math.abs(p.y-hit.point.y)<step*1.1))continue;
   samples.push({x:hit.point.x,y:hit.point.y,z:hit.point.z});
   if(samples.length>=8)break;
  }columns.push(samples);
 }
 const surface=canopySnowSurface(columns,resolution,step),positions=[],heights=[],shades=[];
 function vertex(id,skirt=false){const p=surface.vertices[id],point=model.worldToLocal(new THREE.Vector3(p.x,p.y,p.z));// Keep the blanket above crossing foliage cards, not buried in their triangles.
  point.y+=step*1.25/model.scale.y;positions.push(point.x,point.y,point.z);
  heights.push((skirt?0:surface.boundary.has(id)?.38:.7)*step/model.scale.y);shades.push(skirt?.8:surface.boundary.has(id)?.95:1);
 }
 for(const f of surface.faces)for(const id of f)vertex(id);
 for(const [a,b] of surface.edges){vertex(a);vertex(b,true);vertex(b);vertex(a);vertex(a,true);vertex(b,true);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('snowLift',new THREE.Float32BufferAttribute(heights,1));geometry.setAttribute('snowShade',new THREE.Float32BufferAttribute(shades,1));for(let i=0;i<heights.length;i++)geometry.attributes.position.setY(i,geometry.attributes.position.getY(i)+heights[i]);geometry.computeVertexNormals();
 const amount={value:0},sun={value:new THREE.Vector3(0,1,0)},day={value:1};
 const material=new THREE.MeshStandardMaterial({color:0xeaf0f5,roughness:1,metalness:0,side:THREE.DoubleSide});
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{snowAmount:amount,snowSun:sun,snowDay:day});
  shader.vertexShader='attribute float snowLift; attribute float snowShade; varying float vSnowShade; uniform float snowAmount; varying vec3 vSnowNormal; varying vec3 vSnowPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y-=snowLift*(1.0-snowAmount);vSnowShade=snowShade;vSnowPosition=position;').replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nvSnowNormal=inverseTransformDirection(transformedNormal,viewMatrix);');
  shader.fragmentShader='varying float vSnowShade; varying vec3 vSnowNormal; uniform vec3 snowSun; uniform float snowDay; uniform float snowAmount; varying vec3 vSnowPosition;\n'+shader.fragmentShader;
  // Filled foliage shadow cards are deliberately broad. Attenuate their shadow
  // strength on snow, as on needles, so exposed snow isn't uniformly blackened.
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',THREE.ShaderChunk.lights_fragment_begin.replace('directionalLightShadow.shadowIntensity,','directionalLightShadow.shadowIntensity * 0.25,'));
  shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',`#include <colorspace_fragment>
   float reveal=.5+.25*sin(vSnowPosition.x*.08)+.25*cos(vSnowPosition.z*.09+vSnowPosition.y*.05);
   if(snowAmount<reveal*.52)discard;
   float facing=smoothstep(-.15,.85,dot(normalize(vSnowNormal),normalize(snowSun)));
   vec3 tint=mix(vec3(.58,.73,.92),vec3(1.,.98,.94),facing*vSnowShade);
   gl_FragColor.rgb*=mix(vec3(vSnowShade),tint*vSnowShade,snowDay);
  `);
 };
 material.customProgramCacheKey=()=> 'fir-canopy-snow-soft-shelves-v2';
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=false;mesh.visible=false;model.add(mesh);
 mesh.userData.snowPreparation={milliseconds:performance.now()-started,triangles:positions.length/9,samples:surface.vertices.length};
 return {mesh,light(direction,daylight){sun.value.copy(direction);day.value=Math.max(0,Math.min(1,daylight));},set(value){amount.value=Math.max(0,Math.min(1,value));mesh.visible=amount.value>.01;}};
}
