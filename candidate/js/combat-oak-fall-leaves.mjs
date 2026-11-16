import {ACTIVE_BROADLEAF,broadleafAsset} from './broadleaf-family.mjs?v=sweet-birch1';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {GLTFLoader} from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
// A fixed pool: analytic GPU trajectories, then persistent flat ground scatter.
export async function createOakFallLeaves(models,family=ACTIVE_BROADLEAF){
 const asset=await new GLTFLoader().loadAsync(broadleafAsset(family.particle+'.gltf',family));let card;asset.scene.traverse(m=>{if(m.isMesh)card=m;});
 // Precompute seasonal canopy samples once. Each particle begins on an
 // actual leaf triangle, transformed by the same topple as the standing tree.
 const count=6560,seeds=[],bursts=[],seasonOrigins=[],motion=[];
 const random=(i,salt)=>{let x=Math.imul(i+1,747796405)^Math.imul(salt,2891336453);x=Math.imul(x^(x>>>16),2246822519);x=Math.imul(x^(x>>>13),3266489917);return ((x^(x>>>16))>>>0)/4294967296;};
 for(let i=0;i<count;i++)for(let salt=1;salt<=4;salt++)motion.push(random(i,salt));
 const motionAttribute=new THREE.InstancedBufferAttribute(new Float32Array(motion),4);
 for(let i=0;i<count;i++){seeds.push((i*.61803398875+.137)%1);bursts.push(i<160?0:1);}
 for(const source of models){
  const triangles=[];source.updateMatrixWorld(true);
  source.traverse(m=>{if(!m.isMesh||!m.material.name.includes('Leaf'))return;const p=m.geometry.attributes.position,idx=m.geometry.index,n=idx?idx.count:p.count;
   for(let i=0;i<n;i+=3){const triangle=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+k):i+k).applyMatrix4(m.matrixWorld));if(triangle.every(v=>v.y>24))triangles.push(triangle);}
  });
  if(!triangles.length)throw Error('Oak impact leaves require canopy leaf triangles');
  const origins=[];
  for(let i=0;i<count;i++){const tri=triangles[Math.floor(seeds[i]*triangles.length)],r=Math.sqrt((i*.754877666+.31)%1),v=(i*.569840291+.23)%1;
   const point=tri[0].clone().multiplyScalar(1-r).addScaledVector(tri[1],r*(1-v)).addScaledVector(tri[2],r*v);origins.push(...point);
  }
  seasonOrigins.push(new THREE.InstancedBufferAttribute(new Float32Array(origins),3));
 }
 const geometry=new THREE.InstancedBufferGeometry();geometry.index=card.geometry.index;for(const [k,v] of Object.entries(card.geometry.attributes))geometry.setAttribute(k,v);
 geometry.setAttribute('fallMotion',motionAttribute);geometry.setAttribute('fallOrigin',seasonOrigins[0]);geometry.setAttribute('fallSeed',new THREE.InstancedBufferAttribute(new Float32Array(seeds),1));geometry.setAttribute('fallBurst',new THREE.InstancedBufferAttribute(new Float32Array(bursts),1));geometry.instanceCount=count;
 const greenMap=await new THREE.TextureLoader().loadAsync(broadleafAsset(family.greenLeaf,family));greenMap.flipY=false;greenMap.colorSpace=THREE.SRGBColorSpace;
 const autumnMap=card.material.map,sortRange={value:new THREE.Vector2(-1e9,1e9)};
 const time={value:0},autumn={value:0},wind={value:0},localYaw={value:0},separation={value:0},lift={value:0},light={value:1};
 const material=card.material.clone();material.transparent=false;material.depthWrite=true;material.alphaTest=.35;material.side=THREE.DoubleSide;material.roughness=1;
 material.onBeforeCompile=shader=>{
  shader.uniforms.oakLocalYaw=localYaw;shader.uniforms.oakSortRange=sortRange;shader.uniforms.oakSeparation=separation;shader.uniforms.oakLift=lift;shader.uniforms.oakLeafLight=light;shader.uniforms.oakFallTime=time;shader.uniforms.oakAutumn=autumn;shader.uniforms.oakFallWind=wind;
  shader.vertexShader=`attribute vec4 fallMotion;attribute vec3 fallOrigin;attribute float fallSeed,fallBurst;uniform vec2 oakSortRange;uniform float oakFallTime,oakFallWind,oakLift,oakSeparation,oakLocalYaw;varying float fallVisible,leafVariation;
 mat3 fallRotation(float pitch,float yaw){float c=cos(pitch),s=sin(pitch),a=cos(yaw),b=sin(yaw);return mat3(a,0.,-b,0.,1.,0.,b,0.,a)*mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
 `+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
float birth=mix(.12+fallMotion.x*2.28,2.6+fallMotion.x*.25,fallBurst),duration=mix(2.4+fallMotion.y*1.15,1.4+fallMotion.y*1.6,fallBurst);
 float u=clamp((oakFallTime-birth)/duration,0.,1.),flutter=sin(u*(12.+fallMotion.z*22.)+fallMotion.w*6.283185)*(1.-u);
 mat3 leafRotation=fallRotation(mix(flutter,1.570796,u),fallSeed*37.+flutter*2.);
  float angle=1.570796*pow(min(1.,birth/2.6),2.);
 vec3 rotatedOrigin=vec3(cos(oakLocalYaw)*fallOrigin.x+sin(oakLocalYaw)*fallOrigin.z,fallOrigin.y,-sin(oakLocalYaw)*fallOrigin.x+cos(oakLocalYaw)*fallOrigin.z);
 vec3 start=vec3(rotatedOrigin.x,cos(angle)*rotatedOrigin.y-sin(angle)*rotatedOrigin.z,sin(angle)*rotatedOrigin.y+cos(angle)*rotatedOrigin.z);
 start.y=max(.35,start.y+(1.-cos(angle))*oakLift);start.z+=-sin(angle)*oakLift+(1.-cos(angle))*oakSeparation; // Preserve canopy height at conversion; never launch from underground.
 float direction=fallMotion.w*6.283185,spread=mix(20.+fallMotion.z*50.,30.+fallMotion.z*75.,fallBurst);
 vec3 end=vec3(start.x+cos(direction)*spread+oakFallWind*20.,.35,start.z+sin(direction)*spread);
 vec3 center=mix(start,end,1.-pow(1.-u,2.));center.y=mix(start.y,end.y,u)+4.*u*(1.-u)*mix(5.,3.+fallSeed*9.,fallBurst);
 float sway=4.*u*(1.-u)*(6.+fallMotion.y*12.);
 center.x+=sin(u*11.+fallMotion.x*6.283185)*sway;center.z+=cos(u*9.+fallMotion.y*6.283185)*sway;
 transformed=center+leafRotation*(transformed*17.5*(.85+fallSeed*.6));float groundDepth=-(viewMatrix*modelMatrix*vec4(center.x,0.,center.z,1.)).y;
 fallVisible=step(birth,oakFallTime)*(1.-step(1.,u))*step(oakSortRange.x,groundDepth)*(1.-step(oakSortRange.y,groundDepth));leafVariation=mix(.78,1.,fallSeed);
 `);
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nif(fallVisible<.5)gl_Position=vec4(2.,2.,2.,1.);');
  shader.fragmentShader='uniform float oakAutumn,oakLeafLight;varying float fallVisible,leafVariation;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 if(fallVisible<.5)discard;
 float leafLight=dot(diffuseColor.rgb,vec3(.299,.587,.114));
 diffuseColor.rgb=mix(diffuseColor.rgb*vec3(.62,.70,.48),diffuseColor.rgb*vec3(.62,.48,.36),oakAutumn)*leafVariation;`);
 };
 material.customProgramCacheKey=()=> 'oak-random-flight-v8';
 const mesh=new THREE.Mesh(geometry,material);mesh.name='oak-fall-leaf-trail-and-burst';mesh.userData.oakFallLeaves=true;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
 return {mesh,count,resources:[greenMap,autumnMap,card.geometry,card.material],setRange(low,high){sortRange.value.set(low,high);},landings(variant,windValue,cutHeight=0,clearance=0,delta=0){
 const origin=seasonOrigins[variant===6?1:0],out=[];
 for(let i=0;i<count;i++){const seed=seeds[i],burst=bursts[i],mx=motionAttribute.getX(i),my=motionAttribute.getY(i),mz=motionAttribute.getZ(i),mw=motionAttribute.getW(i),birth=burst?2.6+mx*.25:.12+mx*2.28,duration=burst?1.4+my*1.6:2.4+my*1.15,angle=Math.PI/2*Math.min(1,birth/2.6)**2;
 const x=Math.cos(delta)*origin.getX(i)+Math.sin(delta)*origin.getZ(i),y=origin.getY(i),z=-Math.sin(delta)*origin.getX(i)+Math.cos(delta)*origin.getZ(i),spread=burst?30+mz*75:20+mz*50;
 out.push({x:x+Math.cos(mw*Math.PI*2)*spread+windValue*20,z:Math.sin(angle)*(y-cutHeight)+Math.cos(angle)*z+(1-Math.cos(angle))*clearance+Math.sin(mw*Math.PI*2)*spread,arrival:birth+duration,seed});}
 return out;},update(t,variant,ground,windValue,trunkLift,lighting,clearance=0,delta=0){localYaw.value=delta;separation.value=clearance;material.map=variant===6?autumnMap:greenMap;lift.value=trunkLift;light.value=lighting;const origins=seasonOrigins[variant===6?1:0];if(geometry.getAttribute('fallOrigin')!==origins)geometry.setAttribute('fallOrigin',origins);time.value=Math.min(6,t);autumn.value=variant===6?1:0;mesh.visible=t<6&&variant!==7&&!ground;geometry.instanceCount=t<6?count:0;wind.value=windValue;mesh.userData.season=variant===6?'fall':variant===7?'winter':'green';mesh.userData.effectTime=time.value;}};
}
