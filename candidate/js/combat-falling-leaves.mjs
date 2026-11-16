import {ACTIVE_BROADLEAF,broadleafAsset} from './broadleaf-family.mjs?v=sweet-birch1';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {GLTFLoader} from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
const UNITS=43.38933076913966;
export async function createFallingLeaves(model,family=ACTIVE_BROADLEAF){
 const asset=await new GLTFLoader().loadAsync(broadleafAsset(family.particle+'.gltf',family));let card;asset.scene.traverse(m=>{if(m.isMesh)card=m;});
 const geometry=new THREE.InstancedBufferGeometry();geometry.index=card.geometry.index;for(const [k,v] of Object.entries(card.geometry.attributes))geometry.setAttribute(k,v);
 const candidates=[];model.updateMatrixWorld(true);const inverse=model.matrixWorld.clone().invert();
 model.traverse(m=>{if(!m.isMesh||!m.material.name.includes('Leaf'))return;const p=m.geometry.attributes.position,transform=inverse.clone().multiply(m.matrixWorld);for(let i=0;i<p.count;i+=3){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(transform);if(v.y>UNITS*3)candidates.push(v);}});
 const count=candidates.length?96:0,origins=[],seeds=[];for(let i=0;i<count;i++){const seed=((i*0.61803398875+.137)%1);seeds.push(seed);origins.push(...candidates[Math.floor(seed*candidates.length)]);}
 geometry.setAttribute('leafOrigin',new THREE.InstancedBufferAttribute(new Float32Array(origins),3));geometry.setAttribute('leafSeed',new THREE.InstancedBufferAttribute(new Float32Array(seeds),1));geometry.instanceCount=count;
 const time={value:0},wind={value:0};const material=card.material.clone();material.transparent=true;material.depthWrite=false;material.alphaTest=.35;material.side=THREE.DoubleSide;
 material.onBeforeCompile=shader=>{shader.uniforms.leafTime=time;shader.uniforms.leafWind=wind;shader.vertexShader='attribute vec3 leafOrigin;attribute float leafSeed;uniform float leafTime,leafWind;varying float leafFade;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 float duration=18.+leafSeed*14.;float age=fract(leafTime/duration+leafSeed);float phase=leafTime*(1.2+leafSeed)+leafSeed*25.;
 float yaw=phase*.7,pitch=sin(phase)*1.1;vec3 card=transformed*${UNITS.toFixed(6)}*2.5*(.85+leafSeed*.6);
 card.yz=mat2(cos(pitch),-sin(pitch),sin(pitch),cos(pitch))*card.yz;card.xz=mat2(cos(yaw),-sin(yaw),sin(yaw),cos(yaw))*card.xz;
 vec3 origin=leafOrigin;origin.y=mix(leafOrigin.y,.015*${UNITS.toFixed(6)},age);
 origin.x+=sin(phase)*${(UNITS*.25).toFixed(6)}*sin(age*3.14159)+age*leafWind*${(UNITS*.45).toFixed(6)};
 origin.z+=cos(phase*.73)*${(UNITS*.2).toFixed(6)}*sin(age*3.14159);
 transformed=origin+card;leafFade=smoothstep(0.,.07,age)*(1.-smoothstep(.90,1.,age));
 `);shader.fragmentShader='varying float leafFade;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=leafFade;\n#include <alphatest_fragment>');};
 material.customProgramCacheKey=()=> 'oak-falling-leaf-v1';const mesh=new THREE.Mesh(geometry,material);mesh.name='falling-oak-leaves';mesh.userData.fallingLeaf=true;mesh.frustumCulled=false;mesh.visible=false;mesh.castShadow=false;mesh.receiveShadow=false;model.add(mesh);
 return {mesh,count,update(active){mesh.visible=active;time.value=performance.now()/1000;wind.value=Math.max(0,Math.min(1,globalThis.getWeatherSnapshot?.()?.amounts?.wind??0));}};
}
