import * as THREE from '../../assets/vendor/three/three.module.min.js';
import {createSnowAccumulation} from '../../js/combat-snow.mjs?v=R238C298';

// Test-only GPU readback: production never reads the accumulation map back.
export function verifySnowCoatMap(tick){
 const canvas=document.createElement('canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:false});renderer.setSize(256,256);renderer.autoClear=false;
 const snow=createSnowAccumulation(renderer),scene=new THREE.Scene(),camera=new THREE.Camera();
 const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{map:{value:snow.texture}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 vUv;uniform sampler2D map;void main(){gl_FragColor=vec4(texture2D(map,vUv).rg,0.,1.);}'});
 const geometry=new THREE.PlaneGeometry(2,2),quad=new THREE.Mesh(geometry,material);scene.add(quad);
 const state=globalThis.adventurePartySnow,old={...state},view={matrix:[1,0,0,1,0,0],anchor:{x:0,y:0},zoom:1,width:256,height:256};
 const floor={snowHex:'0,0',snowEligible:1,points:[{x:0,y:0},{x:256,y:0},{x:256,y:256},{x:0,y:256}]};
 const gl=renderer.getContext(),pixels=new Uint8Array(256*256*4),milestones=[];
 let started=false,completed=false;
 function step(){tick();snow.begin();snow.collect([floor]);snow.end(view);renderer.setRenderTarget(null);renderer.render(scene,camera);gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,pixels);if(gl.getError()!==gl.NO_ERROR)throw Error('Snow map GL readback error');}
 function check(sequence=true){
  let first=0,second=0;for(let i=0;i<pixels.length;i+=4){first+=pixels[i]>=4;second+=pixels[i+1]>=4;}
  const gpu={first:first/65536,second:second/65536},cpu=snow.coatCoverage;
  if(gpu.first!==cpu.first||gpu.second!==cpu.second)throw Error('GPU / CPU coverage disagreement: '+JSON.stringify({gpu,cpu}));
  if(sequence&&gpu.second>0&&gpu.first<.9)throw Error('Rendered second coat started early');
  if(sequence&&gpu.second>=.2&&gpu.first!==1)throw Error('Rendered base is incomplete at 20% second coat');
  if(gpu.second>0&&!started){milestones.push(gpu);started=true;}
  if(gpu.second>=.2&&!completed){milestones.push(gpu);completed=true;}
  return gpu;
 }
 try{
  Object.assign(state,{intensity:0,paused:true,showFlakes:false,revision:0});snow.scene('gpu-coats',[0,0,256,256]);snow.setGround([floor]);step();check();
  for(let i=0;i<400&&!completed;i++){state.intensity=snow.coatCoverage.first>.88?.2:4;state.paused=false;step();check();}
  if(!completed)throw Error('Second coat never reached 20%');
  state.paused=true;step();check();
  snow.melt([{x:0,y:0}],.73);step();const partial=check(false);if(partial.first===1)throw Error('Partial melt did not reopen base gaps');
  snow.melt([{x:0,y:0}],1);step();const empty=check();if(empty.first||empty.second)throw Error('Melt retained snow');
  state.paused=false;for(let i=0;i<5;i++){step();check();}
  state.paused=true;state.revision++;step();if(check().first)throw Error('Clear retained coat coverage');
  return {milestones,readback:'exact GPU / CPU texel coverage match',melt:'partial and complete',clear:true};
 }finally{Object.assign(state,old);snow.dispose();material.dispose();geometry.dispose();renderer.dispose();renderer.forceContextLoss();}
}
