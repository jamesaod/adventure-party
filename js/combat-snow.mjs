import {createHexSnow} from './combat-snow-state.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
// Fixed-rate hex accumulation is independent of cosmetic falling flakes.
export function createSnowAccumulation(renderer){
 const target=new THREE.WebGLRenderTarget(1024,1024,{depthBuffer:false,stencilBuffer:false});
 const bounds=new THREE.Vector4(-2048,-2048,4096,4096),scene=new THREE.Scene(),camera=new THREE.Camera();
 const geometry=new THREE.BufferGeometry();
 const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,side:THREE.DoubleSide,
 uniforms:{bounds:{value:bounds}},vertexShader:`uniform vec4 bounds;attribute float coverage;varying float amount;varying vec2 world;void main(){world=position.xy;amount=coverage;gl_Position=vec4((position.xy-bounds.xy)/bounds.zw*2.-1.,0.,1.);}`,
 fragmentShader:`varying float amount;varying vec2 world;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 void main(){float n=.12+.76*(noise(world*.13)*.65+noise(world*.4)*.35);float snow=smoothstep(0.,.08,amount)*(1.-smoothstep(amount-.12,amount+.12,n));gl_FragColor=vec4(vec3(snow),1.);}`});
 const coverageMesh=new THREE.Mesh(geometry,material);coverageMesh.frustumCulled=false;scene.add(coverageMesh);
 const flakesGeometry=new THREE.BufferGeometry(),flakePositions=new Float32Array(4096*3);flakesGeometry.setAttribute('position',new THREE.BufferAttribute(flakePositions,3).setUsage(THREE.DynamicDrawUsage));
 const flakesMaterial=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
 uniforms:{view:{value:new THREE.Matrix3()},anchor:{value:new THREE.Vector2()},zoom:{value:1},size:{value:new THREE.Vector2()}},
 vertexShader:`uniform mat3 view;uniform vec2 anchor,size;uniform float zoom;void main(){vec2 p=(view*vec3(position.xy,1.)).xy-vec2(0.,position.z);p=anchor+(p-anchor)*zoom;gl_Position=vec4(p.x/size.x*2.-1.,1.-p.y/size.y*2.,0.,1.);gl_PointSize=clamp(2.5*zoom,1.5,4.);}`,
 fragmentShader:`void main(){float a=1.-smoothstep(.15,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(.85,.9,1.,a*.8);}`});
 const flakes=new THREE.Points(flakesGeometry,flakesMaterial),flakeScene=new THREE.Scene();flakes.frustumCulled=false;flakeScene.add(flakes);
 const snowState=createHexSnow();
 const meltGeometry=new THREE.BufferGeometry(),meltMaterial=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide,uniforms:{bounds:{value:bounds},amount:{value:1}},vertexShader:'uniform vec4 bounds;void main(){gl_Position=vec4((position.xy-bounds.xy)/bounds.zw*2.-1.,0.,1.);}',fragmentShader:'uniform float amount;void main(){gl_FragColor=vec4(0.,0.,0.,amount);}'});
 const meltMesh=new THREE.Mesh(meltGeometry,meltMaterial),meltScene=new THREE.Scene();meltMesh.frustumCulled=false;meltScene.add(meltMesh);
 let fullFaces=null,heat=[],pendingMelt=[];
 function melt(keys,amount){const vertices=[];for(const key of new Set(keys)){const cell=snowState.melt(key,amount);if(cell)for(const t of cell.triangles)for(const p of [t.a,t.b,t.c])vertices.push(p.x,p.y,0);}if(!vertices.length)return;meltGeometry.dispose();meltGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));meltMaterial.uniforms.amount.value=amount;const old=renderer.getRenderTarget();renderer.setRenderTarget(target);renderer.render(meltScene,camera);renderer.setRenderTarget(old);}

 let accumulationClock=0,earnedSnow=0;
 let particles=[],faces=[],last=0,credit=0,revision=-1,identity=null,ready=false;
 function clear(){const old=renderer.getRenderTarget(),color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.setRenderTarget(old);renderer.setClearColor(color,alpha);particles=[];credit=0;accumulationClock=0;earnedSnow=0;snowState.clear();if(fullFaces)snowState.update(fullFaces);ready=true;}
 return {texture:target.texture,bounds,hexes:snowState.hexes,
 scene(id,extent){if(id!==identity){identity=id;fullFaces=null;pendingMelt=[];heat=[];if(extent)bounds.fromArray(extent);clear();}},
 setGround(source){if(fullFaces!==source){fullFaces=source;snowState.update(source);}},
 setHeat(source){heat=source;},
 melt(cells,amount=1){pendingMelt.push({keys:cells.map(c=>`${c.x},${c.y}`),amount});},
 begin(){faces=[];if(!ready)clear();},
 collect(surfaces){for(const f of surfaces)if(f.snowEligible&&f.points.length>=3)faces.push(f);},
 end(view){const state=globalThis.adventurePartySnow||{},now=performance.now(),dt=Math.min(.25,Math.max(0,(now-last)/1000));last=now;
 if(revision!==state.revision){revision=state.revision;clear();}
 if(!fullFaces)snowState.update(faces);
 if(!state.paused){credit+=dt*(state.showFlakes===false?0:(state.intensity||0))*700;while(credit>=1&&faces.length&&particles.length<4096){credit--;const landing=snowState.spawn();if(!landing)break;particles.push({...landing,h:100+Math.random()*100,phase:Math.random()*6.28});}
 credit=Math.min(credit,100);
 particles=particles.filter(p=>{p.h-=dt*65;return p.h>0;});
 earnedSnow+=dt*(state.intensity||0)/60;

 }
 for(const request of pendingMelt)melt(request.keys,request.amount);pendingMelt=[];
 for(const source of heat)melt(source.keys,1-Math.exp(-source.rate*dt));
 accumulationClock+=dt;
 if(accumulationClock>=.25){accumulationClock=0;snowState.accumulate(1,earnedSnow);earnedSnow=0;const vertices=[],amounts=[];
 for(const cell of snowState.hexes.values())for(const t of cell.triangles)for(const p of [t.a,t.b,t.c]){vertices.push(p.x,p.y,0);amounts.push(cell.amount);}
 if(geometry.getAttribute('position')?.count!==amounts.length){geometry.dispose();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('coverage',new THREE.Float32BufferAttribute(amounts,1));}else{geometry.attributes.coverage.array.set(amounts);geometry.attributes.coverage.needsUpdate=true;}
 const old=renderer.getRenderTarget();renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(old);
 }
 state.activeCount=particles.length;
 const [a,b,c,d,tx,ty]=view.matrix,u=flakesMaterial.uniforms;u.view.value.set(a,c,tx,b,d,ty,0,0,1);u.anchor.value.set(view.anchor.x,view.anchor.y);u.zoom.value=view.zoom;u.size.value.set(view.width,view.height);
 particles.forEach((p,i)=>{flakePositions[i*3]=p.x+Math.sin(p.h*.03+p.phase)*Math.min(6,p.h*.15);flakePositions[i*3+1]=p.y;flakePositions[i*3+2]=p.h;});flakesGeometry.setDrawRange(0,particles.length);flakesGeometry.attributes.position.needsUpdate=true;if(particles.length&&state.showFlakes!==false)renderer.render(flakeScene,camera);
 },dispose(){meltGeometry.dispose();meltMaterial.dispose();target.dispose();geometry.dispose();material.dispose();flakesGeometry.dispose();flakesMaterial.dispose();}};
}
