// Same display transform as accepted corpse snow; conditional so bare trees stay unchanged.
export const FIR_DISPLAY_GLSL=`
vec3 corpseDisplay(vec3 c){
 c=mat3(.59719,.076,.0284,.35458,.90834,.13383,.04823,.01566,.83777)*(c*(1.15/.6));
 c=(c*(c+.0245786)-.000090537)/(c*(.983729*c+.432951)+.238081);
 c=max(vec3(0.),mat3(1.60475,-.10208,-.00327,-.53108,1.10813,-.07276,-.07367,-.00605,1.07602)*c);
 return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));
}`;
export function installFirDisplay(material,enabled){
 const prior=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{prior.call(material,shader);shader.uniforms.firDisplaySpace=enabled;
 shader.fragmentShader='uniform bool firDisplaySpace;\n'+FIR_DISPLAY_GLSL+'\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','if(firDisplaySpace)outgoingLight=corpseDisplay(outgoingLight);\n#include <opaque_fragment>');
 for(const chunk of ['tonemapping_fragment','colorspace_fragment'])shader.fragmentShader=shader.fragmentShader.replace('#include <'+chunk+'>','if(!firDisplaySpace){\n#include <'+chunk+'>\n}');
 };material.customProgramCacheKey=()=>key+'|fir-display-447';
}

