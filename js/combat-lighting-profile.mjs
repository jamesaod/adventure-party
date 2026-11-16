import * as THREE from '../assets/vendor/three/three.module.min.js';

// Presentation controls shared by combat and the local lighting lab. These do
// not change source strength, visibility, snow coverage or equipment assets.
export const COMBAT_LIGHTING_DEFAULTS=Object.freeze({roughness:.92,metalness:.1,shieldSpecular:0,compression:1,diffuse:1,snowReflectance:.8,sky:1,sun:1,local:1,linearLightColors:true});
export function lightingProfile(value){
 if(value==null)return COMBAT_LIGHTING_DEFAULTS;
 const p={...COMBAT_LIGHTING_DEFAULTS};
 for(const key of ['roughness','metalness','shieldSpecular','compression','snowReflectance'])if(Number.isFinite(value?.[key]))p[key]=Math.max(0,Math.min(1,value[key]));
 for(const key of ['diffuse','sky','sun','local'])if(Number.isFinite(value?.[key]))p[key]=Math.max(0,Math.min(4,value[key]));
 if(value?.linearLightColors===false)p.linearLightColors=false;
 return p;
}
// Leave ordinary diffuse values unchanged. Compress only intense reflected
// light, preserving RGB ratios instead of clipping every channel to white.
export function compressDiffuse(rgb,strength=1){const peak=Math.max(...rgb);if(peak<=.6)return rgb.slice();const compressed=.6+.6*(peak-.6)/peak;const scale=1+(compressed/peak-1)*strength;return rgb.map(v=>v*scale);}
// Ambient snow already has the terrain's display color. Preserve it exactly;
// only the additional lamp reflection uses a bounded share of remaining range.
export function composeSnowDisplay(ambient,pointRadiance,strength=1){
 const base=ambient.map(v=>Math.max(0,Math.min(1,v))),local=pointRadiance.map(v=>Math.max(0,v)**(1/2.2));
 const peak=Math.max(...local),scale=.35/(.35+peak);
 return base.map((v,i)=>Math.min(1,v+local[i]*((1-strength)+strength*(1-v)*scale)));
}
export const LIGHTING_GLSL=`
uniform vec4 apMaterial; // roughness floor, metalness ceiling, shield specular, compression
uniform vec2 apLight; // diffuse gain, snow local-light reflectance
vec3 apDiffuse(vec3 light){
 float peak=max(light.r,max(light.g,light.b));
 if(peak<=.6)return light;
 float compressed=.6+.6*(peak-.6)/(.6+peak-.6);
 return light*mix(1.,compressed/peak,apMaterial.w);
}
// The baseline bypasses model tone mapping. Limit lamp lift, not ambient.
vec3 apSnowDisplay(vec3 ambient,vec3 pointRadiance){
 vec3 base=clamp(ambient,0.,1.),local=pow(max(vec3(0.),pointRadiance),vec3(1./2.2));
 float peak=max(local.r,max(local.g,local.b));
 vec3 bounded=(vec3(1.)-base)*local*(.35/(.35+peak));
 return clamp(base+mix(local,bounded,apMaterial.w),0.,1.);
}
`;
export function bindLightingProfile(material,profile=COMBAT_LIGHTING_DEFAULTS){
 const data=material.userData;
 // Prepared asset JSON turns userData vectors into plain objects.
 if(!data.apMaterial?.value?.isVector4)data.apMaterial={value:new THREE.Vector4()};
 if(!data.apLight?.value?.isVector2)data.apLight={value:new THREE.Vector2()};
 data.apMaterial.value.set(profile.roughness,profile.metalness,profile.shieldSpecular,profile.compression);
 data.apLight.value.set(profile.diffuse,profile.snowReflectance);
 if(!data.corpseSnowShell){
  data.apSourceRoughness??=material.roughness??1;data.apSourceMetalness??=material.metalness??0;
  material.roughness=Math.max(profile.roughness,data.apSourceRoughness);material.metalness=Math.min(profile.metalness,data.apSourceMetalness);
 }
}
