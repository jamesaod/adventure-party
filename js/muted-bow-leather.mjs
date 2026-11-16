// Apply only to warm red leather/wood pixels; preserve metal, feathers and strings.
export function muteBowLeather(root){root?.traverse(node=>{if(!node.isMesh)return;node.material=[node.material].flat().map(source=>{if(source.userData.mutedBowLeather)return source;const m=source.clone();m.userData.mutedBowLeather=true;const previous=source.onBeforeCompile,key=source.customProgramCacheKey?.bind(source);m.onBeforeCompile=function(shader,...args){previous?.call(this,shader,...args);shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float leatherRed=smoothstep(.015,.12,diffuseColor.r-max(diffuseColor.g,diffuseColor.b));
 float leatherValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
 diffuseColor.rgb=mix(diffuseColor.rgb,leatherValue*vec3(1.14,.96,.76),leatherRed*.85);`);};m.customProgramCacheKey=()=>String(key?.()||'')+'-muted-brown-1';return m;});if(node.material.length===1)node.material=node.material[0];});}
