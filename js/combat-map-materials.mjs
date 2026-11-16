import * as T from '../assets/vendor/three/three.module.min.js';
import {TEXTURES} from './combat-map-palette.mjs';
// Array textures keep the full palette and PBR channels below the GPU sampler limit.
export async function loadMapMaterials(){
 const response=await fetch('assets/textures/polyhaven/effects/manifest.json');if(!response.ok)throw Error('Material manifest could not load');const manifest=await response.json(),size=1024,pixels=size*size*4,channels=Array.from({length:4},()=>new Uint8Array(pixels*TEXTURES.length));
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d',{willReadFrequently:true});
 async function read(src){if(!src)return null;const image=new Image();image.src=src;await image.decode();ctx.clearRect(0,0,size,size);ctx.drawImage(image,0,0,size,size);return ctx.getImageData(0,0,size,size).data;}
 for(let layer=0;layer<TEXTURES.length;layer++){const item=TEXTURES[layer],m=manifest[item.id]||{},color=await read(item.src),normal=await read(m.nor_gl?.src||m.nor_dx?.src),arm=await read(m.arm?.src),ao=arm?null:await read(m.AO?.src),rough=arm?null:await read(m.Rough?.src),height=await read(m.Displacement?.src),spec=await read(m.spec?.src),mask=await read(m.Mask?.src);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const src=(y*size+x)*4,dst=layer*pixels+((size-1-y)*size+x)*4;for(let k=0;k<3;k++){channels[0][dst+k]=color[src+k];channels[1][dst+k]=normal?normal[src+k]:k===2?255:128;channels[3][dst+k]=spec?spec[src+k]:255;}if(normal&&!m.nor_gl)channels[1][dst+1]=255-channels[1][dst+1];channels[0][dst+3]=255;channels[1][dst+3]=height?height[src]:128;channels[2][dst]=arm?arm[src]:ao?ao[src]:255;channels[2][dst+1]=arm?arm[src+1]:rough?rough[src]:230;channels[2][dst+2]=arm?arm[src+2]:0;channels[2][dst+3]=normal||height||arm||rough||ao?255:0;channels[3][dst+3]=mask?mask[src]:255;}
 }
 const textures=channels.map((bytes,i)=>{const t=new T.DataArrayTexture(bytes,size,size,TEXTURES.length);t.wrapS=t.wrapT=T.RepeatWrapping;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.colorSpace=i===0?T.SRGBColorSpace:T.NoColorSpace;t.needsUpdate=true;return t;});
 return {uniforms:{albedoMaps:{value:textures[0]},normalHeightMaps:{value:textures[1]},surfaceMaps:{value:textures[2]},specMaskMaps:{value:textures[3]}},dispose(){textures.forEach(t=>t.dispose());}};
}
export const MATERIAL_GLSL=`
uniform highp sampler2DArray albedoMaps,normalHeightMaps,surfaceMaps,specMaskMaps;
uniform vec3 materialSun,materialView;uniform float materialDaylight;uniform bool materialEffects;
vec3 materialColor(int index,vec2 uv,float shadow){
 vec3 coord=vec3(uv,float(index));vec4 surface=texture(surfaceMaps,coord);vec3 base=texture(albedoMaps,coord).rgb;
 if(!materialEffects||surface.a<.5)return base*ambientGain*(1.-shadowStrength*shadow);
 vec3 V=normalize(materialView);vec2 shift=V.xy/max(.35,V.z)*.025;
 // Height-driven relief, with a small bounded offset; tactical tile height is unchanged.
 for(int step=0;step<5;step++){float h=texture(normalHeightMaps,coord).a-.5;coord.xy=uv-shift*h;}
 vec4 nh=texture(normalHeightMaps,coord);surface=texture(surfaceMaps,coord);base=texture(albedoMaps,coord).rgb;
 vec3 N=normalize(nh.rgb*2.-1.);float rough=clamp(surface.g,.08,1.),metal=surface.b,ao=surface.r;
 vec3 L=normalize(materialSun),H=normalize(L+V);float nl=max(dot(N,L),0.),nv=max(dot(N,V),.001),nhalf=max(dot(N,H),0.),vh=max(dot(V,H),0.);
 float a=rough*rough,a2=a*a,den=nhalf*nhalf*(a2-1.)+1.;float D=a2/(3.14159265*den*den+.0001);float k=(rough+1.)*(rough+1.)/8.;float G=(nv/(nv*(1.-k)+k))*(nl/(nl*(1.-k)+k+.0001));
 vec3 spec=texture(specMaskMaps,coord).rgb,F0=mix(.04*spec,base,metal),F=F0+(1.-F0)*pow(1.-vh,5.);vec3 reflection=D*G*F/max(.001,4.*nv*nl);
 float light=materialDaylight*(1.-shadowStrength*shadow);return base*(.65*ambientGain*ao+.45*nl*light*(1.-metal))+reflection*nl*light;
}
`;
