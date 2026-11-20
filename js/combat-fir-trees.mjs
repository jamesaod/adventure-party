import {createBareBranchSnowState,installBareBranchSnow} from './bare-branch-snow.mjs';
import {createResourceOwner} from './combat-resource-owner.mjs';
import {treeCollision} from './tree-collision.mjs?v=continuous1';
import {combatPerformance as perf} from './combat-performance.mjs';
import {createTreeMotion,TREE_MOTION_GLSL} from './tree-motion.mjs?v=environment-architecture2';
import {BROADLEAF_FAMILIES,broadleafForVariant,broadleafAsset,broadleafNamedAssets,requestedTreeFamilies} from './broadleaf-family.mjs?v=sweet-birch1';
import {createTreeWoodMask} from './tree-wood-mask.mjs';
import {createOakFall} from './combat-oak-fall.mjs?v=environment-architecture2';
import {installFirDisplay} from './combat-fir-snow-display.mjs?v=R238C447';
import {createFallingLeaves} from './combat-falling-leaves.mjs?v=two-tree1';
import {getSeason} from './combat-seasons.mjs';
import {treeScreenBounds} from './combat-tree-bounds.mjs';
import {createFirSnowCaps} from './combat-fir-snow.mjs?v=natural-ac1';
import {createTreeFireParticles} from './combat-tree-fire-particles.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {GLTFLoader} from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import {solarState,solarPalette,solarAmbient} from './solar-clock.mjs?v=R238C380';

