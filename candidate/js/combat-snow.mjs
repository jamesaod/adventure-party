import {updateSnowKickup,clearSnowKickup} from './combat-snow-kickup.mjs';
import {createFootprintLayer,clearCorpseDepressions,clearSnowFootprints,setFootprintCells,meltFootprints} from './combat-snow-footprints.mjs';
import {createSnowDepositBatch} from './combat-snow-deposits.mjs?v=R238C300';
import {resetCorpseSnow,advanceCorpseSnow,adjustCorpseSnow,meltCorpseSnow,fillCorpseSnow} from './combat-corpse-snow.mjs';
import {combatPerformance as perf} from './combat-performance.mjs';
import {createHexSnow} from './combat-snow-state.mjs?v=R238C300';
import {createSnowCoatCoverage,createSnowDepositionClock,snowBrushAtlas,SNOW_BRUSHES,SNOW_BRUSH_SIZE} from './combat-snow-coats.mjs?v=R238C339';
import {snowExposureAt,snowShelterRevision} from './combat-snow-shelter.mjs';
import {snowFootprintRevision} from './combat-snow-footprints.mjs';
import {snowDepthMetres,SNOW_LAYER_METRES} from './combat-snow-depth.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
// Persistent particle deposition. Hex means still drive footprints/canopy state.
export function createSnowAccumulation(renderer){
 const target=new THREE.WebGLRenderTarget(1024,1024,{depthBuffer:false,stencilBuffer:false});
 const bounds=new THREE.Vector4(-2048,-2048,4096,4096),scene=new THREE.Scene(),camera=new THREE.Camera();
 const coats=createSnowCoatCoverage(),depositionClock=createSnowDepositionClock();let coatGroundReady=false;
 const atlas=new THREE.DataTexture(snowBrushAtlas(),SNOW_BRUSHES.length*SNOW_BRUSH_SIZE,SNOW_BRUSH_SIZE);atlas.minFilter=atlas.magFilter=THREE.NearestFilter;atlas.generateMipmaps=false;atlas.needsUpdate=true;
 const batch=createSnowDepositBatch(),texelSize=new THREE.Vector2(1/1024,1/1024);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(batch.positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,0);geometry.setAttribute('coat',new THREE.BufferAttribute(batch.coats,2).setUsage(THREE.DynamicDrawUsage));
 const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
 blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,
 uniforms:{bounds:{value:bounds},brushes:{value:atlas}},
 vertexShader:'uniform vec4 bounds;attribute vec2 coat;varying vec2 vCoat;void main(){vCoat=coat;gl_Position=vec4((position.xy-bounds.xy)/bounds.zw*2.-1.,0.,1.);gl_PointSize=position.z;}',
 fragmentShader:'uniform sampler2D brushes;varying vec2 vCoat;void main(){float dose=texture2D(brushes,vec2((vCoat.x+gl_PointCoord.x)/16.,1.-gl_PointCoord.y)).r;if(dose<=0.)discard;vec3 layer=vec3(1.-step(.5,vCoat.y),step(.5,vCoat.y)*(1.-step(1.5,vCoat.y)),step(1.5,vCoat.y));gl_FragColor=vec4(dose*layer,0.);}' });
 const coverageMesh=new THREE.Points(geometry,material);coverageMesh.frustumCulled=false;scene.add(coverageMesh);
 const flakesGeometry=new THREE.BufferGeometry(),flakePositions=new Float32Array(4352*3);flakesGeometry.setAttribute('position',new THREE.BufferAttribute(flakePositions,3).setUsage(THREE.DynamicDrawUsage));
 const flakesMaterial=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
 uniforms:{view:{value:new THREE.Matrix3()},anchor:{value:new THREE.Vector2()},zoom:{value:1},size:{value:new THREE.Vector2()}},
 vertexShader:`uniform mat3 view;uniform vec2 anchor,size;uniform float zoom;void main(){vec2 p=(view*vec3(position.xy,1.)).xy-vec2(0.,position.z);p=anchor+(p-anchor)*zoom;gl_Position=vec4(p.x/size.x*2.-1.,1.-p.y/size.y*2.,0.,1.);gl_PointSize=clamp(2.5*zoom,1.5,4.);}`,
 fragmentShader:`void main(){float a=1.-smoothstep(.15,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(.85,.9,1.,a*.8);}`});
 const flakes=new THREE.Points(flakesGeometry,flakesMaterial),flakeScene=new THREE.Scene();flakes.frustumCulled=false;flakeScene.add(flakes);
 const snowState=createHexSnow();setFootprintCells(snowState.hexes,(x,y)=>snowDepthMetres(coats.sampleDepthWorld(x,y))*snowExposureAt(x,y));
 const footprints=createFootprintLayer(renderer,bounds);
 const meltGeometry=new THREE.BufferGeometry(),meltMaterial=new THREE.ShaderMaterial({transparent:true,blending:THREE.CustomBlending,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,depthTest:false,depthWrite:false,side:THREE.DoubleSide,uniforms:{bounds:{value:bounds},amount:{value:1},coatColor:{value:new THREE.Vector3()}},vertexShader:'uniform vec4 bounds;void main(){gl_Position=vec4((position.xy-bounds.xy)/bounds.zw*2.-1.,0.,1.);}',fragmentShader:'uniform float amount;uniform vec3 coatColor;void main(){gl_FragColor=vec4(coatColor,amount);}'});
 const meltMesh=new THREE.Mesh(meltGeometry,meltMaterial),meltScene=new THREE.Scene();meltMesh.frustumCulled=false;meltScene.add(meltMesh);
 let hasCoverage=false,surfaceRevision=0;
 let fullFaces=null,heat=[],pendingMelt=[],landed=[];
 function melt(keys,amount){if(amount<=0)return;surfaceRevision++;coats.melt(keys,amount);meltFootprints(keys,amount);meltCorpseSnow(keys,amount);const vertices=[];for(const key of new Set(keys)){const cell=snowState.melt(key,amount);if(cell)for(const t of cell.triangles)for(const p of [t.a,t.b,t.c])vertices.push(p.x,p.y,0);}if(!vertices.length)return;perf.count('snowMeltPasses');meltGeometry.dispose();meltGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));meltMaterial.uniforms.amount.value=amount;const old=renderer.getRenderTarget();renderer.setRenderTarget(target);renderer.render(meltScene,camera);renderer.setRenderTarget(old);}

 function adjustDepth(inches){
  const delta=inches*.0254/SNOW_LAYER_METRES,field=coats.adjustDepth(delta),texture=new THREE.DataTexture(field.data,field.width,field.height);texture.needsUpdate=true;
  const g=new THREE.PlaneGeometry(2,2),m=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{map:{value:texture}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D map;varying vec2 v;void main(){gl_FragColor=texture2D(map,v);}'}),s=new THREE.Scene();s.add(new THREE.Mesh(g,m));
  const old=renderer.getRenderTarget();renderer.setRenderTarget(target);renderer.render(s,camera);renderer.setRenderTarget(old);g.dispose();m.dispose();texture.dispose();
  for(const cell of snowState.hexes.values()){const t=cell.triangles[0],x=(t.a.x+t.b.x+t.c.x)/3,y=(t.a.y+t.b.y+t.c.y)/3;cell.amount=Math.min(1,snowDepthMetres(coats.sampleDepthWorld(x,y))/SNOW_LAYER_METRES);}
  adjustCorpseSnow(snowState.hexes,delta);depositionClock.prime(coats.coverage.texels);hasCoverage=coats.progress>0;surfaceRevision++;
  if(delta>0)footprints.update(delta);else footprints.update(0);globalThis.requestCombatAnimationTick?.(()=>globalThis.draw?.());
 }
 function fill(){surfaceRevision++;
  coats.fill();depositionClock.prime(coats.coverage.texels);snowState.accumulate(1,1);fillCorpseSnow(snowState.hexes);clearSnowFootprints();footprints.update(0,true);
  const vertices=[];for(const cell of snowState.hexes.values())for(const t of cell.triangles)for(const p of [t.a,t.b,t.c])vertices.push(p.x,p.y,0);
  meltGeometry.dispose();meltGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));meltMaterial.uniforms.amount.value=1;meltMaterial.uniforms.coatColor.value.set(1,1,1);
  const old=renderer.getRenderTarget();renderer.setRenderTarget(target);if(vertices.length)renderer.render(meltScene,camera);renderer.setRenderTarget(old);meltMaterial.uniforms.coatColor.value.set(0,0,0);hasCoverage=vertices.length>0;
  globalThis.requestCombatAnimationTick?.(()=>globalThis.draw?.());
 }
 let accumulationClock=0,earnedSnow=0;
 let particles=[],faces=[],last=0,credit=0,revision=-1,identity=null,ready=false;
 function clear(){clearSnowKickup();surfaceRevision++;depositionClock.clear();clearSnowFootprints();footprints.update(0,true);resetCorpseSnow();hasCoverage=false;const old=renderer.getRenderTarget(),color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.setRenderTarget(old);renderer.setClearColor(color,alpha);particles=[];landed=[];batch.clear();coats.clear();credit=0;accumulationClock=0;earnedSnow=0;snowState.clear();if(fullFaces)snowState.update(fullFaces);ready=true;}
 return {get surfaceRevision(){return `${surfaceRevision}/${snowFootprintRevision()}/${snowShelterRevision()}`;},texture:target.texture,texelSize,footprintTexture:footprints.texture,hasTracksForHex:key=>footprints.hasHex(key),bounds,hexes:snowState.hexes,get hasCoverage(){return hasCoverage;},get coatCoverage(){return coats.coverage;},get hasDepth(){return coats.hasDepth;},
 scene(id,extent){if(id!==identity){identity=id;clearCorpseDepressions();resetCorpseSnow(true);fullFaces=null;coatGroundReady=false;pendingMelt=[];heat=[];if(extent)bounds.fromArray(extent);
  const width=Math.min(4096,Math.max(512,Math.ceil(bounds.z/256)*512)),height=Math.min(4096,Math.max(512,Math.ceil(bounds.w/256)*512));
  if(target.width!==width||target.height!==height)target.setSize(width,height);texelSize.set(1/width,1/height);footprints.resize(width,height);clear();}},
 setGround(source){if(fullFaces!==source){fullFaces=source;snowState.update(source);coats.configure(bounds.toArray(),target.width,target.height,snowState.hexes);setFootprintCells(snowState.hexes,(x,y)=>snowDepthMetres(coats.sampleDepthWorld(x,y))*snowExposureAt(x,y));coatGroundReady=true;}},
 setHeat(source){heat=source;},
 melt(cells,amount=1){pendingMelt.push({keys:cells.map(c=>`${c.x},${c.y}`),amount});},
 begin(){faces=[];if(!ready)clear();},
 collect(surfaces){for(const f of surfaces)if(f.snowEligible>0&&f.points.length>=3)faces.push(f);},
 end(view){const state=globalThis.adventurePartySnow||{},now=performance.now(),dt=Math.min(.25,Math.max(0,(now-last)/1000));last=now;
 if(revision!==state.revision){revision=state.revision;clear();globalThis.requestCombatAnimationTick?.(()=>globalThis.draw?.());}
 if(!fullFaces){snowState.update(faces);if(!coatGroundReady&&faces.length){coats.configure(bounds.toArray(),target.width,target.height,snowState.hexes);setFootprintCells(snowState.hexes,(x,y)=>snowDepthMetres(coats.sampleDepthWorld(x,y))*snowExposureAt(x,y));coatGroundReady=true;}}
 if(coatGroundReady&&state.depthAdjustments?.length){for(const inches of state.depthAdjustments)adjustDepth(inches);state.depthAdjustments=[];}
 if(state.fillRequested&&coatGroundReady){fill();state.fillRequested=false;}
 if(!state.paused){credit+=dt*(state.showFlakes===false?0:(state.intensity||0))*700;while(credit>=1&&faces.length&&particles.length<4096){credit--;const landing=snowState.spawn();if(!landing)break;particles.push({...landing,h:100+Math.random()*100,phase:Math.random()*6.28});}
 credit=Math.min(credit,100);
 particles=particles.filter(p=>{p.h-=dt*65;if(p.h>0)return true;landed.push({x:p.x,y:p.y,hex:p.hex});return false;});
 earnedSnow+=dt*(state.intensity||0)/60;

 }
 for(const request of pendingMelt)melt(request.keys,request.amount);pendingMelt=[];
 for(const source of heat)melt(source.keys,1-Math.exp(-source.rate*dt));
 accumulationClock+=dt;
 if(accumulationClock>=.25){
  accumulationClock%=.25;snowState.accumulate(1,earnedSnow);
  const texelArea=bounds.z*bounds.w/(target.width*target.height);
  batch.add(earnedSnow,snowState.area,texelArea);earnedSnow=0;
  const previousGroundProgress=coats.progress;
  const count=batch.take(random=>snowState.spawn(random),landed,Math.random,(point,random)=>coats.deposit(point,random));
  // Only deposited ground snow advances bodies. New corpses start bare;
  // melting has its own local path and never becomes artificial snowfall.
  const deposited=depositionClock.advance(previousGroundProgress,coats.progress,count);
  advanceCorpseSnow(snowState.hexes,deposited);footprints.update(deposited);
  if(count){surfaceRevision++;
   geometry.setDrawRange(0,count);geometry.attributes.position.needsUpdate=true;geometry.attributes.coat.needsUpdate=true;
   const old=renderer.getRenderTarget();renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(old);
   hasCoverage=true;perf.count('snowDepositPasses');perf.count('snowDepositedGrains',count);
  }
  perf.count('snowDepositBacklog',Math.floor(batch.pending));
  if(landed.length>4096)landed.splice(0,landed.length-4096);
  if(![...snowState.hexes.values()].some(cell=>cell.amount>0))hasCoverage=false;
 }


 footprints.update(0);
 const coverage=coats.coverage;perf.count('snowFirstCoveragePermille',Math.round(coverage.first*1000));perf.count('snowSecondCoveragePermille',Math.round(coverage.second*1000));perf.count('snowDepthCoveragePermille',Math.round(coverage.depth*1000));
 state.activeCount=particles.length;
 const [a,b,c,d,tx,ty]=view.matrix,u=flakesMaterial.uniforms;u.view.value.set(a,c,tx,b,d,ty,0,0,1);u.anchor.value.set(view.anchor.x,view.anchor.y);u.zoom.value=view.zoom;u.size.value.set(view.width,view.height);
 const visible=state.showFlakes===false?[]:particles,kicks=updateSnowKickup(dt);visible.forEach((p,i)=>{flakePositions[i*3]=p.x+Math.sin(p.h*.03+p.phase)*Math.min(6,p.h*.15);flakePositions[i*3+1]=p.y;flakePositions[i*3+2]=p.h;});kicks.forEach((p,i)=>{const n=(i+visible.length)*3;flakePositions[n]=p.x;flakePositions[n+1]=p.y;flakePositions[n+2]=p.h;});const count=visible.length+kicks.length;flakesGeometry.setDrawRange(0,count);flakesGeometry.attributes.position.needsUpdate=true;if(count)renderer.render(flakeScene,camera);if(kicks.length)globalThis.requestCombatAnimationTick?.(()=>globalThis.draw?.());
 },dispose(){atlas.dispose();footprints.dispose();meltGeometry.dispose();meltMaterial.dispose();target.dispose();geometry.dispose();material.dispose();flakesGeometry.dispose();flakesMaterial.dispose();}};
}
