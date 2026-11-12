import {installUnitSnowOcclusion} from './combat-unit-snow-occlusion.mjs';
import {SNOW_COVERAGE_GLSL} from './combat-snow-coverage.mjs';
import {createCorpseSnowMap} from './combat-corpse-snow-map.mjs';
import {SNOW_DEPTH_GLSL} from './combat-snow-depth.mjs';
import {SNOW_LAYER_METRES} from './combat-snow-depth.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
// Final-pose coverage is cached once. No animation sampling or particle collision.
// Undo the model composite's ACES/exposure and sRGB conversion so the snow
// arrives on screen with exactly the terrain's display-space lighting.
const acesInputInverse=new THREE.Matrix3().set(.59719,.35458,.04823,.076,.90834,.01566,.0284,.13383,.83777).invert();
const acesOutputInverse=new THREE.Matrix3().set(1.60475,-.53108,-.07367,-.10208,1.10813,-.00605,-.00327,-.07276,1.07602).invert();
function inverseSnowDisplay(rgb){
 const v=new THREE.Vector3(...rgb.map(c=>{c=Math.min(.99,Math.max(0,c));return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;})).applyMatrix3(acesOutputInverse);
 for(const key of ['x','y','z']){const y=Math.max(0,v[key]),a=1-.983729*y,b=.0245786-.432951*y,c=-.000090537-.238081*y;v[key]=(-b+Math.sqrt(Math.max(0,b*b-4*a*c)))/(2*a);}
 return v.applyMatrix3(acesInputInverse).multiplyScalar(.6/1.15);
}
// The fallback target is RGBA8; HDR targets still cannot represent negative light.
// Negative/HDR channels clip before
// ACES runs. Compress out-of-gamut colors toward neutral at the same luminance
// instead of allowing independent channel clipping to turn daylight snow cyan.
export function snowDisplayToLinear(rgb,hdr=false){
 const display=rgb.map(c=>Math.min(.99,Math.max(0,Number.isFinite(c)?c:0)));
 const color=inverseSnowDisplay(display);
 const ceiling=hdr?Infinity:1;
 if(color.toArray().every(c=>Number.isFinite(c)&&c>=0&&c<=ceiling))return color;
 const luminance=display[0]*.2126+display[1]*.7152+display[2]*.0722;
 const neutral=Math.min(ceiling,Math.max(0,inverseSnowDisplay([luminance,luminance,luminance]).y));
 let blend=1;
 for(const c of color.toArray()){
  if(!Number.isFinite(c)){blend=0;break;}
  if(c>ceiling)blend=Math.min(blend,(ceiling-neutral)/(c-neutral));
  else if(c<0)blend=Math.min(blend,neutral/(neutral-c));
 }
 return color.multiplyScalar(blend).addScalar(neutral*(1-blend)).clampScalar(0,ceiling);
}
// Cool undertone returns gradually only as the third (depth) layer builds.
export function corpseSnowTint(amount){
 const d=Math.max(0,Math.min(1,amount-2)),t=d*d*(3-2*d);
 return [.902,.916,.930].map((c,i)=>c+([.88,.92,.96][i]-c)*t);
}
// Ground blends in display color; bodies pass through ACES later. Blend in
// that same display space, then encode back to the retained linear target.
const corpseSnowBlendGLSL=`
vec3 corpseDisplay(vec3 c){
 c=mat3(.59719,.076,.0284,.35458,.90834,.13383,.04823,.01566,.83777)*(c*(1.15/.6));
 c=(c*(c+.0245786)-.000090537)/(c*(.983729*c+.432951)+.238081);
 c=max(vec3(0.),mat3(1.60475,-.10208,-.00327,-.53108,1.10813,-.07276,-.07367,-.00605,1.07602)*c);
 return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));
}
vec3 corpseLinear(vec3 c){
 c=clamp(c,0.,.99);c=mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));
 c=mat3(${acesOutputInverse.elements.join(',')})*c;
 vec3 a=1.-.983729*c,b=.0245786-.432951*c,d=-.000090537-.238081*c;
 c=(-b+sqrt(max(vec3(0.),b*b-4.*a*d)))/(2.*a);
 return max(vec3(0.),mat3(${acesInputInverse.elements.join(',')})*c*(.6/1.15));
}
`;
const records=new Set();
const maps=new WeakMap();
export function updateCorpseSnowMap(amount){maps.get(amount)?.update(amount.value);}
export function adjustCorpseSnow(hexes,delta){for(const r of records)if(!r.entity.alive&&hexes.has(`${r.entity.x},${r.entity.y}`))r.amount.value=Math.max(0,Math.min(6,r.amount.value+delta));}
export function fillCorpseSnow(hexes){for(const r of records)if(!r.entity.alive&&hexes.has(`${r.entity.x},${r.entity.y}`))r.amount.value=3;}
export function resetCorpseSnow(drop=false){for(const r of records)r.amount.value=0;if(drop){for(const r of records){maps.get(r.amount)?.dispose();maps.delete(r.amount);}records.clear();}}
export function advanceCorpseSnow(hexes,delta){for(const r of records){const e=r.entity;if(e.alive){maps.get(r.amount)?.dispose();maps.delete(r.amount);records.delete(r);continue;}if(hexes.has(`${e.x},${e.y}`)&&r.amount.value<3)r.amount.value=Math.min(3,r.amount.value+delta);}}
export function meltCorpseSnow(keys,fraction){const cells=new Set(keys);for(const r of records)if(cells.has(`${r.entity.x},${r.entity.y}`))r.amount.value*=1-Math.min(1,Math.max(0,fraction));}
export function registerCorpseSnow(entity){const amount={value:0};records.add({entity,amount});return amount;}
export function prepareCorpseSnow(group,entity,amount=registerCorpseSnow(entity)){
 const meshes=[];group.traverse(o=>{if(o.isMesh)meshes.push(o);});
 const box=new THREE.Box3();for(const m of meshes){m.geometry.computeBoundingBox();box.union(m.geometry.boundingBox);}
 const size=box.getSize(new THREE.Vector3()),res=64,top=new Float32Array(res*res).fill(-Infinity);
 const gx=x=>Math.max(0,Math.min(res-1,(x-box.min.x)/Math.max(size.x,.001)*(res-1)));
 const gz=z=>Math.max(0,Math.min(res-1,(z-box.min.z)/Math.max(size.z,.001)*(res-1)));
 // Rasterize all triangles from overhead, including shields and equipment.
 for(const m of meshes){const p=m.geometry.attributes.position,idx=m.geometry.index,n=idx?idx.count:p.count;
 for(let t=0;t<n;t+=3){const ids=[0,1,2].map(k=>idx?idx.getX(t+k):t+k),v=ids.map(i=>[gx(p.getX(i)),gz(p.getZ(i)),p.getY(i)]),[a,b,c]=v;
 const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-8)continue;
 for(let z=Math.floor(Math.min(...v.map(p=>p[1])));z<=Math.ceil(Math.max(...v.map(p=>p[1])));z++)for(let x=Math.floor(Math.min(...v.map(p=>p[0])));x<=Math.ceil(Math.max(...v.map(p=>p[0])));x++){
 const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(z-c[1]))/den,w=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(z-c[1]))/den;if(u>=-.02&&w>=-.02&&u+w<=1.02)top[z*res+x]=Math.max(top[z*res+x],u*a[2]+w*b[2]+(1-u-w)*c[2]);
 }}}
 const snowMap=createCorpseSnowMap(top,res);maps.set(amount,snowMap);snowMap.update(amount.value);
 const mapBounds=new THREE.Vector4(box.min.x,box.min.z,Math.max(size.x,.001),Math.max(size.z,.001));
 // Exposed vertices share a retained top-down particle accumulation map.
 for(const m of meshes){const p=m.geometry.attributes.position,n=m.geometry.attributes.normal,mask=new Float32Array(p.count);
 for(let i=0;i<p.count;i++){const h=top[Math.round(gz(p.getZ(i)))*res+Math.round(gx(p.getX(i)))];mask[i]=p.getY(i)>=h-Math.max(size.y*.035,.002)?Math.max(0,n.getY(i)):0;}
 m.geometry.setAttribute('corpseSnowExposure',new THREE.BufferAttribute(mask,1));
 for(const mat of [m.material].flat()){mat.userData.corpseSnowGroundLight={value:new THREE.Vector3()};mat.userData.corpseSnowMetres={value:1};const prior=mat.onBeforeCompile;mat.onBeforeCompile=shader=>{prior(shader);shader.uniforms.corpseSnowAmount=amount;shader.uniforms.corpseSnowMap={value:snowMap.texture};shader.uniforms.corpseSnowMapBounds={value:mapBounds};shader.uniforms.corpseSnowMetres=mat.userData.corpseSnowMetres;shader.uniforms.corpseSnowGroundLight=mat.userData.corpseSnowGroundLight;
 shader.vertexShader='uniform sampler2D corpseSnowMap;uniform vec4 corpseSnowMapBounds;uniform float corpseSnowMetres; attribute float corpseSnowExposure; varying float snowExposure; varying vec3 snowPosition;\n'+SNOW_DEPTH_GLSL+'\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 snowExposure=corpseSnowExposure;snowPosition=position;
 vec2 corpseUv=(position.xz-corpseSnowMapBounds.xy)/corpseSnowMapBounds.zw;
 // Body and equipment remain at their baked ground-level positions.`);
 // Burial tests the original baked body, not the raised snow shell. Testing
 // displaced vertices lets accumulated snow lift buried surfaces back out.
 shader.vertexShader=shader.vertexShader.replace('snowWorld.y);','(modelMatrix*vec4(position,1.)).y);');
 shader.fragmentShader=corpseSnowBlendGLSL+'uniform sampler2D corpseSnowMap;uniform vec4 corpseSnowMapBounds;\n'+'uniform vec3 corpseSnowGroundLight; uniform float corpseSnowAmount; varying float snowExposure; varying vec3 snowPosition;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec3 coats=texture2D(corpseSnowMap,(snowPosition.xz-corpseSnowMapBounds.xy)/corpseSnowMapBounds.zw).rgb;
 float first=smoothstep(.015,.34,coats.r);
 float second=smoothstep(.015,.34,coats.g+coats.b)*step(.99999,first);
 float exposure=smoothstep(.12,.65,snowExposure);
 float thin=first*.62*exposure;float powder=second*exposure;`);
 // Snow receives terrain lighting; the uncovered body retains model lighting.
 shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`if(thin>0.||powder>0.){
 vec3 display=corpseDisplay(outgoingLight),snowDisplay=corpseDisplay(corpseSnowGroundLight);
 display=mix(display,snowDisplay*vec3(.754/.902,.775/.916,.796/.930),thin);
 outgoingLight=corpseLinear(mix(display,snowDisplay,powder));
 }
 #include <opaque_fragment>`);
 };mat.customProgramCacheKey=()=>'corpse-snow-fixed-body-3';mat.needsUpdate=true;}
 }
 // Build one independent, closed top-surface snow shell. Its lower edge is
 // attached to the original top surface; only the white snow can rise.
 const positions=[],lift=[],uv=[],indices=[],edges=new Map();
 const add=(x,z,raise)=>{const id=positions.length/3;positions.push(box.min.x+x/(res-1)*size.x,top[z*res+x]+.0001,box.min.z+z/(res-1)*size.z);lift.push(raise);uv.push(x/(res-1),z/(res-1));return id;};
 const vertex=new Map();
 const at=(x,z)=>{const k=z*res+x;if(!vertex.has(k))vertex.set(k,add(x,z,1));return vertex.get(k);};
 const triangle=(a,b,c)=>{indices.push(a,b,c);for(const [u,v] of [[a,b],[b,c],[c,a]]){const k=Math.min(u,v)+','+Math.max(u,v);if(edges.has(k))edges.delete(k);else edges.set(k,[u,v]);}};
 for(let z=0;z<res-1;z++)for(let x=0;x<res-1;x++){
  const valid=(dx,dz)=>Number.isFinite(top[(z+dz)*res+x+dx]);
  if(valid(0,0)&&valid(0,1)&&valid(1,0))triangle(at(x,z),at(x,z+1),at(x+1,z));
  if(valid(1,0)&&valid(0,1)&&valid(1,1))triangle(at(x+1,z),at(x,z+1),at(x+1,z+1));
 }
 for(const [a,b] of edges.values()){
  const lower=id=>{const n=positions.length/3;positions.push(...positions.slice(id*3,id*3+3));uv.push(...uv.slice(id*2,id*2+2));lift.push(0);return n;},c=lower(a),d=lower(b);indices.push(a,c,b,b,c,d);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('snowLift',new THREE.Float32BufferAttribute(lift,1));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const source=[meshes[0]?.material].flat()[0];
 if(source&&indices.length){
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,side:THREE.DoubleSide});
 material.userData.baseColor=material.color.clone();material.userData.baseOpacity=1;material.userData.saturation={value:1};
 material.userData.corpseSnowGroundLight=source.userData.corpseSnowGroundLight;material.userData.corpseSnowMetres=source.userData.corpseSnowMetres;
 material.onBeforeCompile=shader=>{
  shader.uniforms.corpseSnowMap={value:snowMap.texture};shader.uniforms.corpseSnowMetres=material.userData.corpseSnowMetres;shader.uniforms.corpseSnowGroundLight=material.userData.corpseSnowGroundLight;
  shader.vertexShader='uniform sampler2D corpseSnowMap;uniform float corpseSnowMetres;attribute float snowLift;varying vec2 capUv;\n'+SNOW_DEPTH_GLSL+'\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   capUv=uv;transformed.y+=snowPhysicalDepth(texture2D(corpseSnowMap,uv))*corpseSnowMetres*snowLift;`);
  shader.fragmentShader='uniform sampler2D corpseSnowMap;uniform vec3 corpseSnowGroundLight;varying vec2 capUv;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
   vec3 coats=texture2D(corpseSnowMap,capUv).rgb;
   // Thin dust remains on the fixed body; powder forms the separate snow cap.
   if(coats.g<.015)discard;`).replace('#include <opaque_fragment>','outgoingLight=corpseSnowGroundLight;\n#include <opaque_fragment>');
 };
 material.customProgramCacheKey=()=>'corpse-snow-independent-cap-1';installUnitSnowOcclusion(material);
 const shell=new THREE.Mesh(geometry,material);shell.name='corpse-snow-cap';shell.userData.corpseSnowShell=true;shell.frustumCulled=false;group.add(shell);
 }else geometry.dispose();
 return amount;
}
