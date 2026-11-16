import * as THREE from '../assets/vendor/three/three.module.min.js';
const majorCache=new WeakMap();
function majorVertices(geometry){
 if(majorCache.has(geometry))return majorCache.get(geometry);
 const p=geometry.attributes.position,ids=[],parents=[],lookup=new Map();
 function root(i){return parents[i]===i?i:parents[i]=root(parents[i]);}
 for(let i=0;i<p.count;i++){const k=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(4)).join(',');if(!lookup.has(k)){lookup.set(k,parents.length);parents.push(parents.length);}ids.push(lookup.get(k));}
 for(let i=0;i<p.count;i+=3){parents[root(ids[i+1])]=root(ids[i]);parents[root(ids[i+2])]=root(ids[i]);}
 const groups=new Map();for(let i=0;i<p.count;i++){const k=root(ids[i]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}
 const indices=[...groups.values()].sort((a,b)=>b.length-a.length)[0]||[];majorCache.set(geometry,indices);return indices;
}
// Fit the substantial connected wood, excluding detached twigs and leaves.
export function debrisFootprints(group){
 group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),out=[];
 group.traverseVisible(mesh=>{if(!mesh.isMesh||!(mesh.userData.debrisLimb||/^(Oak_detached_limb_|continuous-oak-trunk|matching-oak-stump)/.test(mesh.name)))return;
 const p=mesh.geometry.attributes.position,transform=inverse.clone().multiply(mesh.matrixWorld),points=majorVertices(mesh.geometry).map(i=>new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(transform));if(!points.length)return;
 let cx=0,cz=0;for(const p of points){cx+=p.x;cz+=p.z;}cx/=points.length;cz/=points.length;
 let xx=0,xz=0,zz=0;for(const p of points){xx+=(p.x-cx)**2;xz+=(p.x-cx)*(p.z-cz);zz+=(p.z-cz)**2;}
 const angle=.5*Math.atan2(2*xz,xx-zz),dx=Math.cos(angle),dz=Math.sin(angle);let low=Infinity,high=-Infinity,radius=0;
 for(const p of points){const x=p.x-cx,z=p.z-cz,t=x*dx+z*dz;low=Math.min(low,t);high=Math.max(high,t);radius=Math.max(radius,Math.abs(-x*dz+z*dx));}
 out.push({piece:mesh.name,ax:cx+low*dx,az:cz+low*dz,bx:cx+high*dx,bz:cz+high*dz,radius:Math.max(1.5,radius)});
 });return out;
}
