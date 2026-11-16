// Lab adapter: production grass geometry, placement, materials and wind.
// Only projection changes from the battlefield canvas to the lab's 3D camera.
import * as T from '../assets/vendor/three/three.module.min.js';
import {createGroundCover,GROUND_COVER_DEFAULTS,coverField} from './combat-ground-cover.mjs?v=tree-snow-grains1';
export function fieldWear(x,z){const n=.8*coverField(x/3.4*4,z/3.4*4)+.2*coverField(x/3.4*19+80,z/3.4*19-30),v=Math.max(0,Math.min(1,(n-(.85-.25*.7))/.4+.5));return v*v*(3-2*v);}
export function createRainFieldCover(renderer,camera,{surfaceMap,values}){
 const scene=new T.Scene(),unit=128/3,squash=.568329;
 const zero=new T.DataTexture(new Uint8Array([0,0,0,0]),1,1);zero.needsUpdate=true;
 const light=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);light.needsUpdate=true;
 const patched=new WeakSet();
 const cover=createGroundCover({snow:{texture:zero,footprintTexture:zero,bounds:new T.Vector4(-8*unit,-8*unit*squash,16*unit,16*unit*squash)},texture:t=>t,flush(){},markBackdrop(){},tuning:{...GROUND_COVER_DEFAULTS,grassCoverage:(x,y)=>1-fieldWear(x/unit,y/(unit*squash))},paint(mesh){
  const material=mesh.material;
  if(!patched.has(material)){
   patched.add(material);material.depthTest=true;material.depthWrite=true;
   material.uniforms.labSurface={value:surfaceMap};
   material.vertexShader='uniform sampler2D labSurface;\n'+material.vertexShader;
   material.vertexShader=material.vertexShader.replace('gl_Position=projectionMatrix*vec4(screen,0.,1.);',`vec2 labXZ=world/vec2(${unit},${unit*squash});
    float labGround=texture2D(labSurface,(labXZ+8.)/16.).r*.6-.4;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(labXZ.x,labGround+height,labXZ.y,1.);`);
   material.vertexShader=material.vertexShader.replace('vec2 acrossPixels=(projectionMatrix*vec4((combatView*vec3(across,0.)).xy*zoom,0.,0.)).xy*coverViewport*.5;',`vec3 labAcross=vec3(across.x/${unit},0.,across.y/${unit*squash});
    vec4 labAcrossClip=projectionMatrix*modelViewMatrix*vec4(labXZ.x+labAcross.x,labGround+height,labXZ.y+labAcross.z,1.);
    vec2 acrossPixels=(labAcrossClip.xy/labAcrossClip.w-gl_Position.xy/gl_Position.w)*coverViewport*.5;`);
   material.vertexShader=material.vertexShader.replace(/vec2 alongPixels=.*?;/,`vec4 labAlongClip=projectionMatrix*modelViewMatrix*vec4(labXZ.x+tangent.x*.5,labGround+height+tangent.y*.5,labXZ.y+tangent.z*.5,1.);
    vec2 alongPixels=(labAlongClip.xy/labAlongClip.w-gl_Position.xy/gl_Position.w)*coverViewport*.5;`);
   material.fragmentShader='uniform sampler2D labSurface;\n'+material.fragmentShader;
   const end=material.fragmentShader.lastIndexOf('}');material.fragmentShader=material.fragmentShader.slice(0,end)+`gl_FragColor.rgb*=1.-texture2D(labSurface,(vWorld/vec2(${unit},${unit*squash})+8.)/16.).g*.3;\n`+material.fragmentShader.slice(end);
   material.needsUpdate=true;
  }
  material.uniforms.windStrength.value=values.wind;
  scene.add(mesh);renderer.render(scene,camera);scene.remove(mesh);
 }});
 return {draw(mover){cover.begin({width:10000,height:10000,matrix:[1,0,0,1,5000,5000],anchor:{x:0,y:0},zoom:1});cover.collect([{grass:true,grassUnit:unit,grassSquash:squash,snowEligible:1,points:[{x:-8*unit,y:-8*unit*squash},{x:8*unit,y:-8*unit*squash},{x:8*unit,y:8*unit*squash},{x:-8*unit,y:8*unit*squash}]}],{lightMap:{layers:[light,zero],left:-8*unit,top:-8*unit*squash,spanWidth:16*unit,spanHeight:16*unit*squash}});cover.prepare(mover?[[mover.x*unit,mover.z*unit*squash,.4,.4]]:[]);cover.drawUntil(Infinity);},diagnostics:()=>cover.diagnostics()};
}
