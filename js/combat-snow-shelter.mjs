import * as THREE from '../assets/vendor/three/three.module.min.js';
// Static canopy shelter: one shared field, no per-frame tree searches or pass.
const size=1024,data=new Uint8Array(size*size);data.fill(255);
const texture=new THREE.DataTexture(data,size,size,THREE.RedFormat);texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
export const snowShelterUniforms={snowShelter:{value:texture},snowShelterBounds:{value:new THREE.Vector4(0,0,1,1)}};
let revision=0;
export const snowShelterRevision=()=>revision;
export const SNOW_SHELTER_GLSL=`uniform sampler2D snowShelter;uniform vec4 snowShelterBounds;
float firSnowExposure(vec2 world){vec2 uv=(world-snowShelterBounds.xy)/snowShelterBounds.zw;if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 1.;return texture2D(snowShelter,uv).r;}`;
export function configureSnowShelter(trees,bounds,radius,squash=1){
 snowShelterUniforms.snowShelterBounds.value.fromArray(bounds);data.fill(255);
 const [left,top,w,h]=bounds;
 if(radius>0)for(const tree of trees){
  const reach=tree.radius>0?tree.radius:radius,ry=reach*squash;
  const x0=Math.max(0,Math.floor((tree.x-reach-left)/w*size)),x1=Math.min(size-1,Math.ceil((tree.x+reach-left)/w*size));
  const y0=Math.max(0,Math.floor((tree.y-ry-top)/h*size)),y1=Math.min(size-1,Math.ceil((tree.y+ry-top)/h*size));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const d=Math.hypot(left+(x+.5)*w/size-tree.x,(top+(y+.5)*h/size-tree.y)/squash)/reach;
   const t=Math.max(0,Math.min(1,(d-.12)/.88)),i=y*size+x;data[i]=Math.min(data[i],Math.round(255*t*t*(3-2*t)));
  }
 }
 texture.needsUpdate=true;revision++;
}
export function snowExposureAt(x,y){
 const b=snowShelterUniforms.snowShelterBounds.value,u=(x-b.x)/b.z,v=(y-b.y)/b.w;if(u<0||v<0||u>1||v>1)return 1;
 const px=u*size-.5,py=v*size-.5,ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
 const at=(x,y)=>data[Math.max(0,Math.min(size-1,y))*size+Math.max(0,Math.min(size-1,x))]/255;
 return (at(ix,iy)*(1-fx)+at(ix+1,iy)*fx)*(1-fy)+(at(ix,iy+1)*(1-fx)+at(ix+1,iy+1)*fx)*fy;
}
