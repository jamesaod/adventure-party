import {SNOW_SHELTER_GLSL,snowShelterUniforms} from './combat-snow-shelter.mjs?v=natural-ac1';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {SNOW_DEPTH_GLSL,SNOW_MAX_METRES} from './combat-snow-depth.mjs?v=shore-snow1';

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
 const uniforms=material.userData.unitSnow={waterField:{value:false},waterStream:{value:null},waterBasins:{value:null},waterBounds:{value:new THREE.Vector4()},waterState:{value:new THREE.Vector3()},water:{value:0},enabled:{value:false},coats:{value:null},tracks:{value:null},bounds:{value:new THREE.Vector4()},ground:{value:new THREE.Matrix4()},metres:{value:1},rise:{value:new THREE.Vector2()}};
 const prior=material.onBeforeCompile,priorKey=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{
  prior(shader);
  Object.assign(shader.uniforms,{...snowShelterUniforms,unitWaterField:uniforms.waterField,unitWaterStream:uniforms.waterStream,unitWaterBasins:uniforms.waterBasins,unitWaterBounds:uniforms.waterBounds,unitWaterState:uniforms.waterState,unitWaterDepth:uniforms.water,unitSnowEnabled:uniforms.enabled,unitSnowCoats:uniforms.coats,unitSnowTracks:uniforms.tracks,unitSnowBounds:uniforms.bounds,unitSnowGround:uniforms.ground,unitSnowMetres:uniforms.metres,unitSnowRise:uniforms.rise});
  shader.vertexShader='uniform mat4 unitSnowGround; varying vec3 unitSnowPoint;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec3 snowWorld=(modelMatrix*vec4(transformed,1.)).xyz;
   unitSnowPoint=vec3((unitSnowGround*vec4(snowWorld.x,0.,snowWorld.z,1.)).xy,snowWorld.y);`);
  shader.fragmentShader=`uniform bool unitWaterField;uniform sampler2D unitWaterStream,unitWaterBasins;uniform vec4 unitWaterBounds;uniform vec3 unitWaterState;uniform float unitWaterDepth;uniform bool unitSnowEnabled;uniform sampler2D unitSnowCoats,unitSnowTracks;uniform vec4 unitSnowBounds;uniform float unitSnowMetres;uniform vec2 unitSnowRise;varying vec3 unitSnowPoint;\n${SNOW_DEPTH_GLSL}\n${SNOW_SHELTER_GLSL}\n`+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
   if(unitWaterField){
    vec2 metres=unitSnowPoint.xy/vec2(128./3.,128./3.*.568329);
    vec4 channel=unitWaterState.x>0.?texture2D(unitWaterStream,(metres-unitWaterBounds.xy)/unitWaterBounds.zw):vec4(0.);
    float depth=texture2D(unitWaterBasins,metres/128.+.5).g*.1524;
    float water=max(0.,unitWaterState.y-.1524+depth);
    if(channel.r>.001){depth=channel.r;water=channel.g;}
    if(water>.0005&&unitSnowPoint.z/max(.00001,unitSnowMetres)-unitWaterState.z<water-depth)discard;
   }else if(unitWaterDepth>0.&&unitSnowPoint.z/max(.00001,unitSnowMetres)<unitWaterDepth)discard;
   if(unitSnowEnabled){
    vec2 snowUv=(unitSnowPoint.xy-unitSnowBounds.xy)/unitSnowBounds.zw;
    if(all(greaterThanEqual(snowUv,vec2(0.)))&&all(lessThanEqual(snowUv,vec2(1.)))){
     float snowHeight=snowDeformedHeight(snowSampleDepth(unitSnowCoats,snowUv),texture2D(unitSnowTracks,snowUv).rg);
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
       float foreground=snowDeformedHeight(snowSampleDepth(unitSnowCoats,uv),texture2D(unitSnowTracks,uv).rg);
       if(foreground>rayHeight+.0005)discard;
      }
     }}
    }
   }`);
 };
 material.customProgramCacheKey=()=>priorKey+'|snow-burial-water-field-5';
 return uniforms;
}
export function bindUnitSnowOcclusion(material,surface,matrix,modelUnitsPerMetre,enabled,waterDepth=0,waterSurface=null,bedDepth=0){
 const u=material.userData.unitSnow;if(!u)return;
 u.ground.value.copy(matrix);
 u.waterField.value=!!(enabled&&waterSurface?.active);
 if(waterSurface){u.waterStream.value=waterSurface.stream;u.waterBasins.value=waterSurface.basins;u.waterBounds.value.fromArray(waterSurface.bounds);u.waterState.value.set(waterSurface.enabled?1:0,waterSurface.level,bedDepth);}
 u.water.value=enabled?waterDepth:0;u.metres.value=modelUnitsPerMetre;
 u.enabled.value=!!(enabled&&surface);if(!u.enabled.value)return;
 u.coats.value=surface.texture;u.tracks.value=surface.tracks;u.bounds.value.copy(surface.bounds);u.ground.value.copy(matrix);u.metres.value=modelUnitsPerMetre;u.rise.value.set(-matrix.elements[4]*modelUnitsPerMetre,-matrix.elements[5]*modelUnitsPerMetre);
}