// Render models only when their view or lighting changes. Combat retains its
// existing foot-sorted composition and frame scheduler.
export async function createCombatFirTrees({familyIds,includeFirs=true}={}){
  const loadedFamilies=requestedTreeFamilies(familyIds),resources=createResourceOwner();
  let disposed=false;
  const loader=new GLTFLoader(),woodMask=createTreeWoodMask(),treeMotion=createTreeMotion({publish:false});
  const models=includeFirs?await Promise.all(Array.from({length:5},(_,i)=>loader.loadAsync(
    new URL(`../assets/terrain/treeit-firs/models/fir-0${i+1}.gltf?v=R238C435`,import.meta.url).href
  ).then(asset=>asset.scene))):new Array(5);
  for(const family of loadedFamilies){const broadleafModels=await Promise.all(family.models.map(async id=>{const model=(await loader.loadAsync(broadleafAsset(id+'.gltf',family))).scene;model.userData.broadleaf=true;model.userData.species=family.species;return model;}));broadleafModels.forEach((model,i)=>models[family.base+i]=model);}
  for(const model of models.filter(Boolean))resources.track(model);
  const resolveVariant=variant=>{const family=broadleafForVariant(variant);return family&&variant===family.base?family.base+({fall:1,winter:2}[getSeason()]??0):variant;};
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
  const snowCoverage={value:0},bareBranchSnow={value:0},bareSnowState=createBareBranchSnowState();
  const fill={value:1},foliageReflectivity={value:0};
  const localLights=Array.from({length:4},()=>{const light=new THREE.PointLight(0xffffff,0,200,2);scene.add(light);return light;});
  let liveLighting=true;
  const sharedMaterials=new Map(),firDisplaySpace={value:false};
  for(const model of models.filter(Boolean)){
    const extra=[];
    model.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const original=mesh.material;
      if(sharedMaterials.has(original.name))mesh.material=sharedMaterials.get(original.name);
      else{
        sharedMaterials.set(original.name,original);
        if(original.alphaTest>0){
          // Matte needle albedo: noon calibrated against the accepted 08:10 appearance.
          original.color.setRGB(.5,.5,.5);
          original.alphaTest=.10;original.alphaToCoverage=true;
          // Resolved MSAA targets are composited as premultiplied coverage.
          // Premultiply fractional needle alpha before resolving, avoiding bright fringes.
          original.premultipliedAlpha=true;
          original.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
          original.onBeforeCompile=shader=>{
            shader.uniforms.foliageFill=fill;shader.uniforms.snowCoverage=snowCoverage;
            shader.uniforms.foliageReflectivity=foliageReflectivity;
            // Apply the foliage ceiling after tone mapping, in display color.
            if(!model.userData.broadleaf)shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',
              '#include <colorspace_fragment>\ngl_FragColor.rgb=min(gl_FragColor.rgb,mix(vec3(0.36,0.72,0.24),vec3(1.0),snowMask));');
            shader.vertexShader='varying vec3 vSnowNormal; attribute float canopyExposure; varying float vCanopyExposure;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCanopyExposure=canopyExposure;vSnowNormal=normalize(mat3(modelMatrix)*normal);');
            shader.fragmentShader='uniform float snowCoverage; varying vec3 vSnowNormal; uniform float foliageReflectivity; uniform float foliageFill; varying float vCanopyExposure;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat snowMask=smoothstep(0.0,0.15,snowCoverage)*smoothstep(1.0-snowCoverage,1.18-snowCoverage,abs(normalize(vSnowNormal).y)*0.65+vCanopyExposure*0.35); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.82,0.88,0.94),snowMask);');
            shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',
              THREE.ShaderChunk.lights_fragment_begin
                // Use full cached self-shadow strength on direct sunlight.
                // Foliage-only local diffuse response; sunlight and bark keep their lighting.
                .replace('getPointLightInfo( pointLight, geometryPosition, directLight );',
                  'getPointLightInfo( pointLight, geometryPosition, directLight ); directLight.color *= 0.5;'));
            // Ambient canopy fill is independent of direct-sun visibility; no extra shadow lookup.
            shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',
              '#include <lights_fragment_end>\nreflectedLight.directSpecular *= foliageReflectivity; reflectedLight.indirectSpecular *= foliageReflectivity; reflectedLight.indirectDiffuse *= mix(0.16,0.55,vCanopyExposure); reflectedLight.indirectDiffuse += diffuseColor.rgb * mix(0.025,0.08,vCanopyExposure) * foliageFill;');
          };
          original.customProgramCacheKey=()=> model.userData.broadleaf?'combat-oak-foliage-v1':'combat-fir-foliage-canopy-shading-v2';
        }else{
          installBareBranchSnow(original,bareBranchSnow);
          // Darken bark albedo once per shared material; direct light still shades it.
          original.color.multiplyScalar(model.userData.species==='american-beech'&&original.map? .30 : .45);
        }
      }
      if(!mesh.material.userData.firDisplayInstalled){installFirDisplay(mesh.material,firDisplaySpace);mesh.material.userData.firDisplayInstalled=true;}
      mesh.castShadow=true;mesh.receiveShadow=true;
      if(mesh.material.alphaTest>0){
        addCanopyExposure(mesh.geometry);
        mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
        mesh.customDepthMaterial.onBeforeCompile=shader=>{
          shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','').replace('#include <alphahash_fragment>','');
        };
        mesh.customDepthMaterial.customProgramCacheKey=()=> 'combat-fir-filled-shadow';
      }
    });
    model.scale.setScalar(.18);model.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(model);model.position.y=model.userData.broadleaf?0:-box.min.y;
    // Preserve authored root burial even in the foot-sorted tree pass, where the
    // floor is already composited. No CPU geometry work during camera movement.
    if(model.userData.broadleaf)model.traverse(mesh=>{if(!mesh.isMesh)return;for(const material of [mesh.material,mesh.customDepthMaterial].filter(Boolean)){
      if(material.userData.oakGroundClipInstalled)continue;material.userData.oakGroundClipInstalled=true;
      const before=material.onBeforeCompile,cacheKey=material.customProgramCacheKey.bind(material);
      material.onBeforeCompile=shader=>{before.call(material,shader);shader.vertexShader='varying float oakWorldHeight;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','oakWorldHeight=(modelMatrix*vec4(transformed,1.0)).y;\n#include <project_vertex>');
        shader.fragmentShader='varying float oakWorldHeight;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(oakWorldHeight<0.0)discard;');};
      material.customProgramCacheKey=()=>cacheKey()+'-oak-ground-clip-v1';
    }});
  }
  // One reusable GPU particle pool; emitters sample the actual tree meshes.
  const particleCount=192,anchors=models.map(model=>{
    model.updateMatrixWorld(true);const samples=[];
    model.traverse(mesh=>{if(!mesh.isMesh)return;const pos=mesh.geometry.attributes.position;
      for(let i=0;i<pos.count;i+=Math.max(1,Math.floor(pos.count/256))){const point=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);if(point.y>8)samples.push(point);}
    });return samples;
  });
  const fireParticlesGpu=createTreeFireParticles(particleCount),flames=fireParticlesGpu.mesh;
  // Immutable bounds are prepared once, not by projecting every vertex per sun update.
  const treeBounds=models.map(model=>{
    const healthy=new THREE.Box3(),bare=new THREE.Box3();model.updateMatrixWorld(true);
    model.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);healthy.union(box);if(mesh.material.alphaTest<=0)bare.union(box);});
    return {healthy,bare};
  });
  const familyFalls=new Map();for(const family of loadedFamilies){familyFalls.set(family.base,await createOakFall(broadleafNamedAssets(family,models),family,renderer));}
  const snowCaps=models.map(createFirSnowCaps);
  const familyLeaves=new Map();for(const family of loadedFamilies)familyLeaves.set(family.base,await createFallingLeaves(models[family.base+1],family));
  // Install after splitting wood and creating snow shells. Shared material uniforms
  // are updated per draw; fallen pieces disable motion, including their shadows.
  for(const model of models.filter(Boolean))model.traverse(mesh=>{if(!mesh.isMesh||mesh.userData.fallingLeaf)return;treeMotion.install(mesh.material);if(!mesh.customDepthMaterial)mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:mesh.material.side});treeMotion.install(mesh.customDepthMaterial);});
  const motionBounds=treeBounds.map(b=>({healthy:b.healthy.clone().expandByScalar(22),bare:b.bare.clone().expandByScalar(22)}));
  const projectedBounds=new Map();
  const shadowTarget=new THREE.WebGLRenderTarget(16,16,{depthBuffer:false,stencilBuffer:false});
  const blurMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,transparent:false,
    uniforms:{source:{value:null},step:{value:new THREE.Vector2()}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D source;uniform vec2 step;varying vec2 vUv;
      void main(){float a=texture2D(source,vUv).a*.25;
        a+=(texture2D(source,vUv+vec2(step.x,0.)).a+texture2D(source,vUv-vec2(step.x,0.)).a+texture2D(source,vUv+vec2(0.,step.y)).a+texture2D(source,vUv-vec2(0.,step.y)).a)*.125;
        a+=(texture2D(source,vUv+step).a+texture2D(source,vUv-step).a+texture2D(source,vUv+vec2(step.x,-step.y)).a+texture2D(source,vUv+vec2(-step.x,step.y)).a)*.0625;
        gl_FragColor=vec4(0.,0.,0.,a);}`
  });
  const blurScene=new THREE.Scene(),blurCamera=new THREE.Camera();blurScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),blurMaterial));
  const shadowCache=new Map();let shadowState='';
  const shadowDirection={value:new THREE.Vector3()};
  const shadowMaterial=new THREE.ShaderMaterial({
    uniforms:{sunDirection:shadowDirection,...treeMotion.uniforms},side:THREE.DoubleSide,depthTest:false,depthWrite:false,
    vertexShader:TREE_MOTION_GLSL+`uniform vec3 sunDirection;
      void main(){vec4 p=modelMatrix*vec4(treeDeform(position),1.0);
        p.xz-=max(0.0,p.y)*sunDirection.xz/max(.08,sunDirection.y);p.y=0.0;
        gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:'void main(){gl_FragColor=vec4(0.0,0.0,0.0,1.0);}'
  });
  const directGroundCache=new Map(),directSelfCache=new Map(),silhouetteCache=new Map();let directSunKey='';
  const shadowTemplate=sun.shadow;
  function clearDirectShadows(base=null){
    if(Number.isFinite(base)){const family=broadleafForVariant(base),low=family?.base??base,high=family?low+5:low;const matches=key=>{const variant=Number(String(key).split(':')[0].replace('fallen-',''));return variant>=low&&variant<=high;};
      for(const [key,entry]of directGroundCache)if(matches(key))entry.poseStamp=Symbol('tree changed');
      for(const [key,entry]of directSelfCache)if(matches(key)){entry.needsUpdate=true;entry.oakSettled=false;}return;
    }
    for(const entry of directGroundCache.values()){entry.target.dispose();}directGroundCache.clear();
    for(const entry of directSelfCache.values()){entry.map?.dispose();entry.mapPass?.dispose();}directSelfCache.clear();
  }
  function directGround(model,variant,rotation,burnt,light,solar,host,fallBox=null,poseStamp=null){
    const key=[variant,rotation,burnt].join(':');const cached=directGroundCache.get(key);if(cached&&cached.poseStamp===poseStamp)return cached;
    const box=fallBox||motionBounds[variant][burnt?'bare':'healthy'],yaw=new THREE.Matrix4().makeRotationY(model.rotation.y),points=[];
    model.updateMatrixWorld(true);
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const p=new THREE.Vector3(x,y,z).applyMatrix4(yaw);p.x-=Math.max(0,p.y)*light.x/Math.max(.08,light.y);p.z-=Math.max(0,p.y)*light.z/Math.max(.08,light.y);p.y=0;points.push(p.applyMatrix4(camera.matrixWorldInverse));
    }
    const bounds=new THREE.Box3().setFromPoints(points);bounds.expandByScalar(4);
    camera.left=bounds.min.x;camera.right=bounds.max.x;camera.bottom=bounds.min.y;camera.top=bounds.max.y;camera.updateProjectionMatrix();
    const width=Math.min(1536,Math.max(16,Math.ceil((bounds.max.x-bounds.min.x)*512/210))),height=Math.min(1536,Math.max(16,Math.ceil((bounds.max.y-bounds.min.y)*512/210)));
    const target=cached?.target||new THREE.WebGLRenderTarget(width,height,{depthBuffer:false,stencilBuffer:false}),originals=[];
    target.setSize(width,height);
    model.traverse(mesh=>{if(mesh.isMesh){originals.push([mesh,mesh.material,mesh.castShadow,mesh.visible]);if(mesh.userData.debrisPatch)mesh.visible=false;mesh.material=shadowMaterial;mesh.castShadow=false;}});
    try{host.treeScene(gpu=>{
      gpu.shadowMap.enabled=false;
      shadowTarget.setSize(width,height);shadowDirection.value.copy(light);gpu.setRenderTarget(shadowTarget);gpu.setClearColor(0,0);gpu.clear();gpu.render(scene,camera);
      blurMaterial.uniforms.source.value=shadowTarget.texture;blurMaterial.uniforms.step.value.set(2/width,2/height);
      gpu.setRenderTarget(target);gpu.clear();gpu.render(blurScene,blurCamera);
    });}finally{for(const [mesh,material,castShadow,visible]of originals){mesh.material=material;mesh.castShadow=castShadow;mesh.visible=visible;}}
    const result={poseStamp,target,texture:target.texture,left:bounds.min.x,top:-bounds.max.y,width:bounds.max.x-bounds.min.x,height:bounds.max.y-bounds.min.y,opacity:.32*solar.daylight};directGroundCache.set(key,result);return result;
  }
  const cache=new Map();let fallWarmups=new WeakMap();let stateKey='',lost=false;
  const onContextLost=event=>{event.preventDefault();lost=true;fallWarmups=new WeakMap();clearDirectShadows();cache.clear();shadowCache.clear();};renderer.domElement.addEventListener('webglcontextlost',onContextLost);
  const onContextRestored=()=>{lost=false;clearDirectShadows();cache.clear();shadowCache.clear();window.dispatchEvent(new Event('adventure-party:solar-change'));};renderer.domElement.addEventListener('webglcontextrestored',onContextRestored);
  function get(variant,rotation,{solar=solarState(12),ambient=100,viewRotation=0,instanceKey="",snowAmount=0,snowGroundLight=null,burnt=false,burning=false,fireParticles=192,firePhaseValue=0,direct=null,fallState=null,motionSource=null,motionTime=undefined,lights=[]}={}){
    variant=resolveVariant(variant);
    const family=broadleafForVariant(variant),localVariant=family?5+variant-family.base:variant,oakFall=familyFalls.get(family?.base),fallingLeaves=familyLeaves.get(family?.base);
    const motionStamp=treeMotion.update({time:motionTime,source:motionSource,height:treeBounds[variant].healthy.max.y/.18,yaw:(rotation+viewRotation*2)*Math.PI/6,enabled:!!direct&&!fallState&&!!family&&localVariant<=7});
    if(lost||disposed)return null;
    const falling=!!(fallState&&family&&variant<=family.base+2&&direct),phase=falling?oakFall.update(fallState,localVariant,fallState.renderNow??performance.now(),!!direct.ground,(.78+.22*solar.daylight)*Math.pow(Math.max(0,ambient/100*solar.sky),1/2.2)):null;
    if(falling&&Number.isFinite(fallState.fallYaw))rotation=(fallState.fallYaw-viewRotation*Math.PI/3)/(Math.PI/6);
    const bare=(!!family&&localVariant===7)||burnt;
    const branchAmount=bareSnowState.update(instanceKey+':'+(family?.base??variant),bare&&!burning&&!falling,globalThis.adventurePartySnow?.branchClock);
    bareBranchSnow.value=direct?.ground?0:branchAmount;
    const capAmount=burning||burnt?0:Math.floor(Math.max(0,Math.min(1,snowAmount))*400)/400;
    firDisplaySpace.value=capAmount>0;
    snowCoverage.value=0; // Keep green foliage; snow is separate geometry.
    const nextKey=[solar.lightingKey??solar.hour,ambient,viewRotation].join(':');
    if(nextKey!==stateKey){cache.clear();stateKey=nextKey;}
    const key=variant+':'+rotation+':'+instanceKey+':'+burnt;
    const cached=cache.get(key),active=liveLighting?lights.slice(0,4):[],lightKey=branchAmount+':'+capAmount+':'+JSON.stringify([active,snowGroundLight])+(burning?":"+Math.floor(performance.now()/33):"");
    if(!direct&&cached?.lightKey===lightKey)return cached;
    const angle=viewRotation*Math.PI/3,c=Math.cos(angle),s=Math.sin(angle),direction=solar.direction;
    const light=new THREE.Vector3(c*direction.x-s*direction.z,direction.y,s*direction.x+c*direction.z);
    sun.position.copy(light).multiplyScalar(380);
    sun.intensity=solar.altitude>0?2.3*solar.daylight:0;
    const palette=solarPalette(solar);sun.color.setRGB(...palette.sun);
    const skyProfile=solarAmbient({sky:0xe0edff,ground:0x657450,intensity:1},solar);
    hemisphere.color.setHex(skyProfile.sky);hemisphere.groundColor.setHex(skyProfile.ground);
    const ambientFactor=Math.max(0,ambient)/100*solar.sky;
    hemisphere.intensity=1.5*ambientFactor;
    fill.value=ambientFactor;foliageReflectivity.value=0; // Matte foliage: retain diffuse illumination and canopy occlusion.
    for(let i=0;i<localLights.length;i++){
      const target=localLights[i],source=active[i];target.intensity=0;if(!source)continue;
      target.position.set(source.x,source.height,source.z);target.color.setRGB(...source.color);
      target.distance=source.radius;target.decay=source.decay??2;target.intensity=source.intensity;
    }
    for(const material of sharedMaterials.values()){
      material.userData.healthyColor??=material.color.clone();
      if(burning&&material.alphaTest>0)material.color.setRGB(0,0,0);
      else if(burnt&&material.alphaTest<=0)material.color.setRGB(.012,.010,.008);
      else material.color.copy(material.userData.healthyColor);
    }
    snowCaps[variant].light(light,solar.daylight,snowGroundLight||[1,1,1].map(()=>Math.max(.01**(1/2.2),Math.pow(Math.max(0,ambient/100*solar.sky),1/2.2))));
    snowCaps[variant].set(direct?.ground?0:capAmount);
    fallingLeaves?.update(!falling&&localVariant===6&&!!direct&&!direct.ground&&!burnt&&!burning&&!matchMedia('(prefers-reduced-motion: reduce)').matches);
    const particlePass=falling&&direct.particlesOnly;
    if(particlePass)oakFall.setLeafRange((direct.low-direct.center.y)/direct.scale,(direct.high-direct.center.y)/direct.scale);
    const model=falling?(particlePass?oakFall.particleGroup:oakFall.group):models[variant];model.traverse(mesh=>{if(!falling&&mesh.isMesh&&!mesh.userData.fallingLeaf&&mesh.material.alphaTest>0)mesh.visible=!burnt;});model.rotation.y=rotation*Math.PI/6;scene.add(model);
    if(direct){
      const nextSunKey=[solar.lightingKey??solar.hour,viewRotation].join(':');if(nextSunKey!==directSunKey){for(const entry of directGroundCache.values())entry.target.dispose();directGroundCache.clear();for(const entry of directSelfCache.values())entry.needsUpdate=true;directSunKey=nextSunKey;}
      if(direct.ground){let shadow=null;try{if(solar.altitude>0)shadow=directGround(model,falling?"fallen-"+variant:variant,rotation,burnt,light,solar,direct.host,falling?oakFall.bounds:null,falling?Math.min(6,phase.t):motionStamp);}finally{scene.remove(model);}return {shadow,direct:true};}
    }
    if(!direct)renderer.setSize(384,512,false);
    camera.left=-78.75;camera.right=78.75;camera.top=183.75;camera.bottom=-26.25;camera.updateProjectionMatrix();
    if(burning&&!burnt){
      fireParticlesGpu.update({samples:anchors[variant],yaw:model.rotation.y,phase:firePhaseValue,time:performance.now()/1000,count:fireParticles});scene.add(flames);
    }
    if(direct){
      const turning=Math.abs(viewRotation-Math.round(viewRotation))>1e-8;
      const key=[variant,turning?'turning':rotation,burnt,falling].join(':');let self=directSelfCache.get(key);
      if(!self){self=shadowTemplate.clone();self.autoUpdate=false;self.needsUpdate=true;directSelfCache.set(key,self);}sun.shadow=self;if(self.treeMotionStamp!==motionStamp){self.needsUpdate=true;self.treeMotionStamp=motionStamp;}if(turning)self.needsUpdate=true;if(falling){if(!phase.settled||!self.oakSettled)self.needsUpdate=true;self.oakSettled=phase.settled;}
      const boundsKey=[variant,rotation,burnt,burning,falling].join(':');
      let extent=turning?null:projectedBounds.get(boundsKey);
      if(!extent){extent=treeScreenBounds(falling?oakFall.bounds:motionBounds[variant][burnt?'bare':'healthy'],camera.matrixWorldInverse,rotation*Math.PI/6,burning&&!burnt);if(!turning)projectedBounds.set(boundsKey,extent);}
      const leafPad=localVariant===6?8*direct.scale:0;
      const bounds={x:direct.center.x+extent.x*direct.scale-leafPad,y:direct.center.y+extent.y*direct.scale-leafPad,width:extent.width*direct.scale+leafPad*2,height:extent.height*direct.scale+leafPad*2};
      try{direct.host.treeScene((gpu,view)=>{
        const scale=direct.scale*view.zoom,cx=view.anchor.x+(direct.center.x-view.anchor.x)*view.zoom,cy=view.anchor.y+(direct.center.y-view.anchor.y)*view.zoom;
        camera.left=((view.crop?.x||0)-cx)/scale;camera.right=camera.left+(view.crop?.width||view.width)/scale;camera.top=(cy-(view.crop?.y||0))/scale;camera.bottom=camera.top-(view.crop?.height||view.height)/scale;camera.updateProjectionMatrix();
        // Start compiling hidden landing meshes and their wood masks during the fall,
        // before their first visible frame at impact. compileAsync visits hidden meshes.
        if(falling&&!particlePass){let warmed=fallWarmups.get(gpu);if(!warmed){warmed=new Set();fallWarmups.set(gpu,warmed);}const warmKey=variant+':'+(fallState.breakType||'torn');if(!warmed.has(warmKey)){warmed.add(warmKey);Promise.all([gpu.compileAsync(scene,camera)]).catch(error=>{warmed.delete(warmKey);console.warn('Tree landing shader preparation failed',error);});}}
        const casts=sun.castShadow;if(particlePass)sun.castShadow=false;try{gpu.render(scene,camera);}finally{sun.castShadow=casts;}
      },{particles:particlePass,bounds,woodMask:null,firOutline:false,outlineFade:model.userData.broadleaf&&getSeason()==='fall'?THREE.MathUtils.smoothstep(solar.daylight,0,.65):1,outlineColor:model.userData.broadleaf&&getSeason()==='fall'?family?.outline:null,displaySpace:firDisplaySpace.value,snowOutline:Math.min(1,capAmount*2)*Math.min(1,Math.max(...(snowGroundLight||[Math.pow(Math.max(0,ambient/100*solar.sky),1/2.2)])))});}finally{sun.shadow=shadowTemplate;scene.remove(flames);scene.remove(model);}
      return {direct:true};
    }
    renderer.render(scene,camera);scene.remove(flames);
    const body=document.createElement('canvas');body.width=384;body.height=512;
    body.getContext('2d').drawImage(renderer.domElement,0,0);
    const nextShadowState=[solar.lightingKey??solar.hour,viewRotation].join(':');if(nextShadowState!==shadowState){shadowCache.clear();shadowState=nextShadowState;}
    const shadowKey=[variant,rotation,burnt].join(':');
    let shadow=shadowCache.get(shadowKey)||null;
    if(solar.altitude>0&&!shadow){
      model.updateMatrixWorld(true);
      const projected=[],box=treeBounds[variant][burnt?'bare':'healthy'],yaw=new THREE.Matrix4().makeRotationY(model.rotation.y);
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
        const point=new THREE.Vector3(x,y,z).applyMatrix4(yaw);
        point.x-=Math.max(0,point.y)*light.x/Math.max(.08,light.y);
        point.z-=Math.max(0,point.y)*light.z/Math.max(.08,light.y);point.y=0;
        projected.push(point.applyMatrix4(camera.matrixWorldInverse));
      }
      const bounds=new THREE.Box3().setFromPoints(projected);
      bounds.min.x-=4;bounds.max.x+=4;bounds.min.y-=4;bounds.max.y+=4;
      camera.left=bounds.min.x;camera.right=bounds.max.x;camera.bottom=bounds.min.y;camera.top=bounds.max.y;camera.updateProjectionMatrix();
      const width=Math.min(1536,Math.max(16,Math.ceil((bounds.max.x-bounds.min.x)*512/210)));
      const height=Math.min(1536,Math.max(16,Math.ceil((bounds.max.y-bounds.min.y)*512/210)));
      renderer.setSize(width,height,false);shadowDirection.value.copy(light);
      const originals=[];
      model.traverse(mesh=>{if(mesh.isMesh){originals.push([mesh,mesh.material,mesh.castShadow,mesh.visible]);if(mesh.userData.debrisPatch)mesh.visible=false;mesh.material=shadowMaterial;mesh.castShadow=false;}});
      shadowTarget.setSize(width,height);
      renderer.setRenderTarget(shadowTarget);renderer.clear();renderer.render(scene,camera);
      blurMaterial.uniforms.source.value=shadowTarget.texture;blurMaterial.uniforms.step.value.set(2/width,2/height);
      renderer.setRenderTarget(null);renderer.clear();renderer.render(blurScene,blurCamera);
      const image=document.createElement('canvas');image.width=width;image.height=height;
      const context=image.getContext('2d');context.drawImage(renderer.domElement,0,0);
      shadow={image,left:bounds.min.x,top:-bounds.max.y,width:bounds.max.x-bounds.min.x,height:bounds.max.y-bounds.min.y,opacity:.32*solar.daylight};
      shadowCache.set(shadowKey,shadow);
      for(const [mesh,material,castShadow,visible]of originals){mesh.material=material;mesh.castShadow=castShadow;mesh.visible=visible;}
    }
    scene.remove(model);
    const result={body,shadow,lightKey};cache.set(key,result);return result;
  }
  function silhouette(variant,rotation,burnt){
    variant=resolveVariant(variant);
    const key=[variant,rotation,burnt].join(':');if(silhouetteCache.has(key))return silhouetteCache.get(key);
    const body=get(variant,rotation,{solar:solarState(0),ambient:0,burnt}).body;silhouetteCache.set(key,body);return body;
  }
  function collectResources(){for(const model of models.filter(Boolean))resources.track(model);for(const f of familyFalls.values()){resources.track(f.group);resources.track(f.particleGroup);for(const r of f.resources)resources.own(r);}for(const f of familyLeaves.values())resources.track(f.mesh);resources.track(blurScene);resources.own(shadowMaterial);resources.own(shadowTarget);}
  function dispose(){if(disposed)return;disposed=true;for(const caps of snowCaps.filter(Boolean))caps.dispose();collectResources();clearDirectShadows();woodMask.dispose();fireParticlesGpu.dispose();resources.dispose();sun.shadow.dispose();renderer.domElement.removeEventListener('webglcontextlost',onContextLost);renderer.domElement.removeEventListener('webglcontextrestored',onContextRestored);renderer.dispose();treeMotion.reset();if(globalThis.adventurePartyTreeMotion===treeMotion)delete globalThis.adventurePartyTreeMotion;for(const c of [cache,shadowCache,silhouetteCache,projectedBounds])c.clear();}
  return {cloneFallenLog(base,state){const f=broadleafForVariant(base);return familyFalls.get(f.base).cloneLog(state,5+resolveVariant(base)-f.base);},activate(){if(disposed)throw Error('Tree assets disposed');globalThis.adventurePartyTreeMotion=treeMotion;},dispose,get disposed(){return disposed;},prepareFallState(base,state){const f=broadleafForVariant(base);return familyFalls.get(f.base).prepareState(state,5+resolveVariant(base)-f.base);},loadedFamilyIds:loadedFamilies.map(f=>Object.keys(BROADLEAF_FAMILIES).find(id=>BROADLEAF_FAMILIES[id]===f)),motionDiagnostics:()=>treeMotion.diagnostics(),bareSnowDiagnostics:()=>({tracked:bareSnowState.size,amount:bareBranchSnow.value}),debrisFootprints(delta,base=5){const family=broadleafForVariant(base);return treeCollision(base,getSeason(),delta).capsules;},fallingBranchCount:8,fallingLeafCount:[...familyLeaves.values()].reduce((n,f)=>n+f.count,0),seasonalVariant:(base=5)=>resolveVariant(base),canopyRadius(variant){const b=treeBounds[resolveVariant(variant)]?.healthy;return b?Math.max(b.max.x-b.min.x,b.max.z-b.min.z)/2:0;},get:(...args)=>perf.measure('treePipeline',()=>get(...args)),silhouette,clearDirectShadows,setLiveLighting(value){liveLighting=!!value;cache.clear();},get liveLighting(){return liveLighting;}};
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


