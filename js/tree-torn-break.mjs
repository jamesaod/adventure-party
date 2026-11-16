import * as THREE from '../assets/vendor/three/three.module.min.js';
// One deterministic fracture field deforms both sides of the SAME planar split.
// Built once at load; fall animation remains transform-only.
export function tearTrunkGeometry(source,cut,seed){
 const attrs=Object.entries(source.attributes),output=Object.fromEntries(attrs.map(([n])=>[n,[]]));
 const read=i=>Object.fromEntries(attrs.map(([n,a])=>[n,Array.from({length:a.itemSize},(_,j)=>a[['getX','getY','getZ','getW'][j]](i))]));
 const mix=(a,b)=>Object.fromEntries(attrs.map(([n])=>[n,a[n].map((v,j)=>(v+b[n][j])/2)]));
 const phase=seed*1.61803398875,span=cut*.95,amplitude=cut*.29;
 function offset(x,y,z){const distance=Math.abs(y-cut)/span;if(distance>=1)return 0;const fade=(1-distance*distance)**2;
  const angle=Math.atan2(z,x),radius=Math.hypot(x,z),edge=Math.min(1,radius/9);
  const tooth=a=>2/Math.PI*Math.asin(Math.sin(a));
  return amplitude*fade*(edge*(.65*tooth(angle*9+phase)+.3*tooth(angle*17-phase))+.18*Math.sin(x*.63+phase)*Math.cos(z*.41-phase));
 }
 function emit(v){const [x,y,z]=v.position,normal=v.normal,epsilon=.01;
  if(normal&&Math.abs(y-cut)<span){const dx=(offset(x+epsilon,y,z)-offset(x-epsilon,y,z))/(2*epsilon),dy=1+(offset(x,y+epsilon,z)-offset(x,y-epsilon,z))/(2*epsilon),dz=(offset(x,y,z+epsilon)-offset(x,y,z-epsilon))/(2*epsilon);const ny=normal[1]/dy,n=new THREE.Vector3(normal[0]-dx*ny,ny,normal[2]-dz*ny).normalize();v.normal=n.toArray();}
  v.position=[x,y+offset(x,y,z),z];for(const [n] of attrs)output[n].push(...v[n]);
 }
 function triangle(a,b,c,depth=0){const v=[a,b,c],ys=v.map(p=>p.position[1]);
  if(depth<9&&Math.min(...ys)<cut+span&&Math.max(...ys)>cut-span){let longest=-1,edge=-1;for(let i=0;i<3;i++){const p=v[i].position,q=v[(i+1)%3].position,d=p.reduce((s,n,j)=>s+(n-q[j])**2,0);if(d>longest){longest=d;edge=i;}}
   if(longest>100){const p=v[edge],q=v[(edge+1)%3],r=v[(edge+2)%3],m=mix(p,q);triangle(p,m,r,depth+1);triangle(m,q,r,depth+1);return;}}
  // Vertices can be shared by recursive children: never mutate those records.
  for(const v of [a,b,c])emit(Object.fromEntries(Object.entries(v).map(([n,a])=>[n,a.slice()])));
 }
 for(let i=0;i<source.attributes.position.count;i+=3)triangle(read(i),read(i+1),read(i+2));
 const geometry=new THREE.BufferGeometry();for(const [n,a] of attrs)geometry.setAttribute(n,new THREE.Float32BufferAttribute(output[n],a.itemSize));geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function tearTrunkSplit(pieces,cut,seed){for(const mesh of [pieces.upper,pieces.lower,pieces.cap]){const old=mesh.geometry;mesh.geometry=tearTrunkGeometry(old,cut,seed);old.dispose();mesh.userData.breakType='torn';}
 pieces.cap.material.color.setHex(0x98734d);pieces.cap.name='matching-torn-break-face';return pieces;
}

