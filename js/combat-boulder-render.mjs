import * as T from '../assets/vendor/three/three.module.min.js';
import {GLTFLoader} from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import {createGiantImpactDust} from './giant-impact-dust.mjs';
export async function createCombatBoulders(){
 const manifest=await fetch('assets/models/terrain/boulders/manifest.json').then(r=>r.json()),loader=new GLTFLoader();
 const models=await Promise.all(manifest.map(m=>loader.loadAsync(m.file).then(g=>g.scene)));
 const profiles=models.map((model,i)=>{model.updateMatrixWorld(true);const n=33,data=new Float32Array(n*n),m=manifest[i],ray=new T.Raycaster();for(let z=0;z<n;z++)for(let x=0;x<n;x++){ray.set(new T.Vector3((x/(n-1)-.5)*m.dimensionsMetres[0],-1,(z/(n-1)-.5)*m.dimensionsMetres[2]),new T.Vector3(0,1,0));const hit=ray.intersectObject(model,true)[0];if(hit)data[z*n+x]=Math.max(0,.15-hit.point.y*1.35);}return {n,data,width:m.dimensionsMetres[0]*1.35,depth:m.dimensionsMetres[2]*1.35};});
 const scene=new T.Scene(),hemi=new T.HemisphereLight(0xd8edff,0x67533b,1.5),sun=new T.DirectionalLight(0xffe6ba,2.3);
 sun.position.set(-5,10,7);scene.add(hemi,sun);
 const camera=new T.OrthographicCamera(-4,4,6,-2,.1,100);camera.position.set(0,5.68329,8.23);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const particlePositions=new Float32Array(900),particleGeometry=new T.BufferGeometry();particleGeometry.setAttribute('position',new T.BufferAttribute(particlePositions,3));
 const particleMaterial=new T.PointsMaterial({color:0x68462b,size:.045,transparent:true,opacity:1,depthWrite:false});const particles=new T.Points(particleGeometry,particleMaterial);particles.frustumCulled=false;scene.add(particles);
 const group=new T.Group();scene.add(group);let dust=null,owner=null;
 return {profile(variant,factor){const p=profiles[variant];return {...p,width:p.width*factor,depth:p.depth*factor};},draw(host,r,center,pixels,viewRotation){
 if(!host?.treeScene)return;
 const model=models[r.variant],m=manifest[r.variant],height=m.dimensionsMetres[1]*1.35,t=r.progress||0;
 group.clear();group.add(model);model.scale.setScalar(1.35);model.position.set(0,-height/2,0);model.rotation.set(0,0,0);
 const flight=r.state==='flight'?4*(1-t)+4*t*(1-t)*3:0;group.position.set(0,height/2-(r.buried?.15:0)+flight,0);group.rotation.set(r.spin||0,-viewRotation*Math.PI/3,0);
 host.treeScene((gpu,view)=>{
 const cx=view.anchor.x+(center.x-view.anchor.x)*view.zoom,cy=view.anchor.y+(center.y-view.anchor.y)*view.zoom,scale=pixels*view.zoom;
 camera.left=((view.crop?.x||0)-cx)/scale;camera.right=camera.left+(view.crop?.width||view.width)/scale;camera.top=(cy-(view.crop?.y||0))/scale;camera.bottom=camera.top-(view.crop?.height||view.height)/scale;camera.updateProjectionMatrix();
 const age=(performance.now()-(r.impactAt||0))/1000;particles.visible=!!r.impactAt&&age>=0&&age<2.5;if(particles.visible){for(let i=0;i<300;i++){const angle=i*2.39996,speed=.7+(i%17)/8,time=Math.max(0,age-(i%9)*.012);particlePositions[i*3]=Math.cos(angle)*speed*time;particlePositions[i*3+1]=Math.max(.01,(1+(i%13)*.16)*time-4.9*time*time);particlePositions[i*3+2]=Math.sin(angle)*speed*time;}particleGeometry.attributes.position.needsUpdate=true;particleMaterial.opacity=Math.max(0,1-age/2.5);}
 if(r.impactAt&&age>=0&&age<3){if(!dust)dust=createGiantImpactDust(gpu,scene);if(owner!==r.impactAt){owner=r.impactAt;dust.emit(Array.from({length:16},(_,i)=>({x:Math.cos(i*Math.PI/8)*.4,z:Math.sin(i*Math.PI/8)*.4,nx:Math.cos(i*Math.PI/8),nz:Math.sin(i*Math.PI/8)})),new T.Vector3(),0);}dust.update(age);dust.render(camera,hemi,sun,{position:new T.Vector3(),intensity:0});}else{if(dust)dust.clear();gpu.render(scene,camera);}
 },{bounds:{x:center.x-pixels*5,y:center.y-pixels*9,width:pixels*10,height:pixels*12}});
 }};
}
