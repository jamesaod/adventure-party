import * as THREE from '../assets/vendor/three/three.module.min.js';
// Cut the retained trunk and its stump from one source, at the same plane.
export function splitTrunk(mesh,cut){
 const source=mesh.geometry,attributes=Object.entries(source.attributes),upper=[],lower=[],rim=[];
 const vertex=i=>Object.fromEntries(attributes.map(([name,a])=>[name,Array.from({length:a.itemSize},(_,j)=>a[['getX','getY','getZ','getW'][j]](i))]));
 const mix=(a,b,t)=>Object.fromEntries(attributes.map(([name])=>[name,a[name].map((v,j)=>v+(b[name][j]-v)*t)]));
 function clipped(tri,above){const out=[];for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],inside=above?a.position[1]>=cut:a.position[1]<=cut,next=above?b.position[1]>=cut:b.position[1]<=cut;if(inside)out.push(a);if(inside!==next){const p=mix(a,b,(cut-a.position[1])/(b.position[1]-a.position[1]));p.position[1]=cut;out.push(p);if(above)rim.push(p.position);}}return out;}
 for(let i=0;i<source.attributes.position.count;i+=3){const tri=[vertex(i),vertex(i+1),vertex(i+2)];for(const [above,list]of [[true,upper],[false,lower]]){const poly=clipped(tri,above);for(let k=1;k<poly.length-1;k++)list.push(poly[0],poly[k],poly[k+1]);}}
 function build(list){const g=new THREE.BufferGeometry();for(const [name,a]of attributes)g.setAttribute(name,new THREE.Float32BufferAttribute(list.flatMap(p=>p[name]),a.itemSize));g.computeBoundingBox();return g;}
 const upperMesh=mesh.clone(),lowerMesh=mesh.clone();upperMesh.geometry=build(upper);lowerMesh.geometry=build(lower);lowerMesh.name='matching-oak-stump';
 const unique=[...new Map(rim.map(p=>[p.map(v=>v.toFixed(4)).join(','),p])).values()],center=unique.reduce((c,p)=>c.add(new THREE.Vector3(...p)),new THREE.Vector3()).multiplyScalar(1/Math.max(1,unique.length));
 unique.sort((a,b)=>Math.atan2(a[2]-center.z,a[0]-center.x)-Math.atan2(b[2]-center.z,b[0]-center.x));
 const capPositions=[];for(let i=0;i<unique.length;i++)capPositions.push(...center.toArray(),...unique[i],...unique[(i+1)%unique.length]);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(capPositions,3));geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({color:0x785235,roughness:1,side:THREE.DoubleSide});
 material.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 cutPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncutPosition=position;');shader.fragmentShader='varying vec3 cutPosition;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat rings=sin(length(cutPosition.xz)*1.8+sin(cutPosition.x*.3)*.6);diffuseColor.rgb*=.82+.18*rings;');};
 const cap=new THREE.Mesh(geometry,material);cap.name='matching-oak-break-face';cap.castShadow=cap.receiveShadow=true;
 return {upper:upperMesh,lower:lowerMesh,cap};
}
