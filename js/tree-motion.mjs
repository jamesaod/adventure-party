import * as THREE from '../assets/vendor/three/three.module.min.js';
// Shared spatial deformation keeps separate OBJ components attached. This first
// pass is a continuous bend field, not a reconstructed branch skeleton.
export const TREE_MOTION_GLSL=`
uniform float treeMotionEnabled,treeMotionTime,treeWind,treeHeight,treeSeed;
uniform vec2 treeWindDirection;
uniform vec4 treeImpulses[4];
vec3 treeDeform(vec3 p){
 if(treeMotionEnabled<.5)return p;
 float h=clamp((p.y-21.7)/max(1.,treeHeight-21.7),0.,1.);
 float bend=h*h,radial=smoothstep(18.,230.,length(p.xz))*h;
 float gust=.58+.24*sin(treeMotionTime*1.17+treeSeed)+.18*sin(treeMotionTime*.49+treeSeed*1.7);
 vec2 sway=treeWindDirection*treeWind*(18.*gust*bend+7.*radial*sin(treeMotionTime*1.9+p.y*.008+treeSeed));
 vec2 blast=vec2(0.);
 for(int i=0;i<4;i++){float age=treeMotionTime-treeImpulses[i].w;if(age>=0.&&age<3.)blast+=treeImpulses[i].xy*treeImpulses[i].z*sin(age*6.5)*exp(-age*2.2);}
 float magnitude=length(blast);if(magnitude>1.2)blast*=1.2/magnitude;
 p.xz+=sway+blast*(52.*bend+12.*radial);
 p.y+=treeWind*radial*radial*(2.1*sin(treeMotionTime*3.1+p.x*.013+p.z*.011+treeSeed)+.7*sin(treeMotionTime*8.+p.y*.06));
 return p;
}
vec3 treeDeformNormal(vec3 p,vec3 n){
 if(treeMotionEnabled<.5)return n;
 vec3 t=normalize(cross(abs(n.y)<.9?vec3(0.,1.,0.):vec3(1.,0.,0.),n)),b=cross(n,t),c=treeDeform(p);
 return normalize(cross(treeDeform(p+t*.2)-c,treeDeform(p+b*.2)-c));
}
`;
export function createTreeMotion({publish=true}={}){
 const events=[],uniforms={treeMotionEnabled:{value:0},treeMotionTime:{value:0},treeWind:{value:0},treeHeight:{value:1000},treeSeed:{value:0},treeWindDirection:{value:new THREE.Vector2(1,0)},treeImpulses:{value:new Float32Array(16)}};
 let currentStamp=null,activeUpdates=0,blastUpdates=0;const now=()=>performance.now()/1000,wind=()=>Math.max(0,Math.min(1,globalThis.getWeatherSnapshot?.()?.amounts?.wind||0)),reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 function prune(time){while(events.length&&time-events[0].started>=3)events.shift();}
 const api={uniforms,blast({x,z,radius,strength=1,started=now()}){if(![x,z,radius,strength,started].every(Number.isFinite)||radius<=0)return false;prune(now());events.push({x,z,radius,strength:Math.max(0,Math.min(2,strength)),started});if(events.length>8)events.shift();globalThis.draw?.();return true;},reset(){events.length=0;uniforms.treeMotionEnabled.value=0;currentStamp=null;},active(){prune(now());return !reduced()&&(wind()>.001||events.length>0);},install(material){
  if(material.userData.treeMotionInstalled)return;material.userData.treeMotionInstalled=true;const prior=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{prior.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);shader.vertexShader=TREE_MOTION_GLSL+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=treeDeformNormal(position,objectNormal);').replace('#include <project_vertex>','transformed=treeDeform(transformed);\n#include <project_vertex>');};material.customProgramCacheKey=()=>key()+'-tree-motion1';
 },update({source,height,yaw,enabled,time=now()}){
  prune(time);const tick=Math.floor(time*30),clock=tick/30;uniforms.treeMotionTime.value=clock;uniforms.treeHeight.value=Math.max(1,height);uniforms.treeSeed.value=source?(source.x*.013+source.z*.021)%37:0;uniforms.treeWind.value=wind();
  const c=Math.cos(yaw),s=Math.sin(yaw),dx=.8,dz=.6;uniforms.treeWindDirection.value.set(c*dx-s*dz,s*dx+c*dz);const packed=uniforms.treeImpulses.value;packed.fill(0);let count=0;
  if(source)for(let i=events.length-1;i>=0&&count<4;i--){const e=events[i],x=source.x-e.x,z=source.z-e.z,d=Math.hypot(x,z),attenuation=Math.max(0,1-d/e.radius);if(attenuation<=0)continue;const nx=d>.001?x/d:dx,nz=d>.001?z/d:dz;packed.set([c*nx-s*nz,s*nx+c*nz,e.strength*attenuation*attenuation,e.started],count++*4);}
  const active=!!enabled&&!reduced()&&(uniforms.treeWind.value>.001||count>0);uniforms.treeMotionEnabled.value=active?1:0;currentStamp=active?tick:null;if(active){activeUpdates++;if(count>0)blastUpdates++;}return currentStamp;
 },diagnostics(){return {activeUpdates,blastUpdates,events:events.length,active:uniforms.treeMotionEnabled.value===1,stamp:currentStamp,wind:uniforms.treeWind.value,impulses:Array.from(uniforms.treeImpulses.value)};}};
 if(publish)globalThis.adventurePartyTreeMotion=api;return api;
}

