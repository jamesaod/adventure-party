import {SNOW_SHELTER_GLSL,snowShelterUniforms} from './combat-snow-shelter.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {SNOW_DEPTH_GLSL,SNOW_MAX_METRES} from './combat-snow-depth.mjs';

// Same orthographic mapping as the body and animated foot-contact sampler.
// Project a model-space ground point through its capture camera, then undo
// the battlefield view. Pan, rotation and walk interpolation stay aligned.
export function unitSnowGroundMatrix(camera,options,view,target=new THREE.Matrix4()){
 camera.updateMatrixWorld(true);
 const [a,b,c,d,tx,ty]=view.matrix,det=a*d-b*c,w=options.width,h=options.height;
 const sx=options.x-w*options.anchor.x+w/2-tx,sy=options.y-h*options.anchor.y+h/2-ty;
 target.set(d*w/2/det,c*h/2/det,0,(d*sx-c*sy)/det,-b*w/2/det,-a*h/2/det,0,(-b*sx+a*sy)/det,0,0,1,0,0,0,0,1);
 return target.multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
}
export function installUnitSnowOcclusion(material){
 const uniforms=material.userData.unitSnow={enabled:{value:false},coats:{value:null},tracks:{value:null},bounds:{value:new THREE.Vector4()},ground:{value:new THREE.Matrix4()},metres:{value:1},rise:{value:new THREE.Vector2()}};
 const prior=material.onBeforeCompile,priorKey=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{
  prior(shader);
  Object.assign(shader.uniforms,{...snowShelterUniforms,unitSnowEnabled:uniforms.enabled,unitSnowCoats:uniforms.coats,unitSnowTracks:uniforms.tracks,unitSnowBounds:uniforms.bounds,unitSnowGround:uniforms.ground,unitSnowMetres:uniforms.metres,unitSnowRise:uniforms.rise});
  shader.vertexShader='uniform mat4 unitSnowGround; varying vec3 unitSnowPoint;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec3 snowWorld=(modelMatrix*vec4(transformed,1.)).xyz;
   unitSnowPoint=vec3((unitSnowGround*vec4(snowWorld.x,0.,snowWorld.z,1.)).xy,snowWorld.y);`);
  shader.fragmentShader=`uniform bool unitSnowEnabled;uniform sampler2D unitSnowCoats,unitSnowTracks;uniform vec4 unitSnowBounds;uniform float unitSnowMetres;uniform vec2 unitSnowRise;varying vec3 unitSnowPoint;\n${SNOW_DEPTH_GLSL}\n${SNOW_SHELTER_GLSL}\n`+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
   if(unitSnowEnabled){
    vec2 snowUv=(unitSnowPoint.xy-unitSnowBounds.xy)/unitSnowBounds.zw;
    if(all(greaterThanEqual(snowUv,vec2(0.)))&&all(lessThanEqual(snowUv,vec2(1.)))){
     float snowHeight=snowDeformedHeight(snowSampleDepth(unitSnowCoats,snowUv)*firSnowExposure(unitSnowPoint.xy),texture2D(unitSnowTracks,snowUv).rg);
     float bodyHeight=unitSnowPoint.z/max(.00001,unitSnowMetres);
     if(snowHeight>.0005&&bodyHeight<snowHeight)discard;
     // The terrain is drawn before the model. Test foreground snow along
     // this pixel's viewing ray as well as directly below the body, otherwise
     // a carved hole makes its occupant draw over the near wall of the hole.
     float ceiling=${SNOW_MAX_METRES*1.16};
     if(bodyHeight<ceiling){for(int i=1;i<=8;i++){
      float rayHeight=mix(max(0.,bodyHeight),ceiling,float(i)/8.);
      vec2 world=unitSnowPoint.xy+unitSnowRise*(rayHeight-bodyHeight);
      vec2 uv=(world-unitSnowBounds.xy)/unitSnowBounds.zw;
      if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){
       float foreground=snowDeformedHeight(snowSampleDepth(unitSnowCoats,uv)*firSnowExposure(world),texture2D(unitSnowTracks,uv).rg);
       if(foreground>rayHeight+.0005)discard;
      }
     }}
    }
   }`);
 };
 material.customProgramCacheKey=()=>priorKey+'|snow-burial-3';
 return uniforms;
}
export function bindUnitSnowOcclusion(material,surface,matrix,modelUnitsPerMetre,enabled){
 const u=material.userData.unitSnow;if(!u)return;
 u.enabled.value=!!(enabled&&surface);if(!u.enabled.value)return;
 u.coats.value=surface.texture;u.tracks.value=surface.tracks;u.bounds.value.copy(surface.bounds);u.ground.value.copy(matrix);u.metres.value=modelUnitsPerMetre;u.rise.value.set(-matrix.elements[4]*modelUnitsPerMetre,-matrix.elements[5]*modelUnitsPerMetre);
}
