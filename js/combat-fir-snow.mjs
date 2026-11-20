import * as THREE from '../assets/vendor/three/three.module.min.js';
import {createCorpseSnowMap} from './combat-corpse-snow-map.mjs?v=natural-ac1';
import {SNOW_MAX_METRES} from './combat-snow-depth.mjs?v=shore-snow1';

// Match terrain: thin coat is translucent; the completed powder coat is opaque.
export function firSnowOpacity(progress){const p=Math.max(0,Number(progress)||0),thin=.62*Math.min(1,p),powder=Math.min(1,Math.max(0,p-1));return thin+(1.-thin)*powder;}

// SpeedTree export normalization, before the existing runtime 0.18 scale.
const MODEL_UNITS_PER_METRE=724.35152/16.69423121213913;
// A single midpoint split supplies displacement vertices without changing the tree.
export function branchSnowGeometry(source,{minimumHeight=-Infinity,transform=null}={}){
 const positions=[],uvs=[],normals=[],p=source.attributes.position,u=source.attributes.uv,idx=source.index;
 if(!u)return new THREE.BufferGeometry();
 const vertex=i=>({p:new THREE.Vector3().fromBufferAttribute(p,i),u:new THREE.Vector2().fromBufferAttribute(u,i)});
 const mid=(a,b)=>({p:a.p.clone().add(b.p).multiplyScalar(.5),u:a.u.clone().add(b.u).multiplyScalar(.5)});
 const count=idx?idx.count:p.count;
 for(let i=0;i<count;i+=3){
  const [a,b,c]=[0,1,2].map(k=>vertex(idx?idx.getX(i+k):i+k));
  if([a,b,c].some(v=>(transform?v.p.clone().applyMatrix4(transform).y:v.p.y)<minimumHeight))continue;
  const normal=b.p.clone().sub(a.p).cross(c.p.clone().sub(a.p)).normalize();
  if(Math.abs(normal.y)<.15)continue; // Near-vertical cards cannot hold a shelf.
  if(normal.y<0)normal.negate();
  const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
  for(const face of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])for(const v of face){positions.push(...v.p);uvs.push(...v.u);normals.push(...normal);}
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 return geometry;
}

export function createFirSnowCaps(model){
 const started=performance.now(),foliage=[];
 model.traverse(o=>{if(o.isMesh&&!o.userData.debrisPatch&&o.material.alphaTest>0)foliage.push(o);});
 const mesh=new THREE.Group();mesh.name='fir-branch-surface-snow';mesh.visible=false;model.add(mesh);
 const records=[],opacityLimit={value:0},groundLight={value:new THREE.Vector3(1,1,1)},snowTint={value:new THREE.Vector3(.754,.775,.796)};let triangles=0,previous=-1;
 model.updateMatrixWorld(true);const inverse=model.matrixWorld.clone().invert();
 for(const leaf of foliage){
  const map=leaf.material.map;if(!map?.image)continue;
  const size=32,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');ctx.drawImage(map.image,0,0,size,size);
  const pixels=ctx.getImageData(0,0,size,size).data,top=new Float32Array(size*size).fill(-Infinity);
  for(let i=0;i<top.length;i++)if(pixels[i*4+3]>8)top[i]=0;
  const deposit=createCorpseSnowMap(top,size);
  // Data texture uses the same exported UV row convention as the glTF artwork.
  deposit.texture.flipY=map.flipY;
  const geometry=branchSnowGeometry(leaf.geometry,model.userData.broadleaf?{minimumHeight:MODEL_UNITS_PER_METRE*.5,transform:inverse.clone().multiply(leaf.matrixWorld)}:{});triangles+=geometry.attributes.position.count/3;
  const material=new THREE.MeshStandardMaterial({color:0xf4f8ff,map,roughness:1,metalness:0,side:THREE.DoubleSide,alphaTest:.08,alphaToCoverage:true,premultipliedAlpha:true});
  material.onBeforeCompile=shader=>{
   shader.uniforms.branchSnowMap={value:deposit.texture};shader.uniforms.branchSnowOpacity=opacityLimit;shader.uniforms.firGroundLight=groundLight;shader.uniforms.firSnowTint=snowTint;
   shader.vertexShader='uniform sampler2D branchSnowMap;varying vec2 branchSnowUv;varying float branchSnowSlope;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    branchSnowUv=uv;branchSnowSlope=smoothstep(.15,.7,abs(normal.y));
    vec4 coats=smoothstep(vec4(.015),vec4(.34),texture2D(branchSnowMap,uv));
    // Coverage coats stay thin. Only coats three/four raise the snow shell.
    float depth=(coats.b+coats.a)*.5;
    transformed.y+=(.0127+depth*${SNOW_MAX_METRES-.0127})*${MODEL_UNITS_PER_METRE}*branchSnowSlope;
   `);
   shader.fragmentShader='uniform vec3 firGroundLight,firSnowTint;uniform float branchSnowOpacity;uniform sampler2D branchSnowMap;varying vec2 branchSnowUv;varying float branchSnowSlope;\n'+shader.fragmentShader;
   // Preserve only the needle silhouette, never multiply white snow by green RGB.
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
    diffuseColor.a*=texture2D(map,vMapUv).a;
    #endif
    vec4 coats=smoothstep(vec4(.015),vec4(.34),texture2D(branchSnowMap,branchSnowUv));
    float thin=.62*coats.r;
    float coverage=thin+(1.-thin)*coats.g;
    float branchCoverage=min(coverage,branchSnowOpacity);
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\n diffuseColor.a*=sqrt(branchCoverage);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',THREE.ShaderChunk.lights_fragment_begin.replace('directionalLightShadow.shadowIntensity,','directionalLightShadow.shadowIntensity * .25,'));
  };
   const prior=material.onBeforeCompile;
   material.onBeforeCompile=shader=>{prior(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=clamp(firSnowTint*firGroundLight,0.,1.);\n#include <opaque_fragment>').replace('#include <tonemapping_fragment>','').replace('#include <colorspace_fragment>','');
   };
  material.customProgramCacheKey=()=> 'fir-branch-texture-snow-display-447';
  const shell=new THREE.Mesh(geometry,material);shell.matrix.copy(inverse.clone().multiply(leaf.matrixWorld));shell.matrixAutoUpdate=false;shell.frustumCulled=false;shell.receiveShadow=true;shell.castShadow=false;mesh.add(shell);
  records.push(deposit);
 }
 mesh.userData.snowPreparation={milliseconds:performance.now()-started,triangles,maps:records.length};
 return {mesh,light(direction,daylight,display){if(display)groundLight.value.fromArray(display);},set(value){
  const amount=Math.floor(Math.max(0,Math.min(1,Number(value)||0))*400)/400;
  const powder=Math.min(1,Math.max(0,amount*4-1));snowTint.value.set(.754+(.902-.754)*powder,.775+(.916-.775)*powder,.796+(.930-.796)*powder);opacityLimit.value=firSnowOpacity(amount*4);mesh.visible=amount>0;if(amount===previous||amount===0){previous=amount;return;}
  // Upload only on accumulated-depth changes, never camera movement.
  for(const map of records)map.update(amount*4);previous=amount;
 },dispose(){for(const map of records)map.dispose();mesh.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});mesh.removeFromParent();}};
}



