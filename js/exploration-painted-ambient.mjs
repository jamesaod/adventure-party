// Paint applies only to indirect light; torch/lantern direct light is untouched.
export function ambientMultiplier(map,x,z){
 const value=map.ambientLight?.[z]?.[x];
 if(value===null||value===undefined)return 1;
 return map.environment?.[z]?.[x]==='o'?Math.max(.05,2*value/100):1+value/100;
}
export function ambientTextureData(map){
 const data=new Uint8Array(map.width*map.height*4);
 for(let z=0;z<map.height;z++)for(let x=0;x<map.width;x++){
  const encoded=Math.round(ambientMultiplier(map,x,z)*2048),i=(z*map.width+x)*4;
  data[i]=encoded>>8;data[i+1]=encoded&255;data[i+3]=255;
 }
 return data;
}
export function installPaintedAmbient(THREE,scene,map,cellMetres){
 if(!map.ambientLight)return;
 const texture=new THREE.DataTexture(ambientTextureData(map),map.width,map.height,THREE.RGBAFormat);
 texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 const materials=new Set();scene.traverse(object=>{for(const material of Array.isArray(object.material)?object.material:[object.material])if((material?.isMeshStandardMaterial||material?.isMeshLambertMaterial))materials.add(material);});
 for(const material of materials){
  const before=material.onBeforeCompile;
  material.onBeforeCompile=function(shader,renderer){
   before.call(this,shader,renderer);
   shader.uniforms.paintedAmbient={value:texture};shader.uniforms.paintedAmbientSize={value:new THREE.Vector2(map.width,map.height)};
   shader.vertexShader='varying vec2 paintedAmbientWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
    vec4 ambientPosition=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     ambientPosition=instanceMatrix*ambientPosition;
    #endif
    paintedAmbientWorld=(modelMatrix*ambientPosition).xz;`);
   shader.fragmentShader='uniform sampler2D paintedAmbient; uniform vec2 paintedAmbientSize; varying vec2 paintedAmbientWorld;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    vec2 ambientCell=floor(paintedAmbientWorld/${Number(cellMetres).toFixed(6)}+0.5);
    vec2 paintedValue=texture2D(paintedAmbient,(ambientCell+0.5)/paintedAmbientSize).rg;
    reflectedLight.indirectDiffuse*=(paintedValue.r*65280.0+paintedValue.g*255.0)/2048.0;`);
  };
  material.customProgramCacheKey=()=> 'exploration-painted-ambient-v1';material.needsUpdate=true;
 }
 return texture;
}
