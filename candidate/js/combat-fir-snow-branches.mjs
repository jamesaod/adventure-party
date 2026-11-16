import * as THREE from '../assets/vendor/three/three.module.min.js';
// Prepared once: alpha-aware downward probes find actual foliage, not card corners.
export function createFirSnowCaps(model){
 model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
 const supports=[];
 const random=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
 // TreeIt exports disconnected bark tubes within one non-indexed mesh.
 // Weld triangle seams, then follow each connected branch's long axis once.
 const inverse=model.matrixWorld.clone().invert();let seed=0;
 model.traverse(mesh=>{
  if(!mesh.isMesh||mesh.material.alphaTest>0)return;
  const pos=mesh.geometry.attributes.position,index=mesh.geometry.index,points=[],ids=[],parent=[],weld=new Map();
  const transform=inverse.clone().multiply(mesh.matrixWorld);
  function root(i){while(parent[i]!==i)i=parent[i]=parent[parent[i]];return i;}
  for(let i=0;i<pos.count;i++){
   const p=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(transform),key=[p.x,p.y,p.z].map(v=>Math.round(v*100)).join(',');
   if(!weld.has(key)){weld.set(key,points.length);parent.push(points.length);points.push(p);}ids.push(weld.get(key));
  }
  for(let i=0;i<(index?index.count:pos.count);i+=3){const a=ids[index?index.getX(i):i],b=ids[index?index.getX(i+1):i+1],c=ids[index?index.getX(i+2):i+2];parent[root(b)]=root(a);parent[root(c)]=root(a);}
  const groups=new Map();points.forEach((p,i)=>{const k=root(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);});
  const minLength=size.y/model.scale.y*.035;
  for(const group of groups.values()){
   if(group.length<6)continue;
   const far=p=>group.reduce((best,q)=>q.distanceToSquared(p)>best.distanceToSquared(p)?q:best,group[0]);
   let a=far(group[0]),b=far(a);if(a.x*a.x+a.z*a.z>b.x*b.x+b.z*b.z)[a,b]=[b,a];
   const delta=b.clone().sub(a),length=delta.length(),horizontal=Math.hypot(delta.x,delta.z);
   if(length<minLength||horizontal<length*.55)continue; // No snow sleeve on vertical trunks.
   const axis=delta.clone().normalize(),count=Math.max(3,Math.min(12,Math.ceil(length/minLength*2))),branchSeed=seed++;
   for(let j=0;j<count;j++){
    const t=(j+.5)/count,center=a.clone().addScaledVector(delta,t);
    const nearby=group.filter(p=>Math.abs(p.clone().sub(a).dot(axis)/length-t)<.8/count);
    if(!nearby.length)continue;
    const top=Math.max(...nearby.map(p=>p.y));center.y=Math.max(center.y,top);
    const width=minLength*(.65+.25*random(branchSeed))*(1-.65*t);
    supports.push({point:center,radius:width,length:horizontal/count*.82,angle:Math.atan2(delta.x,delta.z),seed:branchSeed,onset:random(branchSeed+73)*.35});
   }
  }
 });
 const geometry=new THREE.SphereGeometry(1,10,6);const pos=geometry.attributes.position;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),r=1+.12*Math.sin(Math.atan2(z,x)*5)+.06*Math.cos(Math.atan2(z,x)*3);pos.setXYZ(i,x*r,pos.getY(i),z*r);}geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({color:0xf0f3f5,roughness:1,metalness:0});
 // Cheap directional sky tint: no extra shadow map, probes or frame loop.
 const snowSun={value:new THREE.Vector3(0,1,0)},snowDay={value:1};
 material.onBeforeCompile=shader=>{
  shader.uniforms.snowSun=snowSun;shader.uniforms.snowDay=snowDay;
  shader.vertexShader='varying vec3 vSnowNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nvSnowNormal=inverseTransformDirection(transformedNormal,viewMatrix);');
  shader.fragmentShader='varying vec3 vSnowNormal; uniform vec3 snowSun; uniform float snowDay;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',`#include <colorspace_fragment>
   vec3 sn=normalize(vSnowNormal);
   float facing=smoothstep(0.05,0.85,dot(sn,normalize(snowSun)))*smoothstep(-0.1,0.85,sn.y);
   float underside=smoothstep(-0.55,0.35,sn.y);
   vec3 snowTint=mix(vec3(0.38,0.56,0.78),vec3(1.0,0.97,0.91),facing);
   snowTint*=mix(0.76,1.0,underside);
   gl_FragColor.rgb*=mix(vec3(1.0),snowTint,snowDay);
  `);
 };
 material.customProgramCacheKey=()=> 'fir-snow-branch-blue-v2';
 const mesh=new THREE.InstancedMesh(geometry,material,supports.length);mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=false;mesh.visible=false;model.add(mesh);
 const dummy=new THREE.Object3D();let previous=-1;
 return {mesh,light(direction,daylight){snowSun.value.copy(direction);snowDay.value=Math.max(0,Math.min(1,daylight));},set(amount){amount=Math.max(0,Math.min(1,amount));mesh.visible=amount>0;if(amount===previous)return;previous=amount;
  supports.forEach((s,i)=>{const onset=s.onset;const growth=THREE.MathUtils.smoothstep(amount,onset,Math.min(1,onset+.4+random(s.seed+51)*.2));const radius=s.radius*Math.sqrt(growth),thickness=s.radius*.38*growth;dummy.position.copy(s.point);dummy.position.y+=thickness*.5;dummy.rotation.set(0,s.angle,0);dummy.scale.set(radius,thickness,s.length*Math.sqrt(growth));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;
 }};
}
