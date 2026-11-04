import * as THREE from '../assets/vendor/three/three.module.min.js';
import {GLTFLoader} from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import {solarState} from './solar-clock.mjs?v=R238C274';

// Render models only when their view or lighting changes. Combat retains its
// existing foot-sorted composition and frame scheduler.
export async function createCombatFirTrees(){
  const loader=new GLTFLoader();
  const models=await Promise.all(Array.from({length:5},(_,i)=>loader.loadAsync(
    new URL(`../assets/terrain/treeit-firs/models/fir-0${i+1}.gltf`,import.meta.url).href
  ).then(asset=>asset.scene)));
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.setClearColor(0,0);
  const scene=new THREE.Scene();
  const hemisphere=new THREE.HemisphereLight(0xe0edff,0x657450,1.5);
  const sun=new THREE.DirectionalLight(0xffedcc,2.3);
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.radius=4;
  sun.shadow.normalBias=.25;
  Object.assign(sun.shadow.camera,{left:-220,right:220,top:220,bottom:-220,near:1,far:850});
  scene.add(hemisphere,sun,sun.target);
  const camera=new THREE.OrthographicCamera(-78.75,78.75,183.75,-26.25,1,1800);
  camera.position.set(0,568,823);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const fill={value:1};
  const sharedMaterials=new Map();
  for(const model of models){
    const extra=[];
    model.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const original=mesh.material;
      if(sharedMaterials.has(original.name))mesh.material=sharedMaterials.get(original.name);
      else{
        sharedMaterials.set(original.name,original);
        if(original.alphaTest>0){
          original.color.setRGB(.72,1,.64);
          original.alphaTest=.12;original.alphaToCoverage=true;
          original.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
          original.onBeforeCompile=shader=>{
            shader.uniforms.foliageFill=fill;
            shader.vertexShader='attribute float canopyExposure; varying float vCanopyExposure;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCanopyExposure=canopyExposure;');
            shader.fragmentShader='uniform float foliageFill; varying float vCanopyExposure;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',
              THREE.ShaderChunk.lights_fragment_begin.replace('directionalLightShadow.shadowIntensity,','directionalLightShadow.shadowIntensity / 3.0,'));
            shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>','#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>');
            shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',
              '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += diffuseColor.rgb * mix(0.18,0.48,vCanopyExposure) * foliageFill * mix(1.0,getShadowMask(),1.0/3.0);');
          };
          original.customProgramCacheKey=()=> 'combat-fir-green-canopy-depth';
        }
      }
      mesh.castShadow=true;mesh.receiveShadow=true;
      if(mesh.material.alphaTest>0){
        addCanopyExposure(mesh.geometry);
        mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
        mesh.customDepthMaterial.onBeforeCompile=shader=>{
          shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','').replace('#include <alphahash_fragment>','');
        };
        mesh.customDepthMaterial.customProgramCacheKey=()=> 'combat-fir-filled-shadow';
        const duplicate=mesh.clone();duplicate.rotation.y+=.38;duplicate.scale.multiplyScalar(.97);extra.push(duplicate);
      }
    });
    for(const mesh of extra)model.add(mesh);
    model.scale.setScalar(.18);model.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(model);model.position.y=-box.min.y;
  }
  const shadowDirection={value:new THREE.Vector3()};
  const shadowMaterial=new THREE.ShaderMaterial({
    uniforms:{sunDirection:shadowDirection},side:THREE.DoubleSide,depthTest:false,depthWrite:false,
    vertexShader:`uniform vec3 sunDirection;
      void main(){vec4 p=modelMatrix*vec4(position,1.0);
        p.xz-=max(0.0,p.y)*sunDirection.xz/max(.08,sunDirection.y);p.y=0.0;
        gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:'void main(){gl_FragColor=vec4(0.0,0.0,0.0,1.0);}'
  });
  const cache=new Map();let stateKey='',lost=false;
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;cache.clear();});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{lost=false;cache.clear();window.dispatchEvent(new Event('adventure-party:solar-change'));});
  function get(variant,rotation,{solar=solarState(12),ambient=100,viewRotation=0}={}){
    if(lost)return null;
    const nextKey=[solar.hour,ambient,viewRotation].join(':');
    if(nextKey!==stateKey){cache.clear();stateKey=nextKey;}
    const key=variant+':'+rotation;
    if(cache.has(key))return cache.get(key);
    const angle=viewRotation*Math.PI/3,c=Math.cos(angle),s=Math.sin(angle),direction=solar.direction;
    const light=new THREE.Vector3(c*direction.x-s*direction.z,direction.y,s*direction.x+c*direction.z);
    sun.position.copy(light).multiplyScalar(380);
    sun.intensity=solar.altitude>0?2.3*solar.daylight:0;
    sun.color.setRGB(1,1-solar.warmth*.2,1-solar.warmth*.45);
    const ambientFactor=Math.max(0,ambient)/100*solar.sky;
    hemisphere.intensity=1.5*ambientFactor;
    fill.value=ambientFactor;
    const model=models[variant];model.rotation.y=rotation*Math.PI/6;scene.add(model);
    renderer.setSize(384,512,false);
    camera.left=-78.75;camera.right=78.75;camera.top=183.75;camera.bottom=-26.25;camera.updateProjectionMatrix();
    renderer.render(scene,camera);
    const body=document.createElement('canvas');body.width=384;body.height=512;
    body.getContext('2d').drawImage(renderer.domElement,0,0);
    let shadow=null;
    if(solar.altitude>0){
      model.updateMatrixWorld(true);
      const projected=[];
      model.traverse(mesh=>{
        if(!mesh.isMesh)return;
        const positions=mesh.geometry.attributes.position;
        const point=new THREE.Vector3();
        for(let i=0;i<positions.count;i++){
          point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
          point.x-=Math.max(0,point.y)*light.x/Math.max(.08,light.y);
          point.z-=Math.max(0,point.y)*light.z/Math.max(.08,light.y);point.y=0;
          point.applyMatrix4(camera.matrixWorldInverse);projected.push(point.clone());
        }
      });
      const bounds=new THREE.Box3().setFromPoints(projected);
      bounds.min.x-=4;bounds.max.x+=4;bounds.min.y-=4;bounds.max.y+=4;
      camera.left=bounds.min.x;camera.right=bounds.max.x;camera.bottom=bounds.min.y;camera.top=bounds.max.y;camera.updateProjectionMatrix();
      const width=Math.min(1536,Math.max(16,Math.ceil((bounds.max.x-bounds.min.x)*512/210)));
      const height=Math.min(1536,Math.max(16,Math.ceil((bounds.max.y-bounds.min.y)*512/210)));
      renderer.setSize(width,height,false);shadowDirection.value.copy(light);
      const originals=[];
      model.traverse(mesh=>{if(mesh.isMesh){originals.push([mesh,mesh.material,mesh.castShadow]);mesh.material=shadowMaterial;mesh.castShadow=false;}});
      renderer.render(scene,camera);
      const image=document.createElement('canvas');image.width=width;image.height=height;
      const context=image.getContext('2d');context.filter='blur(2px)';context.drawImage(renderer.domElement,0,0);
      shadow={image,left:bounds.min.x,top:-bounds.max.y,width:bounds.max.x-bounds.min.x,height:bounds.max.y-bounds.min.y,opacity:.32*solar.daylight};
      for(const [mesh,material,castShadow]of originals){mesh.material=material;mesh.castShadow=castShadow;}
    }
    scene.remove(model);
    const result={body,shadow};cache.set(key,result);return result;
  }
  return {get};
}

function addCanopyExposure(geometry){
  const positions=geometry.attributes.position;geometry.computeBoundingBox();
  const box=geometry.boundingBox,height=box.max.y-box.min.y,radii=Array(16).fill(0);
  const bandAt=y=>Math.min(15,Math.floor((y-box.min.y)/height*16));
  for(let i=0;i<positions.count;i++){const band=bandAt(positions.getY(i));radii[band]=Math.max(radii[band],Math.hypot(positions.getX(i),positions.getZ(i)));}
  const exposure=new Float32Array(positions.count);
  for(let i=0;i<positions.count;i++)exposure[i]=THREE.MathUtils.smoothstep(Math.hypot(positions.getX(i),positions.getZ(i))/Math.max(1,radii[bandAt(positions.getY(i))]),.15,.9);
  geometry.setAttribute('canopyExposure',new THREE.BufferAttribute(exposure,1));
}
