import {LIGHTING_GLSL,bindLightingProfile} from './combat-lighting-profile.mjs';
import {installUnitSnowOcclusion} from './combat-unit-snow-occlusion.mjs?v=natural-ac1';
import {SNOW_COVERAGE_GLSL} from './combat-snow-coverage.mjs';
import {CORPSE_SNOW_LAYER_SECONDS,createCorpseSnowMap} from './combat-corpse-snow-map.mjs?v=natural-ac1';
import {SNOW_DEPTH_GLSL} from './combat-snow-depth.mjs?v=shore-snow1';
import {SNOW_LAYER_METRES} from './combat-snow-depth.mjs?v=shore-snow1';
import * as THREE from '../assets/vendor/three/three.module.min.js';
// Final-pose coverage is cached once. No animation sampling or particle collision.
// Match the terrain's final display RGB directly, including fully bright snow.
// Inverse ACES encoding and a second highlight knee changed this baseline.
export function snowAmbientDisplay(rgb){
 return new THREE.Vector3(...rgb.map(c=>Math.min(1,Math.max(0,Number.isFinite(c)?c:0))));
}
// Cool undertone returns gradually only as the third (depth) layer builds.
export function corpseSnowTint(amount){
 const d=Math.max(0,Math.min(1,amount-3)),t=d*d*(3-2*d);
 return [.902,.916,.930].map((c,i)=>c+([.88,.92,.96][i]-c)*t);
}
// Blend corpse snow in the same display space the user sees. Blending bright
// HDR snow into a dark body before ACES made a 25% alpha look almost white.
const corpseDisplayGLSL=`
vec3 corpseDisplay(vec3 c){
 c=mat3(.59719,.076,.0284,.35458,.90834,.13383,.04823,.01566,.83777)*(c*(1.15/.6));
 c=(c*(c+.0245786)-.000090537)/(c*(.983729*c+.432951)+.238081);
 c=max(vec3(0.),mat3(1.60475,-.10208,-.00327,-.53108,1.10813,-.07276,-.07367,-.00605,1.07602)*c);
 return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));
}`;
function displaySpaceCorpseShader(shader,snow=false){
 shader.fragmentShader=corpseDisplayGLSL+'\n'+shader.fragmentShader.replace('#include <opaque_fragment>',(snow?'':'outgoingLight=corpseDisplay(outgoingLight);\n')+'#include <opaque_fragment>').replace('#include <tonemapping_fragment>','').replace('#include <colorspace_fragment>','');
}
const records=new Set();
const maps=new WeakMap();
export function corpseWhitening(coverage){return Math.max(0,Math.min(.75,(Number(coverage)||0)-.25));}
export function updateCorpseSnowMap(amount){maps.get(amount)?.update(amount.value);}
export function setCorpseSnowWater(amount,water){if(!amount)return;amount.waterBlocked=Number(water)>.002;if(amount.waterBlocked)amount.value=0;}
export function adjustCorpseSnow(hexes,delta){for(const r of records)if(!r.entity.alive&&!r.amount.waterBlocked&&hexes.has(`${r.entity.x},${r.entity.y}`))r.amount.value=Math.max(0,Math.min(4,r.amount.value+delta*12));}
export function fillCorpseSnow(hexes){for(const r of records)if(!r.entity.alive&&!r.amount.waterBlocked&&hexes.has(`${r.entity.x},${r.entity.y}`))r.amount.value=4;}
export function resetCorpseSnow(drop=false){for(const r of records)r.amount.value=0;if(drop){for(const r of records){maps.get(r.amount)?.dispose();maps.delete(r.amount);}records.clear();}}
export function corpseSnowElapsed(elapsed,intensity){return Math.min(1,Math.max(0,Number(elapsed)||0))*Math.min(1,Math.max(0,Number(intensity)||0));}
export function advanceCorpseSnow(hexes,delta){for(const r of records){const e=r.entity;if(e.alive){maps.get(r.amount)?.dispose();maps.delete(r.amount);records.delete(r);continue;}if(r.amount.waterBlocked){r.amount.value=0;continue;}if(hexes.has(`${e.x},${e.y}`)&&r.amount.value<4)r.amount.value=Math.min(4,r.amount.value+Math.max(0,delta)/CORPSE_SNOW_LAYER_SECONDS);}}
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
 for(const mat of [m.material].flat()){mat.userData.corpseSnowGroundDisplay={value:new THREE.Vector3()};mat.userData.corpseSnowMetres={value:1};const prior=mat.onBeforeCompile,priorKey=mat.customProgramCacheKey();mat.onBeforeCompile=shader=>{prior(shader);shader.uniforms.corpseSnowAmount=amount;shader.uniforms.corpseSnowMap={value:snowMap.texture};shader.uniforms.corpseSnowMapBounds={value:mapBounds};shader.uniforms.corpseSnowMetres=mat.userData.corpseSnowMetres;shader.uniforms.corpseSnowGroundDisplay=mat.userData.corpseSnowGroundDisplay;
 shader.vertexShader='uniform sampler2D corpseSnowMap;uniform vec4 corpseSnowMapBounds;uniform float corpseSnowMetres; attribute float corpseSnowExposure; varying float snowExposure; varying vec3 snowPosition;\n'+SNOW_DEPTH_GLSL+'\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 snowExposure=corpseSnowExposure;snowPosition=position;
 vec2 corpseUv=(position.xz-corpseSnowMapBounds.xy)/corpseSnowMapBounds.zw;
 // Body and equipment remain at their baked ground-level positions.`);
 // Burial tests the original baked body, not the raised snow shell. Testing
 // displaced vertices lets accumulated snow lift buried surfaces back out.
 shader.vertexShader=shader.vertexShader.replace('snowWorld.y);','(modelMatrix*vec4(position,1.)).y);');
 shader.uniforms.corpseBodyWhitening={get value(){return corpseWhitening(amount.value/4);}};
 shader.fragmentShader='uniform float corpseBodyWhitening;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.),corpseBodyWhitening);');
 displaySpaceCorpseShader(shader);
 };mat.customProgramCacheKey=()=>priorKey+'|corpse-snow-display-body-391';mat.needsUpdate=true;}
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
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,side:THREE.DoubleSide,transparent:true,depthWrite:false});
 bindLightingProfile(material);
 material.forceSinglePass=true;material.userData.corpseSnowShell=true;material.userData.baseColor=material.color.clone();material.userData.baseOpacity=1;material.userData.saturation={value:1};
 material.userData.corpseSnowGroundDisplay=source.userData.corpseSnowGroundDisplay;material.userData.corpseSnowMetres=source.userData.corpseSnowMetres;
 material.onBeforeCompile=shader=>{
  shader.uniforms.apMaterial=material.userData.apMaterial;shader.uniforms.apLight=material.userData.apLight;
  shader.uniforms.corpseSnowMap={value:snowMap.texture};shader.uniforms.corpseSnowMetres=material.userData.corpseSnowMetres;shader.uniforms.corpseSnowGroundDisplay=material.userData.corpseSnowGroundDisplay;
  shader.vertexShader='uniform sampler2D corpseSnowMap;uniform float corpseSnowMetres;attribute float snowLift;varying vec2 capUv;\n'+SNOW_DEPTH_GLSL+'\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   capUv=uv;transformed.y+=dot(smoothstep(vec4(.015),vec4(.34),texture2D(corpseSnowMap,uv)),vec4(.0127))*corpseSnowMetres*snowLift;`);
  shader.fragmentShader=LIGHTING_GLSL+'uniform sampler2D corpseSnowMap;uniform vec3 corpseSnowGroundDisplay;varying vec2 capUv;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
   float coverage=dot(smoothstep(vec4(.015),vec4(.34),texture2D(corpseSnowMap,capUv)),vec4(.25));
   if(coverage<=0.)discard;diffuseColor.a*=coverage;`).replace('#include <opaque_fragment>',`vec3 corpsePointRadiance=vec3(0.);
   #if NUM_POINT_LIGHTS > 0
   IncidentLight corpsePoint;
   for(int i=0;i<NUM_POINT_LIGHTS;i++){
    getPointLightInfo(pointLights[i],geometryPosition,corpsePoint);
    corpsePointRadiance+=corpsePoint.color*max(0.,dot(geometryNormal,corpsePoint.direction))*RECIPROCAL_PI;
   }
   #endif
   outgoingLight=apSnowDisplay(corpseSnowGroundDisplay*apLight.x,corpsePointRadiance*apLight.y*apLight.x);
   #include <opaque_fragment>`);
  displaySpaceCorpseShader(shader,true);
 };
 material.customProgramCacheKey=()=>'corpse-snow-display-cap-391';installUnitSnowOcclusion(material);
 const shell=new THREE.Mesh(geometry,material);shell.name='corpse-snow-cap';shell.userData.corpseSnowShell=true;shell.frustumCulled=false;group.add(shell);
 }else geometry.dispose();
 return amount;
}

export function renderCorpseSnowLayers(renderer,scene,camera,group,amount){
      const shell=group.children.find(o=>o.userData.corpseSnowShell),cap=shell?.material;
      if(cap&&amount>0){
        // Seed the nearest cap depth, then blend that surface exactly once.
        // Closed sides and overlapping top triangles must not stack alpha.
        const hidden=[],autoClear=renderer.autoClear;cap.colorWrite=false;cap.depthWrite=true;
        try{
          renderer.render(scene,camera);
          group.traverse(o=>{if(o.isMesh&&o!==shell&&o.visible){hidden.push(o);o.visible=false;}});
          cap.colorWrite=true;cap.depthWrite=false;cap.depthFunc=THREE.EqualDepth;renderer.autoClear=false;
          renderer.render(scene,camera);
        }finally{for(const o of hidden)o.visible=true;cap.colorWrite=true;cap.depthWrite=false;cap.depthFunc=THREE.LessEqualDepth;renderer.autoClear=autoClear;}
      }else renderer.render(scene,camera);
}
