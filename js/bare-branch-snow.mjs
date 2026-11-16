// Snowfall time, not wall time or existing ground depth, drives bare wood.
export function createBareBranchSnowState(){
 const records=new Map();let epoch=null;
 return {update(key,bare,clock={}){if(epoch!==clock.epoch){epoch=clock.epoch;records.clear();}const now=Number(clock.seconds)||0;if(!bare){records.delete(key);return 0;}let start=records.get(key);if(start===undefined){start=now;records.set(key,start);}return Math.floor(Math.max(0,Math.min(1,(now-start)/120))*120)/120;},clear(){records.clear();},get size(){return records.size;}};
}
export function installBareBranchSnow(material,amount){
 const prior=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{prior.call(material,shader);shader.uniforms.bareBranchSnow=amount;
  shader.vertexShader='varying vec3 vBareSnowNormal;varying vec3 vBareSnowPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBareSnowNormal=normalize(mat3(modelMatrix)*normal);vBareSnowPosition=position;');
  shader.fragmentShader='uniform float bareBranchSnow;varying vec3 vBareSnowNormal;varying vec3 vBareSnowPosition;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float branchUp=smoothstep(.25,.78,normalize(vBareSnowNormal).y);
   vec3 grain=vBareSnowPosition*.055;
   float variation=.5+.25*sin(grain.x+sin(grain.z*1.7))+.25*sin(grain.y*1.3+grain.z);
   float powder=smoothstep(variation*.55,variation*.55+.45,bareBranchSnow);
   float woodSnow=branchUp*powder*.92;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.76,.82,.88),woodSnow);
  `);
 };
 material.customProgramCacheKey=()=>key+'|bare-branch-snow1';
}
